import ExpoModulesCore

#if canImport(ActivityKit)
import ActivityKit
#endif

/**
 * Minimal rest-timer Live Activity bridge.
 * TODO: Verify ActivityKit request/update/end against a device build on Expo 54.
 * Compiles as a no-op when ActivityKit is unavailable.
 */
public class LiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiveActivity")

    AsyncFunction("startRestLiveActivity") { (endsAtEpoch: Double) in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        let attributes = RestTimerAttributes(title: "Rest")
        let state = RestTimerAttributes.ContentState(endsAtEpoch: endsAtEpoch)
        let staleDate = Date(timeIntervalSince1970: endsAtEpoch)
        let content = ActivityContent(state: state, staleDate: staleDate)
        _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
      }
      #endif
    }

    AsyncFunction("updateRestLiveActivity") { (endsAtEpoch: Double) in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        let state = RestTimerAttributes.ContentState(endsAtEpoch: endsAtEpoch)
        let staleDate = Date(timeIntervalSince1970: endsAtEpoch)
        let content = ActivityContent(state: state, staleDate: staleDate)
        for activity in Activity<RestTimerAttributes>.activities {
          await activity.update(content)
        }
      }
      #endif
    }

    AsyncFunction("endRestLiveActivity") { () in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        for activity in Activity<RestTimerAttributes>.activities {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
      #endif
    }
  }
}
