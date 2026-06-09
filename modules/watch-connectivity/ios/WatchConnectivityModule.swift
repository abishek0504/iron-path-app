import ExpoModulesCore
import WatchConnectivity

/**
 * iPhone-side WCSession bridge.
 *
 * - `updateWorkoutContext` mirrors the active workout to the watch via
 *   `updateApplicationContext` (latest-state-wins, survives launches).
 * - Set-completion taps from the watch arrive through `sendMessage`
 *   (foreground/reachable) or `transferUserInfo` (queued offline taps) and are
 *   emitted to JS as `onSetCompleted`. The phone stays the canonical writer.
 */
public class WatchConnectivityModule: Module {
  private let sessionDelegate = PhoneWatchSessionDelegate()

  public func definition() -> ModuleDefinition {
    Name("WatchConnectivity")

    Events("onSetCompleted", "onWatchStateChanged")

    OnCreate {
      self.sessionDelegate.onSetCompleted = { [weak self] payload in
        self?.sendEvent("onSetCompleted", payload)
      }
      self.sessionDelegate.onStateChanged = { [weak self] payload in
        self?.sendEvent("onWatchStateChanged", payload)
      }
      self.sessionDelegate.activate()
    }

    Function("isSupported") { () -> Bool in
      WCSession.isSupported()
    }

    AsyncFunction("getWatchState") { () -> [String: Any] in
      guard WCSession.isSupported() else {
        return ["supported": false, "paired": false, "installed": false, "reachable": false]
      }
      let session = WCSession.default
      return [
        "supported": true,
        "paired": session.isPaired,
        "installed": session.isWatchAppInstalled,
        "reachable": session.isReachable,
      ]
    }

    AsyncFunction("updateWorkoutContext") { (context: [String: Any]) in
      guard WCSession.isSupported() else { return }
      try WCSession.default.updateApplicationContext(context)
    }

    AsyncFunction("clearWorkoutContext") { () in
      guard WCSession.isSupported() else { return }
      try WCSession.default.updateApplicationContext([
        "active": false,
        "updatedAt": Date().timeIntervalSince1970,
      ])
    }
  }
}

final class PhoneWatchSessionDelegate: NSObject, WCSessionDelegate {
  var onSetCompleted: (([String: Any]) -> Void)?
  var onStateChanged: (([String: Any]) -> Void)?

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  private func emitState(_ session: WCSession) {
    onStateChanged?([
      "paired": session.isPaired,
      "installed": session.isWatchAppInstalled,
      "reachable": session.isReachable,
    ])
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    emitState(session)
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    // Re-activate after a watch switch, per Apple guidance.
    session.activate()
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    emitState(session)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    handleIncoming(message)
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    handleIncoming(message)
    replyHandler(["ok": true])
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    handleIncoming(userInfo)
  }

  private func handleIncoming(_ payload: [String: Any]) {
    guard let type = payload["type"] as? String, type == "completeSet" else { return }
    onSetCompleted?(payload)
  }
}
