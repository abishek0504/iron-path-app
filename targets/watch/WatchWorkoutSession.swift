import Foundation
import WatchConnectivity
import WatchKit

private let restExtendSec = 15
private let completionRetrySec: TimeInterval = 5
private let authRequestTimeoutSec: TimeInterval = 4

private let workoutContextMessageType = "workoutContext"
private let watchContextMessageType = "watchContext"
private let watchAuthMessageType = "auth"
private let watchAuthClearMessageType = "clearAuth"
private let watchAuthRequestMessageType = "requestAuth"
private let requestTakeoverMessageType = "requestTakeover"
private let yieldControlMessageType = "yieldControl"

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

private func doubleFromPayload(_ value: Any?) -> Double? {
    if let doubleValue = value as? Double, doubleValue.isFinite { return doubleValue }
    if let number = value as? NSNumber { return number.doubleValue }
    if let intValue = value as? Int { return Double(intValue) }
    return nil
}

enum CompletionSyncStatus: Equatable {
    case idle
    case sending
    case sent
    case queued
    case retry
}

private struct MirrorDraft {
    var sessionId: String
    var setNumber: Int
    var weight: Double?
    var reps: Int?
    var durationSec: Int?
    var rpe: Int?
}

/// Phone-mirrored snapshot OR projection from the local standalone engine.
struct WorkoutState: Equatable {
    var active = false
    var sessionId = ""
    /// phone = mirror remote-control; watch = local engine owns progression.
    var controlDevice = "phone"
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
    var rpeText: String?
}

@MainActor
final class WatchWorkoutSession: NSObject, ObservableObject {
    @Published var state = WorkoutState()
    @Published var isSendingCompletion = false
    @Published var pendingCompletionKey: String?
    @Published var completionSyncStatus: CompletionSyncStatus = .idle
    @Published var phoneReachable = false

    let healthManager = WatchHealthWorkoutManager()
    let standalone = WatchStandaloneEngine()

    private var completionRetryTimer: Timer?
    private var previousSetNumber = 0
    private var previousPhase = "execution"
    private let sessionBridge = WatchSessionBridge()
    private var mirrorDraft: MirrorDraft?

    var isStandaloneActive: Bool {
        standalone.isActive
    }

    override init() {
        super.init()
        healthManager.onWorkoutEnded = { [weak self] sessionId, uuid in
            Task { @MainActor in
                guard let self else { return }
                if self.standalone.snapshot?.sessionId == sessionId {
                    self.standalone.enqueueHkUuid(uuid)
                }
            }
        }
        standalone.pullAuthFromPhone = { [weak self] in
            await self?.requestAuthFromPhone(force: true)
        }
        standalone.isPhoneReachable = { [weak self] in
            self?.phoneReachable ?? false
        }
        standalone.isPhoneMirrorActive = { [weak self] in
            guard let self else { return false }
            return self.state.active && self.state.controlDevice == "phone"
        }
        standalone.onSnapshotChange = { [weak self] in
            self?.publishStandaloneIfNeeded()
        }
        standalone.onMirrorAdjust = { [weak self] field, value in
            self?.applyMirrorAdjust(field: field, value: value)
        }
        standalone.onMirrorCycleAdjust = { [weak self] in
            self?.cycleMirrorAdjust()
        }

        sessionBridge.onContext = { [weak self] context in
            Task { @MainActor in
                self?.apply(context: context)
            }
        }
        sessionBridge.onAuth = { [weak self] in
            Task { @MainActor in
                self?.standalone.authDidUpdate()
            }
        }
        sessionBridge.onReachable = { [weak self] reachable in
            Task { @MainActor in
                guard let self else { return }
                self.phoneReachable = reachable
                if reachable {
                    self.standalone.flushOutbox()
                }
            }
        }
        sessionBridge.onTakeover = { [weak self] sessionId, reply in
            Task { @MainActor in
                await self?.handleTakeoverRequest(sessionId: sessionId, reply: reply)
            }
        }
        sessionBridge.activate()
        publishStandaloneIfNeeded()
    }

    func publishStandaloneIfNeededPublic() {
        publishStandaloneIfNeeded()
    }

    func resetToIdle() {
        state = WorkoutState()
        mirrorDraft = nil
        completionSyncStatus = .idle
        pendingCompletionKey = nil
        isSendingCompletion = false
        cancelCompletionRetryTimer()
        writeComplicationSnapshot(from: state)
        healthManager.syncWorkoutState(active: false, sessionId: "", phase: "execution")
    }

    private func publishStandaloneIfNeeded() {
        guard standalone.isActive || standalone.snapshot?.phase == .complete else { return }
        let next = standalone.mirroredWorkoutState()
        state = next
        writeComplicationSnapshot(from: next)
        let hkActive = next.phase != "complete" && next.active
        healthManager.syncWorkoutState(
            active: hkActive,
            sessionId: next.sessionId,
            phase: next.phase
        )
        pushWatchContextToPhone(next)
    }

    private func pushWatchContextToPhone(_ next: WorkoutState) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        var context: [String: Any] = [
            "type": watchContextMessageType,
            "active": next.active || next.phase == "complete",
            "sessionId": next.sessionId,
            "controlDevice": "watch",
            "exerciseName": next.exerciseName,
            "setNumber": next.setNumber,
            "totalSets": next.totalSets,
            "targetText": next.targetText,
            "setType": next.setType,
            "phase": next.phase,
            "progressText": next.progressText,
            "timedSetRpe": next.timedSetRpe,
            "updatedAt": Date().timeIntervalSince1970,
        ]
        if let nextUp = next.nextUp { context["nextUp"] = nextUp }
        if let superset = next.supersetLabel { context["supersetLabel"] = superset }
        if let rpeText = next.rpeText { context["rpeText"] = rpeText }
        if let rest = next.restEndsAt {
            context["restEndsAt"] = rest.timeIntervalSince1970
        }
        try? session.updateApplicationContext(context)
        if session.isReachable {
            session.sendMessage(context, replyHandler: nil, errorHandler: { _ in })
        }
    }

    func requestAuthFromPhone(force: Bool) async {
        await sessionBridge.requestAuth(force: force, timeout: authRequestTimeoutSec)
    }

    // MARK: - State

    private func apply(context: [String: Any]) {
        let controlDevice = context["controlDevice"] as? String ?? "phone"
        if standalone.isActive || standalone.snapshot?.phase == .complete {
            if controlDevice != "watch" {
                return
            }
        }
        if controlDevice == "watch" {
            return
        }

        let priorPendingKey = pendingCompletionKey
        let priorSetNumber = state.setNumber
        let priorPhase = state.phase
        let priorSession = state.sessionId

        var next = state
        next.controlDevice = controlDevice

        if context.keys.contains("active") {
            next.active = (context["active"] as? Bool) ?? (context["active"] as? NSNumber)?.boolValue ?? false
            if !next.active {
                next = WorkoutState()
                next.active = false
                next.controlDevice = controlDevice
                if let sessionId = context["sessionId"] as? String {
                    next.sessionId = sessionId
                }
                state = next
                mirrorDraft = nil
                writeComplicationSnapshot(from: next)
                completionSyncStatus = .idle
                pendingCompletionKey = nil
                isSendingCompletion = false
                cancelCompletionRetryTimer()
                healthManager.syncWorkoutState(active: false, sessionId: "", phase: "execution")
                return
            }
        }
        if let sessionId = context["sessionId"] as? String {
            next.sessionId = sessionId
        }
        if let exerciseName = context["exerciseName"] as? String {
            next.exerciseName = exerciseName
        }
        if let setNumber = intFromPayload(context["setNumber"]) {
            next.setNumber = setNumber
        }
        if let totalSets = intFromPayload(context["totalSets"]) {
            next.totalSets = totalSets
        }
        if context.keys.contains("targetText") {
            next.targetText = context["targetText"] as? String ?? ""
        }
        if context.keys.contains("lastTimeText") {
            next.lastTimeText = context["lastTimeText"] as? String ?? ""
        }
        if context.keys.contains("progressText") {
            next.progressText = context["progressText"] as? String ?? ""
        }
        if let setType = context["setType"] as? String {
            next.setType = setType
        }
        if let phase = context["phase"] as? String {
            next.phase = phase
        }
        if context.keys.contains("timedSetRpe") {
            next.timedSetRpe = (context["timedSetRpe"] as? Bool)
                ?? (context["timedSetRpe"] as? NSNumber)?.boolValue
                ?? false
        }
        if context.keys.contains("nextUp") {
            next.nextUp = context["nextUp"] as? String
        }
        if context.keys.contains("supersetLabel") {
            next.supersetLabel = context["supersetLabel"] as? String
        }
        if context.keys.contains("rpeText") {
            next.rpeText = context["rpeText"] as? String
        }
        if context.keys.contains("exerciseEndsAt") {
            if let exerciseEndsAtEpoch = doubleFromPayload(context["exerciseEndsAt"]), exerciseEndsAtEpoch > 0 {
                next.exerciseEndsAt = Date(timeIntervalSince1970: exerciseEndsAtEpoch)
            } else {
                next.exerciseEndsAt = nil
            }
        } else {
            next.exerciseEndsAt = nil
        }
        if context.keys.contains("restEndsAt") {
            if let restEndsAtEpoch = doubleFromPayload(context["restEndsAt"]), restEndsAtEpoch > 0 {
                next.restEndsAt = Date(timeIntervalSince1970: restEndsAtEpoch)
            } else {
                next.restEndsAt = nil
            }
        } else if next.phase != "rest" {
            next.restEndsAt = nil
        }

        if let draft = mirrorDraft, (draft.sessionId != next.sessionId || draft.setNumber != next.setNumber) {
            mirrorDraft = nil
        }
        if let draft = mirrorDraft, draft.sessionId == next.sessionId, draft.setNumber == next.setNumber {
            next = overlayDraft(draft, on: next)
        }

        #if DEBUG
        let updatedAt = doubleFromPayload(context["updatedAt"]) ?? 0
        NSLog(
            "IronPath watch apply phase=%@ set=%d/%d active=%@ updatedAt=%.0f",
            next.phase,
            next.setNumber,
            next.totalSets,
            next.active ? "yes" : "no",
            updatedAt
        )
        #endif

        state = next
        writeComplicationSnapshot(from: next)

        if priorPendingKey != nil {
            let advanced =
                next.setNumber != priorSetNumber
                || next.phase != priorPhase
                || next.phase != "execution"
                || next.sessionId != priorSession
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

    private func overlayDraft(_ draft: MirrorDraft, on state: WorkoutState) -> WorkoutState {
        var next = state
        if let rpe = draft.rpe {
            next.rpeText = "RPE \(rpe)"
        }
        if let duration = draft.durationSec {
            next.targetText = "\(duration)s hold"
            return next
        }
        if draft.weight != nil || draft.reps != nil {
            let reps = draft.reps ?? 0
            if let weight = draft.weight {
                if weight == 0 {
                    next.targetText = "Bodyweight × \(reps)"
                } else {
                    let weightText = weight == floor(weight) ? String(Int(weight)) : String(format: "%g", weight)
                    next.targetText = "\(weightText) × \(reps)"
                }
            } else if reps > 0 {
                next.targetText = "\(reps) reps"
            }
        }
        return next
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
        if standalone.isActive {
            return state.phase == "execution"
        }
        guard state.active, state.phase == "execution" else { return false }
        if pendingCompletionKey != currentCompletionKey { return true }
        return completionSyncStatus == .retry || completionSyncStatus == .queued
    }

    // MARK: - Actions

    func skipRest() {
        if standalone.isActive {
            standalone.skipRest()
            publishStandaloneIfNeeded()
            return
        }
        guard state.active, state.phase == "rest", !state.sessionId.isEmpty else { return }
        sendEvent([
            "type": "skipRest",
            "sessionId": state.sessionId,
            "sentAt": Date().timeIntervalSince1970,
        ])
    }

    func extendRest(seconds: Int = restExtendSec) {
        if standalone.isActive {
            standalone.extendRest(seconds: seconds)
            publishStandaloneIfNeeded()
            return
        }
        guard state.active, state.phase == "rest", !state.sessionId.isEmpty else { return }
        sendEvent([
            "type": "extendRest",
            "sessionId": state.sessionId,
            "seconds": seconds,
            "sentAt": Date().timeIntervalSince1970,
        ])
    }

    func submitRpe(_ rpe: Int) {
        if standalone.isActive || standalone.snapshot?.phase == .setRpe {
            standalone.submitRpe(rpe)
            publishStandaloneIfNeeded()
            return
        }
        guard state.active, state.phase == "setRpe", state.timedSetRpe, !state.sessionId.isEmpty else {
            return
        }
        var draft = upsertMirrorDraft()
        draft.rpe = rpe
        mirrorDraft = draft
        sendEvent([
            "type": "submitRpe",
            "sessionId": state.sessionId,
            "setNumber": state.setNumber,
            "rpe": rpe,
            "sentAt": Date().timeIntervalSince1970,
        ])
    }

    func completeCurrentSet() {
        if standalone.isActive {
            standalone.completeCurrentSet()
            publishStandaloneIfNeeded()
            completionSyncStatus = standalone.pendingOutboxCount > 0 ? .queued : .sent
            return
        }
        guard canCompleteSet else { return }

        WKInterfaceDevice.current().play(.click)

        var payload: [String: Any] = [
            "type": "completeSet",
            "sessionId": state.sessionId,
            "setNumber": state.setNumber,
            "sentAt": Date().timeIntervalSince1970,
        ]
        if let draft = mirrorDraft, draft.sessionId == state.sessionId, draft.setNumber == state.setNumber {
            if let reps = draft.reps { payload["reps"] = reps }
            if let weight = draft.weight { payload["weight"] = weight }
            if let duration = draft.durationSec { payload["durationSec"] = duration }
            if let rpe = draft.rpe { payload["rpe"] = rpe }
        }

        pendingCompletionKey = currentCompletionKey
        isSendingCompletion = true
        completionSyncStatus = .sending
        scheduleCompletionRetryTimer()

        let session = WCSession.default
        if session.isReachable {
            session.sendMessage(payload, replyHandler: { [weak self] reply in
                Task { @MainActor in
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
                Task { @MainActor in
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

    func startStandaloneWorkout() {
        Task {
            let needsAuth = WatchSharedAuth.load() == nil || WatchSharedAuth.credentialsNeedRefresh()
            if needsAuth {
                await requestAuthFromPhone(force: true)
            }
            await standalone.startTodaysWorkout()
            publishStandaloneIfNeeded()
        }
    }

    func beginAdjustTargets() {
        if standalone.isActive {
            standalone.beginAdjust()
            return
        }
        guard state.active, state.phase == "execution" else { return }
        seedMirrorAdjustFields()
        standalone.showAdjustSheet = true
    }

    func cycleAdjustTargets() {
        standalone.cycleAdjustField()
    }

    private func seedMirrorAdjustFields() {
        let timed = state.exerciseEndsAt != nil || state.targetText.contains("hold")
        let draft = mirrorDraft
        if timed {
            standalone.adjustField = .duration
            standalone.adjustValue = Double(draft?.durationSec ?? 30)
        } else if draft?.weight != nil {
            standalone.adjustField = .weight
            standalone.adjustValue = draft?.weight ?? 0
        } else {
            standalone.adjustField = .reps
            standalone.adjustValue = Double(draft?.reps ?? 8)
        }
    }

    private func cycleMirrorAdjust() {
        let timed = state.exerciseEndsAt != nil || state.targetText.contains("hold")
        let draft = upsertMirrorDraft()
        if timed {
            if standalone.adjustField == .duration {
                standalone.adjustField = .rpe
                standalone.adjustValue = Double(draft.rpe ?? WatchStandaloneEngine.defaultStrengthRpe)
            } else {
                standalone.adjustField = .duration
                standalone.adjustValue = Double(draft.durationSec ?? 30)
            }
            return
        }
        switch standalone.adjustField {
        case .weight:
            standalone.adjustField = .reps
            standalone.adjustValue = Double(draft.reps ?? 8)
        case .reps:
            standalone.adjustField = .rpe
            standalone.adjustValue = Double(draft.rpe ?? WatchStandaloneEngine.defaultStrengthRpe)
        default:
            standalone.adjustField = .weight
            standalone.adjustValue = draft.weight ?? 0
        }
    }

    private func applyMirrorAdjust(field: WatchStandaloneEngine.AdjustField, value: Double) {
        var draft = upsertMirrorDraft()
        switch field {
        case .weight:
            draft.weight = max(0, value)
        case .reps:
            draft.reps = max(0, Int(value.rounded()))
        case .duration:
            draft.durationSec = max(1, Int(value.rounded()))
        case .rpe:
            draft.rpe = min(10, max(1, Int(value.rounded())))
        }
        mirrorDraft = draft
        state = overlayDraft(draft, on: state)
    }

    @discardableResult
    private func upsertMirrorDraft() -> MirrorDraft {
        if let draft = mirrorDraft, draft.sessionId == state.sessionId, draft.setNumber == state.setNumber {
            return draft
        }
        let draft = MirrorDraft(sessionId: state.sessionId, setNumber: state.setNumber)
        mirrorDraft = draft
        return draft
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

    private func handleTakeoverRequest(sessionId: String, reply: (([String: Any]) -> Void)?) async {
        guard standalone.snapshot?.sessionId == sessionId || state.sessionId == sessionId else {
            reply?(["ok": false])
            return
        }
        standalone.flushOutbox()
        try? await Task.sleep(nanoseconds: 700_000_000)
        let pending = standalone.drainOutboxEntries()
        let writes: [[String: Any]] = pending.compactMap { entry in
            guard entry.op == .markSetComplete, let setId = entry.setId else { return nil }
            var row: [String: Any] = [
                "op": entry.op.rawValue,
                "setId": setId,
                "sessionId": entry.sessionId,
            ]
            for (key, value) in entry.payload where !value.isEmpty {
                row[key] = value
            }
            return row
        }
        standalone.yieldToPhone()
        resetToIdle()
        var response: [String: Any] = [
            "ok": true,
            "type": yieldControlMessageType,
            "sessionId": sessionId,
            "pendingWrites": writes,
        ]
        if let reply {
            reply(response)
        } else {
            sendEvent(response)
        }
    }

    private func scheduleCompletionRetryTimer() {
        cancelCompletionRetryTimer()
        completionRetryTimer = Timer.scheduledTimer(withTimeInterval: completionRetrySec, repeats: false) {
            [weak self] _ in
            Task { @MainActor in
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

/// Nonisolated WCSession delegate that forwards context onto the main actor.
private final class WatchSessionBridge: NSObject, WCSessionDelegate {
    var onContext: (([String: Any]) -> Void)?
    var onAuth: (() -> Void)?
    var onReachable: ((Bool) -> Void)?
    var onTakeover: ((String, (([String: Any]) -> Void)?) -> Void)?

    private let waiterLock = NSLock()
    private var authWaiters: [CheckedContinuation<Void, Never>] = []

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func requestAuth(force: Bool, timeout: TimeInterval) async {
        await withCheckedContinuation { continuation in
            waiterLock.lock()
            authWaiters.append(continuation)
            waiterLock.unlock()
            requestAuthIfNeeded(WCSession.default, force: force)
            DispatchQueue.global().asyncAfter(deadline: .now() + timeout) { [weak self] in
                self?.resumeAuthWaiters()
            }
        }
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        ingest(session.receivedApplicationContext)
        onReachable?(session.isReachable)
        if activationState == .activated {
            requestAuthIfNeeded(session, force: WatchSharedAuth.load() == nil || WatchSharedAuth.credentialsNeedRefresh())
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        ingest(applicationContext)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        ingest(message)
    }

    func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        if message["type"] as? String == requestTakeoverMessageType {
            let sessionId = message["sessionId"] as? String ?? ""
            onTakeover?(sessionId, replyHandler)
            return
        }
        ingest(message)
        replyHandler(["ok": true])
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        ingest(userInfo)
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        onReachable?(session.isReachable)
        requestAuthIfNeeded(
            session,
            force: WatchSharedAuth.load() == nil || WatchSharedAuth.credentialsNeedRefresh()
        )
    }

    private func ingest(_ payload: [String: Any]) {
        guard !payload.isEmpty else { return }
        applyAuthIfPresent(payload)

        let type = payload["type"] as? String
        if type == watchAuthMessageType
            || type == watchAuthClearMessageType
            || type == watchAuthRequestMessageType {
            return
        }
        if type == requestTakeoverMessageType {
            let sessionId = payload["sessionId"] as? String ?? ""
            onTakeover?(sessionId, nil)
            return
        }
        if payload.keys.contains("active")
            || payload.keys.contains("sessionId")
            || type == workoutContextMessageType {
            onContext?(payload)
        }
    }

    private func applyAuthIfPresent(_ payload: [String: Any]) {
        if payload["type"] as? String == watchAuthClearMessageType {
            var clearRecord = WatchSharedAuth.dictionary(from: payload["auth"]) ?? ["cleared": true]
            if clearRecord["cleared"] == nil {
                clearRecord["cleared"] = true
            }
            if WatchSharedAuth.save(from: clearRecord) {
                onAuth?()
                resumeAuthWaiters()
                if WCSession.default.activationState == .activated {
                    requestAuthIfNeeded(WCSession.default, force: true)
                }
            }
            return
        }
        guard let auth = WatchSharedAuth.dictionary(from: payload["auth"]) else { return }
        if WatchSharedAuth.save(from: auth) {
            onAuth?()
            resumeAuthWaiters()
        }
    }

    private func requestAuthIfNeeded(_ session: WCSession, force: Bool) {
        if !force, WatchSharedAuth.load() != nil, !WatchSharedAuth.credentialsNeedRefresh() {
            resumeAuthWaiters()
            return
        }
        guard session.activationState == .activated else { return }
        let payload: [String: Any] = ["type": watchAuthRequestMessageType]
        if session.isReachable {
            session.sendMessage(payload, replyHandler: { [weak self] reply in
                self?.ingest(reply)
            }, errorHandler: { error in
                NSLog("IronPath watch requestAuth failed: %@", error.localizedDescription)
                session.transferUserInfo(payload)
            })
        } else {
            session.transferUserInfo(payload)
        }
    }

    private func resumeAuthWaiters() {
        waiterLock.lock()
        let waiters = authWaiters
        authWaiters.removeAll()
        waiterLock.unlock()
        for waiter in waiters {
            waiter.resume()
        }
    }
}
