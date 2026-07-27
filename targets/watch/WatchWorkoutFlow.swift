import Foundation

enum WatchWorkoutFlow {
    static let defaultRestSec = 90

    static func resolveRestSec(exerciseRest: Int?, setRest: Int?) -> Int {
        if let exerciseRest, exerciseRest > 0 { return exerciseRest }
        if let setRest, setRest > 0 { return setRest }
        return defaultRestSec
    }

    static func getSupersetMembers(exercises: [WatchLocalExercise], exerciseIndex: Int) -> [Int] {
        guard exerciseIndex >= 0, exerciseIndex < exercises.count else { return [exerciseIndex] }
        guard let group = exercises[exerciseIndex].supersetGroup else { return [exerciseIndex] }
        return exercises.indices.filter { exercises[$0].supersetGroup == group }
    }

    enum NextStep: Equatable {
        case execute(exerciseIndex: Int, setIndex: Int, withRest: Bool)
        case complete
    }

    static func findNextStep(exercises: [WatchLocalExercise], exerciseIndex: Int) -> NextStep {
        let members = getSupersetMembers(exercises: exercises, exerciseIndex: exerciseIndex)
        guard let pos = members.firstIndex(of: exerciseIndex) else { return .complete }

        for offset in 1...members.count {
            let memberIdx = members[(pos + offset) % members.count]
            if let setIndex = exercises[memberIdx].sets.firstIndex(where: { !$0.completed }) {
                let wrapped = pos + offset >= members.count
                return .execute(exerciseIndex: memberIdx, setIndex: setIndex, withRest: wrapped)
            }
        }
        return .complete
    }

    static func formatTarget(set: WatchLocalSet, mode: WatchExerciseMode, useImperial: Bool) -> String {
        switch mode {
        case .timed:
            let sec = set.effectiveDurationSec ?? 0
            return sec > 0 ? "\(sec)s hold" : ""
        case .reps:
            let reps = set.effectiveReps ?? 0
            if let weight = set.effectiveWeight {
                let unit = useImperial ? "lbs" : "kg"
                let weightText = weight == floor(weight) ? String(Int(weight)) : String(format: "%g", weight)
                return "\(weightText) \(unit) × \(reps)"
            }
            return "\(reps) reps"
        }
    }
}
