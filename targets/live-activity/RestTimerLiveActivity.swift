import ActivityKit
import SwiftUI
import WidgetKit

struct RestTimerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: RestTimerAttributes.self) { context in
      RestTimerLockScreenView(endsAtEpoch: context.state.endsAtEpoch, title: context.attributes.title)
        .padding()
    } dynamicIsland: { context in
      let endDate = max(Date.now, Date(timeIntervalSince1970: context.state.endsAtEpoch))
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text(context.attributes.title)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(timerInterval: Date.now...endDate, countsDown: true)
            .monospacedDigit()
        }
      } compactLeading: {
        Text("Rest")
      } compactTrailing: {
        Text(timerInterval: Date.now...endDate, countsDown: true)
          .monospacedDigit()
      } minimal: {
        Text("R")
      }
    }
  }
}

private struct RestTimerLockScreenView: View {
  let endsAtEpoch: Double
  let title: String

  var body: some View {
    let endDate = max(Date.now, Date(timeIntervalSince1970: endsAtEpoch))
    VStack(alignment: .leading, spacing: 4) {
      Text(title)
        .font(.headline)
      Text(timerInterval: Date.now...endDate, countsDown: true)
        .font(.title)
        .monospacedDigit()
    }
  }
}
