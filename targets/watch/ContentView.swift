import SwiftUI
import WatchKit

struct ContentView: View {
    @EnvironmentObject private var workout: WatchWorkoutSession
    @EnvironmentObject private var standalone: WatchStandaloneEngine
    @Environment(\.isLuminanceReduced) private var isLuminanceReduced
    @State private var restHapticFiredForEndsAt: Date?

    var body: some View {
        Group {
            if !workout.state.active && standalone.snapshot?.phase != .complete {
                idleView
            } else {
                switch workout.state.phase {
                case "rest":
                    restView
                case "logging":
                    statusView(
                        title: "Logging",
                        subtitle: workout.isStandaloneActive
                            ? "Logged on Watch"
                            : "Confirm your sets on iPhone"
                    )
                case "setRpe":
                    setRpeView
                case "complete":
                    completeView
                default:
                    executionView
                }
            }
        }
        .navigationTitle(workout.state.active ? "" : "IronPath")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $standalone.showAdjustSheet) {
            adjustSheet
        }
    }

    // MARK: - Idle

    private var idleView: some View {
        ScrollView {
            VStack(spacing: 10) {
                Image(systemName: "dumbbell.fill")
                    .font(.title2)
                    .foregroundStyle(.secondary)

                Text("IronPath")
                    .font(.headline)

                if let message = standalone.statusMessage {
                    Text(message)
                        .font(.caption2)
                        .foregroundStyle(.orange)
                        .multilineTextAlignment(.center)
                } else {
                    Text("Start today's workout on your Watch, or begin on iPhone to mirror here.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                Button {
                    workout.startStandaloneWorkout()
                } label: {
                    if standalone.isBusy {
                        ProgressView()
                    } else {
                        Text("Start today's workout")
                            .fontWeight(.semibold)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(standalone.isBusy)
            }
            .padding()
        }
    }

    // MARK: - Execution (one primary + one secondary)

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

                if workout.isStandaloneActive, !isLuminanceReduced {
                    Button("Adjust") {
                        workout.beginAdjustTargets()
                    }
                    .buttonStyle(.bordered)
                }

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
            return "Complete"
        }
    }

    @ViewBuilder
    private var completionStatusView: some View {
        switch workout.completionSyncStatus {
        case .idle, .sending:
            EmptyView()
        case .sent:
            Label("Saved", systemImage: "checkmark.circle.fill")
                .font(.caption2)
                .foregroundStyle(.green)
        case .queued:
            Text(workout.isStandaloneActive
                ? "Syncing when online…"
                : "Queued — open IronPath on iPhone")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        case .retry:
            Text("Tap again")
                .font(.caption2)
                .foregroundStyle(.orange)
        }
    }

    // MARK: - Adjust (Crown + steppers, one value)

    private var adjustSheet: some View {
        VStack(spacing: 10) {
            Text(adjustTitle)
                .font(.headline)

                Text(adjustValueLabel)
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .monospacedDigit()
                .focusable(true)
                .digitalCrownRotation(
                    $standalone.adjustValue,
                    from: 0,
                    through: 1000,
                    by: standalone.adjustField == .reps ? 1 : 2.5,
                    sensitivity: .medium
                )

            HStack(spacing: 8) {
                Button {
                    let step = standalone.adjustField == .reps ? -1.0 : -2.5
                    standalone.stepAdjust(delta: step)
                } label: {
                    Text("−")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

                Button {
                    let step = standalone.adjustField == .reps ? 1.0 : 2.5
                    standalone.stepAdjust(delta: step)
                } label: {
                    Text("+")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }

            if let snap = standalone.snapshot,
               let exercise = snap.exercises[safe: snap.exerciseIndex],
               exercise.mode == .reps {
                Button("Switch weight / reps") {
                    standalone.cycleAdjustField()
                }
                .buttonStyle(.plain)
                .font(.caption2)
            }

            Button("Done") {
                standalone.applyAdjust()
                workout.publishStandaloneIfNeededPublic()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }

    private var adjustTitle: String {
        switch standalone.adjustField {
        case .weight: return "Weight"
        case .reps: return "Reps"
        case .duration: return "Seconds"
        }
    }

    private var adjustValueLabel: String {
        let value = standalone.adjustValue
        switch standalone.adjustField {
        case .weight:
            return value == floor(value) ? "\(Int(value))" : String(format: "%g", value)
        case .reps, .duration:
            return "\(Int(value.rounded()))"
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

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                ForEach([6, 7, 8, 9], id: \.self) { rpe in
                    Button {
                        workout.submitRpe(rpe)
                    } label: {
                        Text("\(rpe)")
                            .font(.body.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 36)
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

    private var completeView: some View {
        VStack(spacing: 8) {
            Text("Workout complete")
                .font(.headline)
            Text(
                standalone.pendingOutboxCount > 0
                    ? "Syncing \(standalone.pendingOutboxCount) pending…"
                    : "Nice work!"
            )
            .font(.footnote)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)

            if workout.isStandaloneActive || standalone.snapshot?.phase == .complete {
                Button("Done") {
                    standalone.abandonLocal()
                    workout.resetToIdle()
                }
                .buttonStyle(.borderedProminent)
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

    private func fireRestEndHapticIfNeeded(remaining: Int, restEndsAt: Date) {
        guard remaining == 0, restHapticFiredForEndsAt != restEndsAt else { return }
        restHapticFiredForEndsAt = restEndsAt
        WKInterfaceDevice.current().play(.notification)
    }

    private func formatSeconds(_ seconds: Int) -> String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
