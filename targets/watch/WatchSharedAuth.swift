import Foundation

/// Reads Supabase credentials mirrored from the iPhone into the Watch App Group.
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
        let expiresAt = (record["expiresAt"] as? Double) ?? 0
        return Credentials(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: expiresAt,
            userId: userId,
            supabaseUrl: supabaseUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/")),
            supabaseAnonKey: supabaseAnonKey
        )
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
    }
}
