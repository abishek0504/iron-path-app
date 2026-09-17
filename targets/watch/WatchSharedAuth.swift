import Foundation

/// Local watch store for Supabase credentials delivered over WCSession.
enum WatchSharedAuth {
    static let appGroupId = "group.com.alexpreo.ironpath.shared"
    static let authKey = "ironpath.watch.auth"

    struct Credentials: Equatable {
        var accessToken: String
        var refreshToken: String
        var expiresAt: TimeInterval
        var userId: String
        var supabaseUrl: String
        var supabaseAnonKey: String
    }

    static func load() -> Credentials? {
        guard let defaults = UserDefaults(suiteName: appGroupId),
              let record = defaults.dictionary(forKey: authKey) else {
            return nil
        }
        guard let accessToken = record["accessToken"] as? String, !accessToken.isEmpty,
              let refreshToken = record["refreshToken"] as? String, !refreshToken.isEmpty,
              let userId = record["userId"] as? String, !userId.isEmpty,
              let supabaseUrl = record["supabaseUrl"] as? String, !supabaseUrl.isEmpty,
              let supabaseAnonKey = record["supabaseAnonKey"] as? String, !supabaseAnonKey.isEmpty
        else {
            return nil
        }
        let expiresAt = timeInterval(record["expiresAt"])
        return Credentials(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: expiresAt,
            userId: userId,
            supabaseUrl: supabaseUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/")),
            supabaseAnonKey: supabaseAnonKey
        )
    }

    /// Persist a WCSession auth payload from the iPhone. App Groups are not shared
    /// across the phone/watch pair — this store is local to the watch.
    @discardableResult
    static func save(from record: [String: Any]) -> Bool {
        if boolValue(record["cleared"]) {
            clear()
            return true
        }
        guard let accessToken = record["accessToken"] as? String, !accessToken.isEmpty,
              let refreshToken = record["refreshToken"] as? String, !refreshToken.isEmpty,
              let userId = record["userId"] as? String, !userId.isEmpty,
              let supabaseUrl = record["supabaseUrl"] as? String, !supabaseUrl.isEmpty,
              let supabaseAnonKey = record["supabaseAnonKey"] as? String, !supabaseAnonKey.isEmpty
        else {
            return false
        }
        save(
            Credentials(
                accessToken: accessToken,
                refreshToken: refreshToken,
                expiresAt: timeInterval(record["expiresAt"]),
                userId: userId,
                supabaseUrl: supabaseUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/")),
                supabaseAnonKey: supabaseAnonKey
            )
        )
        return true
    }

    static func save(_ credentials: Credentials) {
        guard let defaults = UserDefaults(suiteName: appGroupId) else { return }
        defaults.set(
            [
                "accessToken": credentials.accessToken,
                "refreshToken": credentials.refreshToken,
                "expiresAt": credentials.expiresAt,
                "userId": credentials.userId,
                "supabaseUrl": credentials.supabaseUrl,
                "supabaseAnonKey": credentials.supabaseAnonKey,
                "updatedAt": Date().timeIntervalSince1970,
            ] as [String: Any],
            forKey: authKey
        )
        #if DEBUG
        NSLog("IronPath watch auth saved userId=%@", credentials.userId)
        #endif
    }

    static func clear() {
        UserDefaults(suiteName: appGroupId)?.removeObject(forKey: authKey)
        #if DEBUG
        NSLog("IronPath watch auth cleared")
        #endif
    }

    private static func timeInterval(_ value: Any?) -> TimeInterval {
        if let doubleValue = value as? Double, doubleValue.isFinite { return doubleValue }
        if let number = value as? NSNumber { return number.doubleValue }
        if let intValue = value as? Int { return TimeInterval(intValue) }
        return 0
    }

    private static func boolValue(_ value: Any?) -> Bool {
        if let bool = value as? Bool { return bool }
        if let number = value as? NSNumber { return number.boolValue }
        return false
    }
}
