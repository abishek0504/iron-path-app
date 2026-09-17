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

    /// WCSession nested payloads often arrive as NSDictionary, which does not
    /// cast to `[String: Any]` with `as?`.
    static func dictionary(from value: Any?) -> [String: Any]? {
        if let dict = value as? [String: Any] {
            return dict
        }
        guard let ns = value as? NSDictionary else { return nil }
        var result: [String: Any] = [:]
        ns.enumerateKeysAndObjects { key, object, _ in
            guard let key = key as? String else { return }
            result[key] = object
        }
        return result.isEmpty ? nil : result
    }

    static func load() -> Credentials? {
        guard let defaults = UserDefaults(suiteName: appGroupId),
              let record = defaults.dictionary(forKey: authKey) else {
            return nil
        }
        return credentials(from: record)
    }

    static func storedUpdatedAt() -> TimeInterval {
        guard let defaults = UserDefaults(suiteName: appGroupId),
              let record = defaults.dictionary(forKey: authKey) else {
            return 0
        }
        return timeInterval(record["updatedAt"])
    }

    static func credentialsNeedRefresh() -> Bool {
        guard let creds = load() else { return true }
        if creds.expiresAt <= 0 { return true }
        return creds.expiresAt - 60 < Date().timeIntervalSince1970
    }

    /// Persist a WCSession auth payload from the iPhone. App Groups are not shared
    /// across the phone/watch pair — this store is local to the watch.
    @discardableResult
    static func save(from raw: [String: Any]) -> Bool {
        let record = dictionary(from: raw) ?? raw

        let incomingUpdatedAt = timeInterval(record["updatedAt"])
        let stored = storedUpdatedAt()
        if incomingUpdatedAt > 0, stored > 0, incomingUpdatedAt < stored {
            #if DEBUG
            NSLog(
                "IronPath watch auth ignored stale payload updatedAt=%.0f stored=%.0f",
                incomingUpdatedAt,
                stored
            )
            #endif
            return false
        }

        if boolValue(record["cleared"]) {
            clear()
            return true
        }

        guard let credentials = credentials(from: record) else {
            #if DEBUG
            let missing = ["accessToken", "refreshToken", "userId", "supabaseUrl", "supabaseAnonKey"]
                .filter { stringValue(record[$0])?.isEmpty != false }
            NSLog("IronPath watch auth save failed missing=%@", missing.joined(separator: ","))
            #endif
            return false
        }
        save(credentials, updatedAt: incomingUpdatedAt > 0 ? incomingUpdatedAt : Date().timeIntervalSince1970)
        return true
    }

    static func save(_ credentials: Credentials) {
        save(credentials, updatedAt: Date().timeIntervalSince1970)
    }

    static func clear() {
        UserDefaults(suiteName: appGroupId)?.removeObject(forKey: authKey)
        #if DEBUG
        NSLog("IronPath watch auth cleared")
        #endif
    }

    private static func save(_ credentials: Credentials, updatedAt: TimeInterval) {
        guard let defaults = UserDefaults(suiteName: appGroupId) else { return }
        defaults.set(
            [
                "accessToken": credentials.accessToken,
                "refreshToken": credentials.refreshToken,
                "expiresAt": credentials.expiresAt,
                "userId": credentials.userId,
                "supabaseUrl": credentials.supabaseUrl,
                "supabaseAnonKey": credentials.supabaseAnonKey,
                "updatedAt": updatedAt,
            ] as [String: Any],
            forKey: authKey
        )
        #if DEBUG
        NSLog("IronPath watch auth saved userId=%@", credentials.userId)
        #endif
    }

    private static func credentials(from record: [String: Any]) -> Credentials? {
        guard let accessToken = stringValue(record["accessToken"]), !accessToken.isEmpty,
              let refreshToken = stringValue(record["refreshToken"]), !refreshToken.isEmpty,
              let userId = stringValue(record["userId"]), !userId.isEmpty,
              let supabaseUrl = stringValue(record["supabaseUrl"]), !supabaseUrl.isEmpty,
              let supabaseAnonKey = stringValue(record["supabaseAnonKey"]), !supabaseAnonKey.isEmpty
        else {
            return nil
        }
        return Credentials(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: timeInterval(record["expiresAt"]),
            userId: userId,
            supabaseUrl: supabaseUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/")),
            supabaseAnonKey: supabaseAnonKey
        )
    }

    private static func stringValue(_ value: Any?) -> String? {
        if let string = value as? String {
            let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        }
        return nil
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
