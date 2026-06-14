import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var workout: WatchWorkoutSession

    var body: some View {
        Group {
            if !workout.state.active {
                idleView
            } else {
                switch workout.state.phase {
                case "rest":
                    restView
                case "logging":
                    statusView(
                        title: "Logging",
                        subtitle: "Confirm your sets on iPhone"
                    )
                case "setRpe":
                    statusView(
                        title: "Rate effort",
                        subtitle: "How hard was the set? On iPhone"
                    )
                case "complete":
                    statusView(
                        title: "Workout complete",
                        subtitle: "Nice work!"
                    )
                default:
                    executionView
                }
            }
        }
        .navigationTitle("IronPath")
    }

    // MARK: - Idle

    private var idleView: some View {
        VStack(spacing: 8) {
            Image(systemName: "dumbbell.fill")
                .font(.title2)
                .foregroundStyle(.secondary)
            Text("No active workout")
                .font(.headline)
            Text("Start a workout on your iPhone to mirror it here.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }

    // MARK: - Execution

    private var executionView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                if let supersetLabel = workout.state.supersetLabel {
                    Text(supersetLabel)
                        .font(.caption2)
                        .foregroundStyle(.tint)
                }

                Text(workout.state.exerciseName)
                    .font(.headline)
                    .lineLimit(2)

                Text("Set \(workout.state.setNumber) of \(workout.state.totalSets)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                if workout.state.setType == "warmup" {
                    Text("Warmup")
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(.tint.opacity(0.2), in: Capsule())
                        .foregroundStyle(.tint)
                }

                if !workout.state.targetText.isEmpty && workout.state.exerciseEndsAt == nil {
                    Text(workout.state.targetText)
                        .font(.title3.weight(.semibold))
                        .padding(.vertical, 2)
                }

                if let exerciseEndsAt = workout.state.exerciseEndsAt {
                    TimelineView(.periodic(from: .now, by: 1)) { timeline in
                        let remaining = max(0, Int(exerciseEndsAt.timeIntervalSince(timeline.date).rounded()))
                        Text(formatSeconds(remaining))
                            .font(.system(size: 40, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(remaining == 0 ? AnyShapeStyle(.tint) : AnyShapeStyle(.primary))
                    }
                }

                Button {
                    workout.completeCurrentSet()
                } label: {
                    if workout.isSendingCompletion {
                        ProgressView()
                    } else {
                        Text("Complete Set")
                            .fontWeight(.semibold)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!workout.canCompleteSet)

                if let nextUp = workout.state.nextUp {
                    Text("Next: \(nextUp)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 4)
        }
    }

    // MARK: - Rest

    private var restView: some View {
        VStack(spacing: 8) {
            Text("Rest")
                .font(.headline)
                .foregroundStyle(.secondary)

            if let restEndsAt = workout.state.restEndsAt {
                // TimelineView re-renders every second without manual timers.
                TimelineView(.periodic(from: .now, by: 1)) { timeline in
                    let remaining = max(0, Int(restEndsAt.timeIntervalSince(timeline.date).rounded()))
                    Text(formatSeconds(remaining))
                        .font(.system(size: 40, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(remaining == 0 ? AnyShapeStyle(.tint) : AnyShapeStyle(.primary))
                }
            }

            if let nextUp = workout.state.nextUp {
                Text("Next: \(nextUp)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding()
    }

    // MARK: - Shared

    private func statusView(title: String, subtitle: String) -> some View {
        VStack(spacing: 8) {
            Text(title)
                .font(.headline)
            Text(subtitle)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }

    private func formatSeconds(_ seconds: Int) -> String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}
