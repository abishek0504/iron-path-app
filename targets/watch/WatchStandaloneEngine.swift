import Foundation
import WatchKit

/// Owns watch-controlled workout progression, local snapshot, and outbox flush.
@MainActor
final class WatchStandaloneEngine: ObservableObject {
    @Published private(set) var snapshot: WatchLocalSnapshot?
    @Published private(set) var isBusy = false
    @Published private(set) var statusMessage: String?
    @Published private(set) var pendingOutboxCount = 0
    @Published var showAdjustSheet = false
    @Published var adjustField: AdjustField = .weight
    @Published var adjustValue: Double = 0

    enum AdjustField: String {
        case weight
        case reps
        case duration
    }

    private let store = WatchSessionStore.shared
    private var restTimer: Timer?
    private var flushTask: Task<Void, Never>?

    var isActive: Bool {
        snapshot != nil && snapshot?.phase != .complete
    }

    init() {
        if let existing = store.loadSnapshot(), existing.controlDevice == .watch {
            snapshot = existing
            pendingOutboxCount = store.loadOutbox().count
            scheduleRestAutoAdvanceIfNeeded()
            flushOutbox()
        }
    }

    // MARK: - Start / resume

    func startTodaysWorkout() async {
        guard !isBusy else { return }
        isBusy = true
        statusMessage = nil
        defer { isBusy = false }

        guard let client = WatchSupabaseClient.makeIfPossible() else {
            statusMessage = "Sign in on iPhone first"
            return
        }

        do {
            if let active = try await client.fetchActiveSession() {
                let control = active["control_device"] as? String ?? "phone"
                guard let sessionId = active["id"] as? String else {
                    throw WatchSupabaseError.decoding
                }
                if control == "phone" {
                    statusMessage = "Workout active on iPhone"
                    return
                }
                try await loadSession(sessionId: sessionId, client: client)
                statusMessage = nil
                return
            }

            let sessionId = try await client.createWatchSessionFromTodayPlan()
            try await loadSession(sessionId: sessionId, client: client)
            statusMessage = nil
            flushOutbox()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private func loadSession(sessionId: String, client: WatchSupabaseClient) async throws {
        let bundle = try await client.fetchSessionBundle(sessionId: sessionId)
        var exercises: [WatchLocalExercise] = []
        for se in bundle.exercises {
            guard let seId = se["id"] as? String else { continue }
            let catalogId = se["exercise_id"] as? String
            let customId = se["custom_exercise_id"] as? String
            let nameKey = catalogId ?? customId ?? seId
            let mode: WatchExerciseMode =
                (catalogId != nil && bundle.timed.contains(catalogId!))
                || (customId != nil && bundle.timed.contains(customId!))
                ? .timed : .reps
            let setsRaw = bundle.setsByExercise[seId] ?? []
            let sets: [WatchLocalSet] = setsRaw.compactMap { row in
                guard let id = row["id"] as? String else { return nil }
                let performed = row["performed_at"] as? String
                return WatchLocalSet(
                    id: id,
                    setNumber: row["set_number"] as? Int ?? 1,
                    reps: row["reps"] as? Int,
                    weight: Self.doubleValue(row["weight"]),
                    durationSec: row["duration_sec"] as? Int,
                    rpe: row["rpe"] as? Int,
                    restSec: row["rest_sec"] as? Int,
                    setType: WatchSetType(rawValue: row["set_type"] as? String ?? "normal") ?? .normal,
                    performedAt: performed,
                    completed: performed != nil,
                    adjustedReps: nil,
                    adjustedWeight: nil,
                    adjustedDurationSec: nil
                )
            }
            exercises.append(
                WatchLocalExercise(
                    id: seId,
                    exerciseId: catalogId,
                    customExerciseId: customId,
                    name: bundle.names[nameKey] ?? "Exercise",
                    mode: mode,
                    sortOrder: se["sort_order"] as? Int ?? 0,
                    supersetGroup: se["superset_group"] as? Int,
                    restSec: se["rest_sec"] as? Int,
                    sets: sets
                )
            )
        }

        var exerciseIndex = 0
        var setIndex = 0
        var found = false
        for (ei, ex) in exercises.enumerated() {
            if let si = ex.sets.firstIndex(where: { !$0.completed }) {
                exerciseIndex = ei
                setIndex = si
                found = true
                break
            }
        }

        let snap = WatchLocalSnapshot(
            sessionId: sessionId,
            controlDevice: .watch,
            dayName: bundle.session["day_name"] as? String,
            templateId: bundle.session["template_id"] as? String,
            useImperial: bundle.useImperial,
            exercises: exercises,
            exerciseIndex: exerciseIndex,
            setIndex: setIndex,
            phase: found ? .execution : .complete,
            restEndsAt: nil,
            restStartedAt: nil,
            pendingRpeSetIndex: nil,
            pendingTimedDurationSec: nil,
            outboxPendingCount: store.loadOutbox().count
        )
        snapshot = snap
        persist()
    }

    // MARK: - Actions

    func completeCurrentSet(rpe: Int? = nil) {
        guard var snap = snapshot, snap.phase == .execution || snap.phase == .setRpe else { return }
        guard snap.exerciseIndex < snap.exercises.count else { return }
        var exercise = snap.exercises[snap.exerciseIndex]
        guard snap.setIndex < exercise.sets.count else { return }
        var set = exercise.sets[snap.setIndex]

        // Timed sets: collect RPE before committing.
        if snap.phase == .execution && exercise.mode == .timed {
            snap.pendingRpeSetIndex = snap.setIndex
            snap.pendingTimedDurationSec = set.effectiveDurationSec
            snap.phase = .setRpe
            snapshot = snap
            persist()
            return
        }

        if snap.phase == .setRpe {
            set.rpe = rpe
        }

        set.completed = true
        set.performedAt = ISO8601DateFormatter().string(from: Date())
        exercise.sets[snap.setIndex] = set
        snap.exercises[snap.exerciseIndex] = exercise
        snap.phase = .execution
        snap.pendingRpeSetIndex = nil
        snap.pendingTimedDurationSec = nil

        store.enqueue(
            WatchOutboxEntry(
                id: "markSetComplete:\(set.id)",
                op: .markSetComplete,
                sessionId: snap.sessionId,
                setId: set.id,
                payload: [
                    "reps": set.effectiveReps.map(String.init) ?? "",
                    "weight": set.effectiveWeight.map { String($0) } ?? "",
                    "duration_sec": set.effectiveDurationSec.map(String.init) ?? "",
                    "rpe": set.rpe.map(String.init) ?? "",
                ],
                createdAt: Date().timeIntervalSince1970
            )
        )

        switch WatchWorkoutFlow.findNextStep(exercises: snap.exercises, exerciseIndex: snap.exerciseIndex) {
        case .execute(let nextExerciseIndex, let nextSetIndex, let withRest):
            if withRest {
                let restSec = WatchWorkoutFlow.resolveRestSec(
                    exerciseRest: exercise.restSec,
                    setRest: set.restSec
                )
                if restSec > 0 {
                    let now = Date().timeIntervalSince1970
                    snap.restStartedAt = now
                    snap.restEndsAt = now + Double(restSec)
                    snap.phase = .rest
                    snap.exerciseIndex = nextExerciseIndex
                    snap.setIndex = nextSetIndex
                } else {
                    snap.exerciseIndex = nextExerciseIndex
                    snap.setIndex = nextSetIndex
                    snap.phase = .execution
                }
            } else {
                snap.exerciseIndex = nextExerciseIndex
                snap.setIndex = nextSetIndex
                snap.phase = .execution
            }
        case .complete:
            snap.phase = .complete
            store.enqueue(
                WatchOutboxEntry(
                    id: "completeSession:\(snap.sessionId)",
                    op: .completeSession,
                    sessionId: snap.sessionId,
                    setId: nil,
                    payload: [:],
                    createdAt: Date().timeIntervalSince1970
                )
            )
        }

        snap.outboxPendingCount = store.loadOutbox().count
        snapshot = snap
        persist()
        pendingOutboxCount = snap.outboxPendingCount
        WKInterfaceDevice.current().play(.click)
        scheduleRestAutoAdvanceIfNeeded()
        flushOutbox()
    }

    func skipRest() {
        guard var snap = snapshot, snap.phase == .rest else { return }
        snap.phase = .execution
        snap.restEndsAt = nil
        snap.restStartedAt = nil
        snapshot = snap
        persist()
        restTimer?.invalidate()
    }

    func extendRest(seconds: Int = 15) {
        guard var snap = snapshot, snap.phase == .rest, let ends = snap.restEndsAt else { return }
        snap.restEndsAt = ends + Double(seconds)
        snapshot = snap
        persist()
        scheduleRestAutoAdvanceIfNeeded()
    }

    func submitRpe(_ rpe: Int) {
        completeCurrentSet(rpe: rpe)
    }

    func beginAdjust() {
        guard let snap = snapshot,
              snap.phase == .execution,
              snap.exerciseIndex < snap.exercises.count else { return }
        let exercise = snap.exercises[snap.exerciseIndex]
        guard snap.setIndex < exercise.sets.count else { return }
        let set = exercise.sets[snap.setIndex]
        switch exercise.mode {
        case .timed:
            adjustField = .duration
            adjustValue = Double(set.effectiveDurationSec ?? 30)
        case .reps:
            if set.effectiveWeight != nil {
                adjustField = .weight
                adjustValue = set.effectiveWeight ?? 0
            } else {
                adjustField = .reps
                adjustValue = Double(set.effectiveReps ?? 8)
            }
        }
        showAdjustSheet = true
    }

    func cycleAdjustField() {
        guard let snap = snapshot,
              snap.exerciseIndex < snap.exercises.count else { return }
        let exercise = snap.exercises[snap.exerciseIndex]
        let set = exercise.sets[snap.setIndex]
        if exercise.mode == .timed {
            adjustField = .duration
            return
        }
        if adjustField == .weight {
            adjustField = .reps
            adjustValue = Double(set.effectiveReps ?? 8)
        } else {
            adjustField = .weight
            adjustValue = set.effectiveWeight ?? 0
        }
    }

    func applyAdjust() {
        guard var snap = snapshot,
              snap.phase == .execution,
              snap.exerciseIndex < snap.exercises.count else {
            showAdjustSheet = false
            return
        }
        var exercise = snap.exercises[snap.exerciseIndex]
        guard snap.setIndex < exercise.sets.count else {
            showAdjustSheet = false
            return
        }
        var set = exercise.sets[snap.setIndex]
        switch adjustField {
        case .weight:
            set.adjustedWeight = max(0, adjustValue)
        case .reps:
            set.adjustedReps = max(0, Int(adjustValue.rounded()))
        case .duration:
            set.adjustedDurationSec = max(1, Int(adjustValue.rounded()))
        }
        exercise.sets[snap.setIndex] = set
        snap.exercises[snap.exerciseIndex] = exercise
        snapshot = snap
        persist()
        showAdjustSheet = false
    }

    func stepAdjust(delta: Double) {
        adjustValue = max(0, adjustValue + delta)
    }

    func abandonLocal() {
        restTimer?.invalidate()
        store.clearSnapshot()
        snapshot = nil
        statusMessage = nil
    }

    // MARK: - Derived UI state

    func mirroredWorkoutState() -> WorkoutState {
        guard let snap = snapshot else { return WorkoutState() }
        var state = WorkoutState()
        state.active = snap.phase != .complete
        state.sessionId = snap.sessionId
        state.controlDevice = "watch"
        state.phase = snap.phase.rawValue
        state.progressText = "Exercise \(snap.exerciseIndex + 1) of \(snap.exercises.count)"

        if snap.phase == .complete {
            state.phase = "complete"
            state.exerciseName = "Done"
            return state
        }

        guard snap.exerciseIndex < snap.exercises.count else { return state }
        let exercise = snap.exercises[snap.exerciseIndex]
        let set = exercise.sets[min(snap.setIndex, max(0, exercise.sets.count - 1))]
        state.exerciseName = exercise.name
        state.setNumber = set.setNumber
        state.totalSets = exercise.sets.count
        state.setType = set.setType.rawValue
        state.targetText = WatchWorkoutFlow.formatTarget(
            set: set,
            mode: exercise.mode,
            useImperial: snap.useImperial
        )
        state.timedSetRpe = snap.phase == .setRpe
        if snap.phase == .setRpe, let held = snap.pendingTimedDurationSec {
            state.targetText = "\(held)s held"
        }
        if let ends = snap.restEndsAt {
            state.restEndsAt = Date(timeIntervalSince1970: ends)
        }
        let members = WatchWorkoutFlow.getSupersetMembers(
            exercises: snap.exercises,
            exerciseIndex: snap.exerciseIndex
        )
        if members.count > 1, let pos = members.firstIndex(of: snap.exerciseIndex) {
            state.supersetLabel = "Superset \(pos + 1) of \(members.count)"
        }
        if snap.setIndex + 1 < exercise.sets.count {
            state.nextUp = "Set \(snap.setIndex + 2)"
        } else if snap.exerciseIndex + 1 < snap.exercises.count {
            state.nextUp = snap.exercises[snap.exerciseIndex + 1].name
        }
        return state
    }

    // MARK: - Persistence / sync

    private func persist() {
        guard var snap = snapshot else { return }
        snap.outboxPendingCount = store.loadOutbox().count
        snapshot = snap
        store.saveSnapshot(snap)
        pendingOutboxCount = snap.outboxPendingCount
    }

    private func scheduleRestAutoAdvanceIfNeeded() {
        restTimer?.invalidate()
        guard let snap = snapshot, snap.phase == .rest, let ends = snap.restEndsAt else { return }
        let delay = max(0.1, ends - Date().timeIntervalSince1970)
        restTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            Task { @MainActor in
                self?.skipRest()
                WKInterfaceDevice.current().play(.notification)
            }
        }
    }

    func flushOutbox() {
        flushTask?.cancel()
        flushTask = Task { [weak self] in
            guard let self else { return }
            guard let client = WatchSupabaseClient.makeIfPossible() else { return }
            let entries = self.store.loadOutbox()
            for entry in entries {
                if Task.isCancelled { return }
                do {
                    switch entry.op {
                    case .markSetComplete:
                        guard let setId = entry.setId else { break }
                        try await client.markSetComplete(
                            setId: setId,
                            reps: Int(entry.payload["reps"] ?? ""),
                            weight: Double(entry.payload["weight"] ?? ""),
                            durationSec: Int(entry.payload["duration_sec"] ?? ""),
                            rpe: Int(entry.payload["rpe"] ?? "")
                        )
                    case .completeSession:
                        try await client.completeSession(
                            sessionId: entry.sessionId,
                            hkWorkoutUuid: entry.payload["hkWorkoutUuid"].flatMap { $0.isEmpty ? nil : $0 }
                        )
                        // Keep local complete UI until the user taps Done.
                    case .linkHkWorkout:
                        if let uuid = entry.payload["hkWorkoutUuid"], !uuid.isEmpty {
                            try await client.patchJSON(
                                path: "/rest/v1/v2_workout_sessions?id=eq.\(entry.sessionId)",
                                body: ["hk_workout_uuid": uuid]
                            )
                        }
                    }
                    self.store.removeOutboxEntry(id: entry.id)
                } catch {
                    #if DEBUG
                    NSLog("IronPath watch outbox flush failed: %@", error.localizedDescription)
                    #endif
                    break
                }
            }
            let pending = self.store.loadOutbox().count
            await MainActor.run { [weak self] in
                guard let self else { return }
                self.pendingOutboxCount = pending
                if var snap = self.snapshot {
                    snap.outboxPendingCount = pending
                    self.snapshot = snap
                    self.store.saveSnapshot(snap)
                }
            }
        }
    }

    func enqueueHkUuid(_ uuid: String) {
        guard let snap = snapshot else { return }
        store.enqueue(
            WatchOutboxEntry(
                id: "linkHk:\(snap.sessionId)",
                op: .linkHkWorkout,
                sessionId: snap.sessionId,
                setId: nil,
                payload: ["hkWorkoutUuid": uuid],
                createdAt: Date().timeIntervalSince1970
            )
        )
        pendingOutboxCount = store.loadOutbox().count
        flushOutbox()
    }

    private static func doubleValue(_ value: Any?) -> Double? {
        if let d = value as? Double { return d }
        if let i = value as? Int { return Double(i) }
        if let n = value as? NSNumber { return n.doubleValue }
        return nil
    }
}
