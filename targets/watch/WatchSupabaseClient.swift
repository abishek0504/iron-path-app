import Foundation

private func intFromPayload(_ value: Any?) -> Int? {
    guard let value else { return nil }
    if let intValue = value as? Int { return intValue }
    if let number = value as? NSNumber {
        let doubleValue = number.doubleValue
        guard doubleValue.isFinite else { return nil }
        let rounded = Int(doubleValue.rounded())
        guard abs(doubleValue - Double(rounded)) < 0.0001 else { return nil }
        return rounded
    }
    if let doubleValue = value as? Double, doubleValue.isFinite {
        let rounded = Int(doubleValue.rounded())
        guard abs(doubleValue - Double(rounded)) < 0.0001 else { return nil }
        return rounded
    }
    return nil
}

enum WatchSupabaseError: Error, LocalizedError {
    case notAuthenticated
    case http(Int, String)
    case decoding
    case offlineStart

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Sign in on iPhone first"
        case .http(let code, let body):
            return "Server error \(code): \(body)"
        case .decoding:
            return "Unexpected server response"
        case .offlineStart:
            return "Connect to start a workout"
        }
    }
}

/// Minimal Supabase REST client for watchOS (no Swift SDK dependency).
actor WatchSupabaseClient {
    private var credentials: WatchSharedAuth.Credentials

    init(credentials: WatchSharedAuth.Credentials) {
        self.credentials = credentials
    }

    static func makeIfPossible() -> WatchSupabaseClient? {
        guard let creds = WatchSharedAuth.load() else { return nil }
        return WatchSupabaseClient(credentials: creds)
    }

    var userId: String { credentials.userId }

    private func authorizedRequest(path: String, method: String, body: Data? = nil) async throws -> Data {
        try await ensureFreshToken()
        guard let url = URL(string: "\(credentials.supabaseUrl)\(path)") else {
            throw WatchSupabaseError.decoding
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(credentials.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(credentials.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=representation", forHTTPHeaderField: "Prefer")
        request.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw WatchSupabaseError.decoding
        }
        guard (200...299).contains(http.statusCode) else {
            let bodyText = String(data: data, encoding: .utf8) ?? ""
            throw WatchSupabaseError.http(http.statusCode, bodyText)
        }
        return data
    }

    private func ensureFreshToken() async throws {
        let now = Date().timeIntervalSince1970
        // Refresh one minute early.
        guard credentials.expiresAt > 0, credentials.expiresAt - 60 < now else { return }

        guard let url = URL(string: "\(credentials.supabaseUrl)/auth/v1/token?grant_type=refresh_token") else {
            throw WatchSupabaseError.decoding
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(credentials.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let payload = ["refresh_token": credentials.refreshToken]
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode),
              let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let accessToken = json["access_token"] as? String,
              let refreshToken = json["refresh_token"] as? String
        else {
            throw WatchSupabaseError.notAuthenticated
        }
        let expiresIn = (json["expires_in"] as? Double) ?? 3600
        credentials.accessToken = accessToken
        credentials.refreshToken = refreshToken
        credentials.expiresAt = Date().timeIntervalSince1970 + expiresIn
        WatchSharedAuth.save(credentials)
    }

    func getJSON(path: String) async throws -> Any {
        let data = try await authorizedRequest(path: path, method: "GET")
        return try JSONSerialization.jsonObject(with: data)
    }

    func postJSON(path: String, body: [String: Any]) async throws -> Any {
        let data = try JSONSerialization.data(withJSONObject: body)
        let responseData = try await authorizedRequest(path: path, method: "POST", body: data)
        if responseData.isEmpty { return [:] }
        return try JSONSerialization.jsonObject(with: responseData)
    }

    func patchJSON(path: String, body: [String: Any]) async throws {
        let data = try JSONSerialization.data(withJSONObject: body)
        _ = try await authorizedRequest(path: path, method: "PATCH", body: data)
    }

    // MARK: - Domain helpers

    func fetchActiveSession() async throws -> [String: Any]? {
        let path =
            "/rest/v1/v2_workout_sessions?user_id=eq.\(credentials.userId)&status=eq.active&select=*&order=started_at.desc&limit=1"
        let json = try await getJSON(path: path)
        guard let rows = json as? [[String: Any]] else { return nil }
        return rows.first
    }

    func fetchSessionBundle(sessionId: String) async throws -> (
        session: [String: Any],
        exercises: [[String: Any]],
        setsByExercise: [String: [[String: Any]]],
        names: [String: String],
        timed: Set<String>,
        useImperial: Bool
    ) {
        let sessionPath =
            "/rest/v1/v2_workout_sessions?id=eq.\(sessionId)&user_id=eq.\(credentials.userId)&select=*&limit=1"
        guard let sessionRows = try await getJSON(path: sessionPath) as? [[String: Any]],
              let session = sessionRows.first else {
            throw WatchSupabaseError.decoding
        }

        let exPath =
            "/rest/v1/v2_session_exercises?session_id=eq.\(sessionId)&select=*&order=sort_order.asc"
        let exercises = (try await getJSON(path: exPath) as? [[String: Any]]) ?? []
        let exerciseIds = exercises.compactMap { $0["id"] as? String }
        var setsByExercise: [String: [[String: Any]]] = [:]
        if !exerciseIds.isEmpty {
            let joined = exerciseIds.joined(separator: ",")
            let setsPath =
                "/rest/v1/v2_session_sets?session_exercise_id=in.(\(joined))&select=*&order=set_number.asc"
            let sets = (try await getJSON(path: setsPath) as? [[String: Any]]) ?? []
            for set in sets {
                guard let seId = set["session_exercise_id"] as? String else { continue }
                setsByExercise[seId, default: []].append(set)
            }
        }

        var catalogIds: [String] = []
        var customIds: [String] = []
        for ex in exercises {
            if let id = ex["exercise_id"] as? String { catalogIds.append(id) }
            if let id = ex["custom_exercise_id"] as? String { customIds.append(id) }
        }

        var names: [String: String] = [:]
        var timed = Set<String>()
        if !catalogIds.isEmpty {
            let joined = catalogIds.joined(separator: ",")
            let path = "/rest/v1/v2_exercises?id=in.(\(joined))&select=id,name,is_timed"
            let rows = (try await getJSON(path: path) as? [[String: Any]]) ?? []
            for row in rows {
                guard let id = row["id"] as? String else { continue }
                names[id] = row["name"] as? String ?? "Exercise"
                if row["is_timed"] as? Bool == true { timed.insert(id) }
            }
        }
        if !customIds.isEmpty {
            let joined = customIds.joined(separator: ",")
            let path = "/rest/v1/v2_custom_exercises?id=in.(\(joined))&select=id,name,is_timed"
            let rows = (try await getJSON(path: path) as? [[String: Any]]) ?? []
            for row in rows {
                guard let id = row["id"] as? String else { continue }
                names[id] = row["name"] as? String ?? "Exercise"
                if row["is_timed"] as? Bool == true { timed.insert(id) }
            }
        }

        let profilePath =
            "/rest/v1/v2_profiles?id=eq.\(credentials.userId)&select=use_imperial&limit=1"
        let profileRows = (try await getJSON(path: profilePath) as? [[String: Any]]) ?? []
        let useImperial = (profileRows.first?["use_imperial"] as? Bool) ?? true

        return (session, exercises, setsByExercise, names, timed, useImperial)
    }

    func createWatchSessionFromTodayPlan() async throws -> String {
        // Active template for user (most recently updated).
        let templatesPath =
            "/rest/v1/v2_workout_templates?user_id=eq.\(credentials.userId)&is_active=eq.true&select=id&order=updated_at.desc.nullslast&limit=1"
        guard let templates = try await getJSON(path: templatesPath) as? [[String: Any]],
              let templateId = templates.first?["id"] as? String else {
            throw WatchSupabaseError.http(404, "No workout plan found")
        }

        let dayName = Self.todayDayName()
        let daysPath =
            "/rest/v1/v2_template_days?template_id=eq.\(templateId)&day_name=eq.\(dayName.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? dayName)&select=id&limit=1"
        guard let days = try await getJSON(path: daysPath) as? [[String: Any]],
              let dayId = days.first?["id"] as? String else {
            throw WatchSupabaseError.http(404, "No exercises for \(dayName)")
        }

        let slotsPath =
            "/rest/v1/v2_template_slots?day_id=eq.\(dayId)&select=*&order=sort_order.asc"
        let slots = (try await getJSON(path: slotsPath) as? [[String: Any]]) ?? []
        guard !slots.isEmpty else {
            throw WatchSupabaseError.http(404, "No exercises for \(dayName)")
        }

        // Abandon any leftover active session so one-active constraint succeeds.
        if let active = try await fetchActiveSession(), let activeId = active["id"] as? String {
            try await patchJSON(
                path: "/rest/v1/v2_workout_sessions?id=eq.\(activeId)",
                body: ["status": "abandoned"]
            )
        }

        let sessionBody: [String: Any] = [
            "user_id": credentials.userId,
            "template_id": templateId,
            "day_name": dayName,
            "status": "active",
            "started_at": ISO8601DateFormatter().string(from: Date()),
            "origin": "manual",
            "control_device": "watch",
        ]
        guard let created = try await postJSON(path: "/rest/v1/v2_workout_sessions", body: sessionBody) as? [[String: Any]],
              let sessionId = created.first?["id"] as? String else {
            throw WatchSupabaseError.decoding
        }

        for slot in slots {
            var seBody: [String: Any] = [
                "session_id": sessionId,
                "sort_order": intFromPayload(slot["sort_order"]) ?? 0,
            ]
            if let exerciseId = slot["exercise_id"] as? String { seBody["exercise_id"] = exerciseId }
            if let customId = slot["custom_exercise_id"] as? String { seBody["custom_exercise_id"] = customId }
            if let rest = intFromPayload(slot["rest_sec"]) { seBody["rest_sec"] = rest }
            if let group = intFromPayload(slot["superset_group"]) { seBody["superset_group"] = group }

            guard let seRows = try await postJSON(path: "/rest/v1/v2_session_exercises", body: seBody) as? [[String: Any]],
                  let seId = seRows.first?["id"] as? String else {
                continue
            }

            // Default 3 sets; targets filled loosely for watch confirm flow.
            for setNumber in 1...3 {
                let setBody: [String: Any] = [
                    "session_exercise_id": seId,
                    "set_number": setNumber,
                    "reps": 8,
                    "set_type": "normal",
                ]
                _ = try await postJSON(path: "/rest/v1/v2_session_sets", body: setBody)
            }
        }

        return sessionId
    }

    func markSetComplete(
        setId: String,
        reps: Int?,
        weight: Double?,
        durationSec: Int?,
        rpe: Int?
    ) async throws {
        var body: [String: Any] = [
            "performed_at": ISO8601DateFormatter().string(from: Date()),
        ]
        if let reps { body["reps"] = reps }
        if let weight { body["weight"] = weight }
        if let durationSec { body["duration_sec"] = durationSec }
        if let rpe { body["rpe"] = rpe }
        try await patchJSON(path: "/rest/v1/v2_session_sets?id=eq.\(setId)", body: body)
    }

    func completeSession(sessionId: String, hkWorkoutUuid: String?) async throws {
        var body: [String: Any] = [
            "status": "completed",
            "completed_at": ISO8601DateFormatter().string(from: Date()),
        ]
        if let hkWorkoutUuid { body["hk_workout_uuid"] = hkWorkoutUuid }
        try await patchJSON(path: "/rest/v1/v2_workout_sessions?id=eq.\(sessionId)", body: body)
    }

    private static func todayDayName() -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEEE"
        return formatter.string(from: Date())
    }
}
