import Foundation
import WatchConnectivity

/// Snapshot of the phone's active workout, mirrored over WCSession
/// `applicationContext`. The phone is the single source of truth; the watch
/// only renders this state and reports set-completion taps.
struct WorkoutState: Equatable {
    var active = false
    var sessionId = ""
    var exerciseName = ""
    var setNumber = 0
    var totalSets = 0
    var targetText = ""
    var setType = "normal" // normal | warmup | drop | failure
    var phase = "execution" // execution | rest | logging | complete
    var restEndsAt: Date?
    var exerciseEndsAt: Date?
    var nextUp: String?
    var supersetLabel: String?
}

final class WatchWorkoutSession: NSObject, ObservableObject, WCSessionDelegate {
    @Published var state = WorkoutState()
    @Published var isSendingCompletion = false
    /// Marks the (sessionId, setNumber) pair the user just tapped so the UI can
    /// disable the button until the phone pushes the next state.
    @Published var pendingCompletionKey: String?

    override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    // MARK: - WCSessionDelegate

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        DispatchQueue.main.async { [weak self] in
            self?.apply(context: session.receivedApplicationContext)
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        DispatchQueue.main.async { [weak self] in
            self?.apply(context: applicationContext)
        }
    }

    // MARK: - State

    private func apply(context: [String: Any]) {
        var next = WorkoutState()
        next.active = context["active"] as? Bool ?? false
        next.sessionId = context["sessionId"] as? String ?? ""
        next.exerciseName = context["exerciseName"] as? String ?? ""
        next.setNumber = context["setNumber"] as? Int ?? 0
        next.totalSets = context["totalSets"] as? Int ?? 0
        next.targetText = context["targetText"] as? String ?? ""
        next.setType = context["setType"] as? String ?? "normal"
        next.phase = context["phase"] as? String ?? "execution"
        next.nextUp = context["nextUp"] as? String
        next.supersetLabel = context["supersetLabel"] as? String
        if let restEndsAtEpoch = context["restEndsAt"] as? Double, restEndsAtEpoch > 0 {
            next.restEndsAt = Date(timeIntervalSince1970: restEndsAtEpoch)
        }
        if let exerciseEndsAtEpoch = context["exerciseEndsAt"] as? Double, exerciseEndsAtEpoch > 0 {
            next.exerciseEndsAt = Date(timeIntervalSince1970: exerciseEndsAtEpoch)
        }

        state = next
        // New state from the phone resolves any in-flight completion.
        pendingCompletionKey = nil
        isSendingCompletion = false
    }

    private var currentCompletionKey: String {
        "\(state.sessionId)#\(state.setNumber)"
    }

    var canCompleteSet: Bool {
        state.active && state.phase == "execution" && pendingCompletionKey != currentCompletionKey
    }

    // MARK: - Actions

    /// Sends the completion tap to the phone. Uses `sendMessage` when reachable
    /// for instant delivery, falling back to `transferUserInfo` which queues
    /// across connectivity drops (offline watch taps replay later).
    func completeCurrentSet() {
        guard canCompleteSet else { return }
        let payload: [String: Any] = [
            "type": "completeSet",
            "sessionId": state.sessionId,
            "setNumber": state.setNumber,
            "sentAt": Date().timeIntervalSince1970,
        ]

        pendingCompletionKey = currentCompletionKey
        isSendingCompletion = true

        let session = WCSession.default
        if session.isReachable {
            session.sendMessage(payload, replyHandler: { [weak self] _ in
                DispatchQueue.main.async { self?.isSendingCompletion = false }
            }, errorHandler: { [weak self] _ in
                session.transferUserInfo(payload)
                DispatchQueue.main.async { self?.isSendingCompletion = false }
            })
        } else {
            session.transferUserInfo(payload)
            isSendingCompletion = false
        }
    }
}
