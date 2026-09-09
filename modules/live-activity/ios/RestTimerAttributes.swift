import Foundation

#if canImport(ActivityKit)
import ActivityKit

// TODO: Keep this identical to targets/live-activity/RestTimerAttributes.swift.
// ActivityKit matches activities by attributes type name across targets.

@available(iOS 16.2, *)
struct RestTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var endsAtEpoch: Double
  }

  var title: String
}
#endif
