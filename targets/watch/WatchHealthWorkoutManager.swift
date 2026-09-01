import Foundation
import HealthKit
import WatchConnectivity

/// Manages an HKWorkoutSession on watch for live heart rate during strength training.
final class WatchHealthWorkoutManager: NSObject, ObservableObject {
    @Published var heartRateBpm: Int?
    @Published var isCollecting = false

    /// Invoked on the main queue when a watch HK workout finishes (for standalone outbox).
    var onWorkoutEnded: ((String, String) -> Void)?

    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var activeSessionId = ""
    private var lastHrSentAt: TimeInterval = 0
    private let hrSendInterval: TimeInterval = 5

    private var heartRateType: HKQuantityType? {
        HKQuantityType.quantityType(forIdentifier: .heartRate)
    }

    func syncWorkoutState(active: Bool, sessionId: String, phase: String) {
        if active, !sessionId.isEmpty, phase != "complete" {
            if activeSessionId != sessionId {
                startCollection(sessionId: sessionId)
            }
        } else if isCollecting {
            endCollection()
        }
    }

    private func startCollection(sessionId: String) {
        if session != nil {
            if activeSessionId == sessionId { return }
            endCollection()
        }

        guard HKHealthStore.isHealthDataAvailable(),
              let heartRateType else {
            return
        }

        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .traditionalStrengthTraining
        configuration.locationType = .indoor

        Task { @MainActor in
            do {
                try await healthStore.requestAuthorization(toShare: [heartRateType], read: [heartRateType])

                let workoutSession = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
                let workoutBuilder = workoutSession.associatedWorkoutBuilder()
                workoutBuilder.dataSource = HKLiveWorkoutDataSource(
                    healthStore: healthStore,
                    workoutConfiguration: configuration
                )

                workoutSession.delegate = self
                workoutBuilder.delegate = self

                session = workoutSession
                builder = workoutBuilder
                activeSessionId = sessionId

                let startDate = Date()
                workoutSession.startActivity(with: startDate)
                workoutBuilder.beginCollection(withStart: startDate) { [weak self] _, error in
                    if error != nil {
                        DispatchQueue.main.async { self?.isCollecting = false }
                        return
                    }
                    DispatchQueue.main.async { self?.isCollecting = true }
                }
            } catch {
                isCollecting = false
            }
        }
    }

    private func endCollection() {
        guard let workoutSession = session, let workoutBuilder = builder else {
            reset()
            return
        }

        let endDate = Date()
        workoutSession.end()
        workoutBuilder.endCollection(withEnd: endDate) { [weak self] _, _ in
            workoutBuilder.finishWorkout { workout, _ in
                if let uuid = workout?.uuid.uuidString {
                    self?.sendWorkoutEnded(uuid: uuid)
                }
                DispatchQueue.main.async { self?.reset() }
            }
        }
    }

    private func reset() {
        session = nil
        builder = nil
        activeSessionId = ""
        isCollecting = false
        heartRateBpm = nil
    }

    private func sendHeartRate(bpm: Int) {
        guard !activeSessionId.isEmpty else { return }
        let now = Date().timeIntervalSince1970
        guard now - lastHrSentAt >= hrSendInterval else { return }
        lastHrSentAt = now

        let payload: [String: Any] = [
            "type": "heartRate",
            "sessionId": activeSessionId,
            "bpm": bpm,
            "timestamp": now,
        ]

        let wcSession = WCSession.default
        if wcSession.isReachable {
            wcSession.sendMessage(payload, replyHandler: nil, errorHandler: nil)
        } else {
            wcSession.transferUserInfo(payload)
        }
    }

    private func sendWorkoutEnded(uuid: String) {
        guard !activeSessionId.isEmpty else { return }
        let sessionId = activeSessionId
        let payload: [String: Any] = [
            "type": "workoutEnded",
            "sessionId": sessionId,
            "hkWorkoutUuid": uuid,
            "timestamp": Date().timeIntervalSince1970,
        ]

        let wcSession = WCSession.default
        if wcSession.isReachable {
            wcSession.sendMessage(payload, replyHandler: nil, errorHandler: nil)
        } else {
            wcSession.transferUserInfo(payload)
        }

        DispatchQueue.main.async { [weak self] in
            self?.onWorkoutEnded?(sessionId, uuid)
        }
    }
}

extension WatchHealthWorkoutManager: HKWorkoutSessionDelegate {
    func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {}

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        DispatchQueue.main.async { self.reset() }
    }
}

extension WatchHealthWorkoutManager: HKLiveWorkoutBuilderDelegate {
    func workoutBuilder(
        _ workoutBuilder: HKLiveWorkoutBuilder,
        didCollectDataOf collectedTypes: Set<HKSampleType>
    ) {
        guard let heartRateType,
              collectedTypes.contains(heartRateType),
              let stats = workoutBuilder.statistics(for: heartRateType),
              let quantity = stats.mostRecentQuantity() else {
            return
        }

        let bpm = Int(quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute())).rounded())
        guard bpm > 0 else { return }

        DispatchQueue.main.async {
            self.heartRateBpm = bpm
            self.sendHeartRate(bpm: bpm)
        }
    }

    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}
}
