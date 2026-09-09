import ActivityKit
import Foundation

// TODO: Share this attributes type with the app target via a framework if
// Expo 54 apple-targets starts failing to compile duplicate ActivityAttributes.

struct RestTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var endsAtEpoch: Double
  }

  var title: String
}
