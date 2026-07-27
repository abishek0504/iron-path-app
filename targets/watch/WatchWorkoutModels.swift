import Foundation

enum WatchControlDevice: String, Codable, Equatable {
    case phone
    case watch
}

enum WatchSetType: String, Codable, Equatable {
    case normal
    case warmup
    case drop
    case failure
}

enum WatchExerciseMode: String, Codable, Equatable {
    case reps
    case timed
}

struct WatchLocalSet: Codable, Equatable, Identifiable {
    var id: String
    var setNumber: Int
    var reps: Int?
    var weight: Double?
    var durationSec: Int?
    var rpe: Int?
    var restSec: Int?
    var setType: WatchSetType
    var performedAt: String?
    var completed: Bool

    var adjustedReps: Int?
    var adjustedWeight: Double?
    var adjustedDurationSec: Int?

    var effectiveReps: Int? { adjustedReps ?? reps }
    var effectiveWeight: Double? { adjustedWeight ?? weight }
    var effectiveDurationSec: Int? { adjustedDurationSec ?? durationSec }
}

struct WatchLocalExercise: Codable, Equatable, Identifiable {
    var id: String
    var exerciseId: String?
    var customExerciseId: String?
    var name: String
    var mode: WatchExerciseMode
    var sortOrder: Int
    var supersetGroup: Int?
    var restSec: Int?
    var sets: [WatchLocalSet]
}

enum WatchLocalPhase: String, Codable, Equatable {
    case execution
    case rest
    case setRpe
    case complete
}

struct WatchLocalSnapshot: Codable, Equatable {
    var sessionId: String
    var controlDevice: WatchControlDevice
    var dayName: String?
    var templateId: String?
    var useImperial: Bool
    var exercises: [WatchLocalExercise]
    var exerciseIndex: Int
    var setIndex: Int
    var phase: WatchLocalPhase
    var restEndsAt: TimeInterval?
    var restStartedAt: TimeInterval?
    var pendingRpeSetIndex: Int?
    var pendingTimedDurationSec: Int?
    var outboxPendingCount: Int
}

enum WatchOutboxOp: String, Codable {
    case markSetComplete
    case completeSession
    case linkHkWorkout
}

struct WatchOutboxEntry: Codable, Equatable, Identifiable {
    var id: String
    var op: WatchOutboxOp
    var sessionId: String
    var setId: String?
    var payload: [String: String]
    var createdAt: TimeInterval
}
