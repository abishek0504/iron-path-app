import ExpoModulesCore
import WatchConnectivity

enum WatchPayloadParsing {
  static func stringFromPayload(_ value: Any?) -> String? {
    guard let value else { return nil }
    if let string = value as? String {
      let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
      return trimmed.isEmpty ? nil : trimmed
    }
    return nil
  }

  static func intFromPayload(_ value: Any?) -> Int? {
    guard let value else { return nil }
    if let intValue = value as? Int { return intValue }
    if let number = value as? NSNumber {
      let doubleValue = number.doubleValue
      guard doubleValue.isFinite else { return nil }
      let rounded = Int(doubleValue.rounded())
      guard abs(doubleValue - Double(rounded)) < 0.0001 else { return nil }
      return rounded
    }
    if let doubleValue = value as? Double, doubleValue.isFinite {
      let rounded = Int(doubleValue.rounded())
      guard abs(doubleValue - Double(rounded)) < 0.0001 else { return nil }
      return rounded
    }
    return nil
  }

  static func doubleFromPayload(_ value: Any?) -> Double? {
    guard let value else { return nil }
    if let doubleValue = value as? Double, doubleValue.isFinite { return doubleValue }
    if let number = value as? NSNumber {
      let doubleValue = number.doubleValue
      return doubleValue.isFinite ? doubleValue : nil
    }
    if let intValue = value as? Int { return Double(intValue) }
    return nil
  }

  static func isUuid(_ value: String) -> Bool {
    UUID(uuidString: value) != nil
  }
}

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

    Events(
      "onSetCompleted",
      "onSkipRest",
      "onExtendRest",
      "onSubmitRpe",
      "onWatchStateChanged",
      "onHeartRate",
      "onWorkoutEnded"
    )

    OnCreate {
      self.sessionDelegate.onSetCompleted = { [weak self] payload in
        self?.sendEvent("onSetCompleted", payload)
      }
      self.sessionDelegate.onSkipRest = { [weak self] payload in
        self?.sendEvent("onSkipRest", payload)
      }
      self.sessionDelegate.onExtendRest = { [weak self] payload in
        self?.sendEvent("onExtendRest", payload)
      }
      self.sessionDelegate.onSubmitRpe = { [weak self] payload in
        self?.sendEvent("onSubmitRpe", payload)
      }
      self.sessionDelegate.onHeartRate = { [weak self] payload in
        self?.sendEvent("onHeartRate", payload)
      }
      self.sessionDelegate.onWorkoutEnded = { [weak self] payload in
        self?.sendEvent("onWorkoutEnded", payload)
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

    AsyncFunction("startWatchApp") { (sessionId: String) in
      guard WCSession.isSupported() else { return }
      let session = WCSession.default
      guard session.isWatchAppInstalled else { return }
      session.startWatchApp(withUserInfo: ["sessionId": sessionId])
    }
  }
}

final class PhoneWatchSessionDelegate: NSObject, WCSessionDelegate {
  var onSetCompleted: (([String: Any]) -> Void)?
  var onSkipRest: (([String: Any]) -> Void)?
  var onExtendRest: (([String: Any]) -> Void)?
  var onSubmitRpe: (([String: Any]) -> Void)?
  var onHeartRate: (([String: Any]) -> Void)?
  var onWorkoutEnded: (([String: Any]) -> Void)?
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
    session.activate()
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    emitState(session)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    handleIncoming(message, replyHandler: nil)
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    handleIncoming(message, replyHandler: replyHandler)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    handleIncoming(userInfo, replyHandler: nil)
  }

  private func handleIncoming(
    _ payload: [String: Any],
    replyHandler: (([String: Any]) -> Void)?
  ) {
    guard let type = WatchPayloadParsing.stringFromPayload(payload["type"]) else {
      replyHandler?(["ok": false])
      return
    }

    if type == "completeSet" {
      guard let sessionId = WatchPayloadParsing.stringFromPayload(payload["sessionId"]),
            WatchPayloadParsing.isUuid(sessionId) else {
        replyHandler?(["ok": false])
        return
      }
      guard let setNumber = WatchPayloadParsing.intFromPayload(payload["setNumber"]), setNumber >= 1 else {
        replyHandler?(["ok": false])
        return
      }
      let sentAt = WatchPayloadParsing.doubleFromPayload(payload["sentAt"]) ?? Date().timeIntervalSince1970
      guard sentAt > 0 else {
        replyHandler?(["ok": false])
        return
      }

      onSetCompleted?([
        "type": "completeSet",
        "sessionId": sessionId,
        "setNumber": setNumber,
        "sentAt": sentAt,
      ])
      replyHandler?(["ok": true, "setNumber": setNumber])
      return
    }

    if type == "skipRest" {
      guard let sessionId = WatchPayloadParsing.stringFromPayload(payload["sessionId"]),
            WatchPayloadParsing.isUuid(sessionId) else {
        replyHandler?(["ok": false])
        return
      }
      let sentAt = WatchPayloadParsing.doubleFromPayload(payload["sentAt"]) ?? Date().timeIntervalSince1970
      onSkipRest?(["type": "skipRest", "sessionId": sessionId, "sentAt": sentAt])
      replyHandler?(["ok": true])
      return
    }

    if type == "extendRest" {
      guard let sessionId = WatchPayloadParsing.stringFromPayload(payload["sessionId"]),
            WatchPayloadParsing.isUuid(sessionId) else {
        replyHandler?(["ok": false])
        return
      }
      guard let seconds = WatchPayloadParsing.intFromPayload(payload["seconds"]), seconds >= 1, seconds <= 300 else {
        replyHandler?(["ok": false])
        return
      }
      let sentAt = WatchPayloadParsing.doubleFromPayload(payload["sentAt"]) ?? Date().timeIntervalSince1970
      onExtendRest?([
        "type": "extendRest",
        "sessionId": sessionId,
        "seconds": seconds,
        "sentAt": sentAt,
      ])
      replyHandler?(["ok": true])
      return
    }

    if type == "submitRpe" {
      guard let sessionId = WatchPayloadParsing.stringFromPayload(payload["sessionId"]),
            WatchPayloadParsing.isUuid(sessionId) else {
        replyHandler?(["ok": false])
        return
      }
      guard let setNumber = WatchPayloadParsing.intFromPayload(payload["setNumber"]), setNumber >= 1 else {
        replyHandler?(["ok": false])
        return
      }
      guard let rpe = WatchPayloadParsing.intFromPayload(payload["rpe"]), rpe >= 6, rpe <= 10 else {
        replyHandler?(["ok": false])
        return
      }
      let sentAt = WatchPayloadParsing.doubleFromPayload(payload["sentAt"]) ?? Date().timeIntervalSince1970
      onSubmitRpe?([
        "type": "submitRpe",
        "sessionId": sessionId,
        "setNumber": setNumber,
        "rpe": rpe,
        "sentAt": sentAt,
      ])
      replyHandler?(["ok": true])
      return
    }

    if type == "heartRate" {
      guard let sessionId = WatchPayloadParsing.stringFromPayload(payload["sessionId"]),
            WatchPayloadParsing.isUuid(sessionId) else {
        replyHandler?(["ok": false])
        return
      }
      guard let bpm = WatchPayloadParsing.intFromPayload(payload["bpm"]), bpm > 0, bpm < 250 else {
        replyHandler?(["ok": false])
        return
      }
      let timestamp = WatchPayloadParsing.doubleFromPayload(payload["timestamp"]) ?? Date().timeIntervalSince1970
      onHeartRate?([
        "type": "heartRate",
        "sessionId": sessionId,
        "bpm": bpm,
        "timestamp": timestamp,
      ])
      replyHandler?(["ok": true])
      return
    }

    if type == "workoutEnded" {
      guard let sessionId = WatchPayloadParsing.stringFromPayload(payload["sessionId"]),
            WatchPayloadParsing.isUuid(sessionId) else {
        replyHandler?(["ok": false])
        return
      }
      guard let hkWorkoutUuid = WatchPayloadParsing.stringFromPayload(payload["hkWorkoutUuid"]),
            WatchPayloadParsing.isUuid(hkWorkoutUuid) else {
        replyHandler?(["ok": false])
        return
      }
      onWorkoutEnded?([
        "type": "workoutEnded",
        "sessionId": sessionId,
        "hkWorkoutUuid": hkWorkoutUuid,
      ])
      replyHandler?(["ok": true])
      return
    }

    replyHandler?(["ok": false])
  }
}
