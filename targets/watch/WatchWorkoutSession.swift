import Foundation
import WatchConnectivity

private let restExtendSec = 15
private let completionRetrySec: TimeInterval = 15

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

enum CompletionSyncStatus: Equatable {
    case idle
    case sending
    case sent
    case queued
    case retry
}

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
    var lastTimeText = ""
    var progressText = ""
    var setType = "normal" // normal | warmup | drop | failure
    var phase = "execution" // execution | rest | logging | complete | setRpe
    var timedSetRpe = false
    var restEndsAt: Date?
    var exerciseEndsAt: Date?
    var nextUp: String?
    var supersetLabel: String?
}

final class WatchWorkoutSession: NSObject, ObservableObject, WCSessionDelegate {
    @Published var state = WorkoutState()
    @Published var isSendingCompletion = false
    @Published var pendingCompletionKey: String?
    @Published var completionSyncStatus: CompletionSyncStatus = .idle

    let healthManager = WatchHealthWorkoutManager()

    private var completionRetryTimer: Timer?
    private var previousSetNumber = 0
    private var previousPhase = "execution"

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
        let priorPendingKey = pendingCompletionKey
        let priorSetNumber = state.setNumber
        let priorPhase = state.phase

        var next = WorkoutState()
        next.active = context["active"] as? Bool ?? false
        next.sessionId = context["sessionId"] as? String ?? ""
        next.exerciseName = context["exerciseName"] as? String ?? ""
        if let setNumber = intFromPayload(context["setNumber"]) {
            next.setNumber = setNumber
        }
        if let totalSets = intFromPayload(context["totalSets"]) {
            next.totalSets = totalSets
        }
        next.targetText = context["targetText"] as? String ?? ""
        next.lastTimeText = context["lastTimeText"] as? String ?? ""
        next.progressText = context["progressText"] as? String ?? ""
        next.setType = context["setType"] as? String ?? "normal"
        next.phase = context["phase"] as? String ?? "execution"
        next.timedSetRpe = context["timedSetRpe"] as? Bool ?? false
        next.nextUp = context["nextUp"] as? String
        next.supersetLabel = context["supersetLabel"] as? String
        if let restEndsAtEpoch = context["restEndsAt"] as? Double, restEndsAtEpoch > 0 {
            next.restEndsAt = Date(timeIntervalSince1970: restEndsAtEpoch)
        }
        if let exerciseEndsAtEpoch = context["exerciseEndsAt"] as? Double, exerciseEndsAtEpoch > 0 {
            next.exerciseEndsAt = Date(timeIntervalSince1970: exerciseEndsAtEpoch)
        }

        state = next
        writeComplicationSnapshot(from: next)

        if priorPendingKey != nil {
            let advanced =
                next.setNumber != priorSetNumber
                || next.phase != priorPhase
                || next.phase != "execution"
            if advanced {
                completionSyncStatus = .sent
                pendingCompletionKey = nil
                isSendingCompletion = false
                cancelCompletionRetryTimer()
            }
        } else if completionSyncStatus == .sent {
            // Keep brief sent feedback until next action.
        } else if completionSyncStatus != .queued {
            completionSyncStatus = .idle
        }

        previousSetNumber = next.setNumber
        previousPhase = next.phase

        healthManager.syncWorkoutState(
            active: next.active,
            sessionId: next.sessionId,
            phase: next.phase
        )
    }

    private func writeComplicationSnapshot(from state: WorkoutState) {
        let snapshot = ComplicationSnapshot(
            active: state.active,
            phase: state.phase,
            exerciseName: state.exerciseName,
            restEndsAt: state.restEndsAt?.timeIntervalSince1970
        )
        guard let defaults = UserDefaults(suiteName: complicationAppGroupId),
              let data = try? JSONEncoder().encode(snapshot) else {
            return
        }
        defaults.set(data, forKey: "complicationSnapshot")
    }

    private var currentCompletionKey: String {
        "\(state.sessionId)#\(state.setNumber)"
    }

    var canCompleteSet: Bool {
        state.active
            && state.phase == "execution"
            && (pendingCompletionKey != currentCompletionKey || completionSyncStatus == .retry)
    }

    // MARK: - Actions

    func skipRest() {
        guard state.active, state.phase == "rest", !state.sessionId.isEmpty else { return }
        sendEvent([
            "type": "skipRest",
            "sessionId": state.sessionId,
            "sentAt": Date().timeIntervalSince1970,
        ])
    }

    func extendRest(seconds: Int = restExtendSec) {
        guard state.active, state.phase == "rest", !state.sessionId.isEmpty else { return }
        sendEvent([
            "type": "extendRest",
            "sessionId": state.sessionId,
            "seconds": seconds,
            "sentAt": Date().timeIntervalSince1970,
        ])
    }

    func submitRpe(_ rpe: Int) {
        guard state.active, state.phase == "setRpe", state.timedSetRpe, !state.sessionId.isEmpty else {
            return
        }
        sendEvent([
            "type": "submitRpe",
            "sessionId": state.sessionId,
            "setNumber": state.setNumber,
            "rpe": rpe,
            "sentAt": Date().timeIntervalSince1970,
        ])
    }

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
        completionSyncStatus = .sending
        scheduleCompletionRetryTimer()

        let session = WCSession.default
        if session.isReachable {
            session.sendMessage(payload, replyHandler: { [weak self] reply in
                DispatchQueue.main.async {
                    guard let self else { return }
                    self.isSendingCompletion = false
                    if let ok = reply["ok"] as? Bool, ok {
                        if self.completionSyncStatus == .sending {
                            self.completionSyncStatus = .sent
                        }
                    }
                }
            }, errorHandler: { [weak self] _ in
                session.transferUserInfo(payload)
                DispatchQueue.main.async {
                    self?.isSendingCompletion = false
                    self?.completionSyncStatus = .queued
                }
            })
        } else {
            session.transferUserInfo(payload)
            isSendingCompletion = false
            completionSyncStatus = .queued
        }
    }

    private func sendEvent(_ payload: [String: Any]) {
        let session = WCSession.default
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil, errorHandler: { _ in
                session.transferUserInfo(payload)
            })
        } else {
            session.transferUserInfo(payload)
        }
    }

    private func scheduleCompletionRetryTimer() {
        cancelCompletionRetryTimer()
        completionRetryTimer = Timer.scheduledTimer(withTimeInterval: completionRetrySec, repeats: false) {
            [weak self] _ in
            DispatchQueue.main.async {
                guard let self, self.pendingCompletionKey != nil else { return }
                self.completionSyncStatus = .retry
                self.isSendingCompletion = false
            }
        }
    }

    private func cancelCompletionRetryTimer() {
        completionRetryTimer?.invalidate()
        completionRetryTimer = nil
    }
}
