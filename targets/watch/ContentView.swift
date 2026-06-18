import SwiftUI
import WatchKit

struct ContentView: View {
    @EnvironmentObject private var workout: WatchWorkoutSession
    @Environment(\.isLuminanceReduced) private var isLuminanceReduced
    @State private var restHapticFiredForEndsAt: Date?

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
                    if workout.state.timedSetRpe {
                        setRpeView
                    } else {
                        statusView(
                            title: "Rate effort",
                            subtitle: "How hard was the set? On iPhone"
                        )
                    }
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
        .navigationTitle(workout.state.active ? "" : "IronPath")
        .navigationBarTitleDisplayMode(.inline)
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
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 6) {
                    if !workout.state.progressText.isEmpty {
                        Text(workout.state.progressText)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

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
                            .lineLimit(1)
                            .padding(.vertical, 2)
                    }

                    if !workout.state.lastTimeText.isEmpty && workout.state.exerciseEndsAt == nil {
                        Text("Last time: \(workout.state.lastTimeText)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }

                    if !isLuminanceReduced, let hr = workout.healthManager.heartRateBpm {
                        HStack(spacing: 4) {
                            Image(systemName: "heart.fill")
                                .foregroundStyle(.red)
                                .font(.caption)
                            Text("\(hr) BPM")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }
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
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal)
                .padding(.top, 4)
            }

            VStack(spacing: 4) {
                Button {
                    workout.completeCurrentSet()
                } label: {
                    if workout.isSendingCompletion {
                        ProgressView()
                    } else {
                        Text(completionButtonTitle)
                            .fontWeight(.semibold)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!workout.canCompleteSet)

                completionStatusView

                if !isLuminanceReduced, let nextUp = workout.state.nextUp {
                    Text("Next: \(nextUp)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 4)
        }
    }

    private var completionButtonTitle: String {
        switch workout.completionSyncStatus {
        case .retry:
            return "Tap again"
        default:
            return "Complete Set"
        }
    }

    @ViewBuilder
    private var completionStatusView: some View {
        switch workout.completionSyncStatus {
        case .idle, .sending:
            EmptyView()
        case .sent:
            Label("Sent", systemImage: "checkmark.circle.fill")
                .font(.caption2)
                .foregroundStyle(.green)
        case .queued:
            Text("Queued — open IronPath on iPhone")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        case .retry:
            Text("Tap again")
                .font(.caption2)
                .foregroundStyle(.orange)
        }
    }

    // MARK: - Timed set RPE

    private var setRpeView: some View {
        VStack(spacing: 8) {
            if !workout.state.progressText.isEmpty {
                Text(workout.state.progressText)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Text("How hard?")
                .font(.headline)

            if !workout.state.targetText.isEmpty {
                Text(workout.state.targetText)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 4) {
                ForEach([6, 7, 8, 9], id: \.self) { rpe in
                    Button {
                        workout.submitRpe(rpe)
                    } label: {
                        Text("\(rpe)")
                            .font(.body.weight(.semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
        .padding()
    }

    // MARK: - Rest

    private var restView: some View {
        ScrollView {
            VStack(spacing: 8) {
                if !isLuminanceReduced, !workout.state.progressText.isEmpty {
                    Text(workout.state.progressText)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                if !isLuminanceReduced {
                    Text("Rest")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                }

                if let restEndsAt = workout.state.restEndsAt {
                    TimelineView(.periodic(from: .now, by: 1)) { timeline in
                        let remaining = max(0, Int(restEndsAt.timeIntervalSince(timeline.date).rounded()))
                        Text(formatSeconds(remaining))
                            .font(.system(size: isLuminanceReduced ? 52 : 44, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(
                                isLuminanceReduced
                                    ? AnyShapeStyle(.white)
                                    : (remaining == 0 ? AnyShapeStyle(.tint) : AnyShapeStyle(.primary))
                            )
                            .onChange(of: remaining) { newRemaining in
                                fireRestEndHapticIfNeeded(remaining: newRemaining, restEndsAt: restEndsAt)
                            }
                    }
                }

                if !isLuminanceReduced {
                    HStack(spacing: 6) {
                        Button("+15s") {
                            workout.extendRest(seconds: 15)
                        }
                        .buttonStyle(.bordered)
                        .frame(maxWidth: .infinity, minHeight: 36)

                        Button("Skip") {
                            workout.skipRest()
                        }
                        .buttonStyle(.borderedProminent)
                        .frame(maxWidth: .infinity, minHeight: 36)
                    }

                    if let hr = workout.healthManager.heartRateBpm {
                        HStack(spacing: 4) {
                            Image(systemName: "heart.fill")
                                .foregroundStyle(.red)
                                .font(.caption)
                            Text("\(hr) BPM")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }
                    }

                    if let nextUp = workout.state.nextUp {
                        Text("Next: \(nextUp)")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                    }
                }
            }
            .padding()
        }
        .onChange(of: workout.state.restEndsAt) { newEndsAt in
            if newEndsAt != restHapticFiredForEndsAt {
                restHapticFiredForEndsAt = nil
            }
        }
    }

    private func fireRestEndHapticIfNeeded(remaining: Int, restEndsAt: Date) {
        guard remaining == 0, restHapticFiredForEndsAt != restEndsAt else { return }
        restHapticFiredForEndsAt = restEndsAt
        WKInterfaceDevice.current().play(.notification)
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
