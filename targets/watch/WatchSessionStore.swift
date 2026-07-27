import Foundation

/// Durable local snapshot + mutation outbox for watch-owned workouts.
final class WatchSessionStore {
    static let shared = WatchSessionStore()

    private let appGroupId = WatchSharedAuth.appGroupId
    private let snapshotKey = "ironpath.watch.localSnapshot"
    private let outboxKey = "ironpath.watch.outbox"

    private var defaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    func loadSnapshot() -> WatchLocalSnapshot? {
        guard let data = defaults?.data(forKey: snapshotKey) else { return nil }
        return try? JSONDecoder().decode(WatchLocalSnapshot.self, from: data)
    }

    func saveSnapshot(_ snapshot: WatchLocalSnapshot) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        defaults?.set(data, forKey: snapshotKey)
    }

    func clearSnapshot() {
        defaults?.removeObject(forKey: snapshotKey)
    }

    func loadOutbox() -> [WatchOutboxEntry] {
        guard let data = defaults?.data(forKey: outboxKey),
              let entries = try? JSONDecoder().decode([WatchOutboxEntry].self, from: data) else {
            return []
        }
        return entries
    }

    func saveOutbox(_ entries: [WatchOutboxEntry]) {
        guard let data = try? JSONEncoder().encode(entries) else { return }
        defaults?.set(data, forKey: outboxKey)
    }

    func enqueue(_ entry: WatchOutboxEntry) {
        var entries = loadOutbox()
        // Idempotent: replace existing op for same set/session.
        entries.removeAll { existing in
            existing.op == entry.op
                && existing.sessionId == entry.sessionId
                && existing.setId == entry.setId
        }
        entries.append(entry)
        saveOutbox(entries)
    }

    func removeOutboxEntry(id: String) {
        var entries = loadOutbox()
        entries.removeAll { $0.id == id }
        saveOutbox(entries)
    }
}
