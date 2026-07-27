import ExpoModulesCore
import HealthKit
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

private func openCompanionWatchApp(sessionId: String) {
  guard WCSession.isSupported() else { return }
  guard WCSession.default.isWatchAppInstalled else { return }

  let configuration = HKWorkoutConfiguration()
  configuration.activityType = .traditionalStrengthTraining
  configuration.locationType = .indoor

  HKHealthStore().startWatchApp(with: configuration) { _, error in
    if let error {
      NSLog("IronPath startWatchApp failed for session %@: %@", sessionId, error.localizedDescription)
    }
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
      try self.sessionDelegate.updateWorkoutContext(context)
    }

    AsyncFunction("clearWorkoutContext") { () in
      try self.sessionDelegate.clearWorkoutContext()
    }

    AsyncFunction("startWatchApp") { (sessionId: String) async in
      await MainActor.run {
        openCompanionWatchApp(sessionId: sessionId)
      }
    }

    AsyncFunction("syncAuthToWatch") { (payload: [String: Any]) in
      WatchSharedAuthStore.save(payload)
    }

    AsyncFunction("clearAuthFromWatch") { () in
      WatchSharedAuthStore.clear()
    }
  }
}

/// App Group bridge so the watch can run standalone Supabase-backed workouts.
enum WatchSharedAuthStore {
  static let appGroupId = "group.com.alexpreo.ironpath.shared"
  static let authKey = "ironpath.watch.auth"

  static func save(_ payload: [String: Any]) {
    guard let defaults = UserDefaults(suiteName: appGroupId) else { return }
    let accessToken = payload["accessToken"] as? String ?? ""
    let refreshToken = payload["refreshToken"] as? String ?? ""
    let userId = payload["userId"] as? String ?? ""
    let supabaseUrl = payload["supabaseUrl"] as? String ?? ""
    let supabaseAnonKey = payload["supabaseAnonKey"] as? String ?? ""
    guard !accessToken.isEmpty, !refreshToken.isEmpty, !userId.isEmpty,
          !supabaseUrl.isEmpty, !supabaseAnonKey.isEmpty else {
      return
    }
    let record: [String: Any] = [
      "accessToken": accessToken,
      "refreshToken": refreshToken,
      "expiresAt": payload["expiresAt"] as? Double ?? 0,
      "userId": userId,
      "supabaseUrl": supabaseUrl,
      "supabaseAnonKey": supabaseAnonKey,
      "updatedAt": Date().timeIntervalSince1970,
    ]
    defaults.set(record, forKey: authKey)
  }

  static func clear() {
    UserDefaults(suiteName: appGroupId)?.removeObject(forKey: authKey)
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

  private var pendingWorkoutContext: [String: Any]?

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  /// Queue the latest workout snapshot and push when the session is activated.
  /// `updateApplicationContext` throws if called before activation — we buffer
  /// until `activationDidCompleteWith` so early workout loads are not lost.
  func updateWorkoutContext(_ context: [String: Any]) throws {
    guard WCSession.isSupported() else { return }
    let sanitized = Self.sanitizeContext(context)
    pendingWorkoutContext = sanitized
    try flushPendingWorkoutContextIfNeeded()
  }

  func clearWorkoutContext() throws {
    try updateWorkoutContext([
      "active": false,
      "updatedAt": Date().timeIntervalSince1970,
    ])
  }

  private func flushPendingWorkoutContextIfNeeded() throws {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated, let context = pendingWorkoutContext else {
      return
    }
    try session.updateApplicationContext(context)
    pushWorkoutContextMessageIfReachable(session: session, context: context)
  }

  private func pushWorkoutContextMessageIfReachable(session: WCSession, context: [String: Any]) {
    guard session.isWatchAppInstalled, session.isReachable else { return }
    var message = context
    message["type"] = "workoutContext"
    session.sendMessage(message, replyHandler: nil) { error in
      NSLog("IronPath sendMessage workout context failed: %@", error.localizedDescription)
    }
  }

  private static func sanitizeContext(_ context: [String: Any]) -> [String: Any] {
    var result: [String: Any] = [:]
    for (key, value) in context {
      if value is NSNull { continue }
      switch value {
      case let string as String:
        result[key] = string
      case let bool as Bool:
        result[key] = bool
      case let int as Int:
        result[key] = int
      case let double as Double where double.isFinite:
        result[key] = double
      case let number as NSNumber:
        let doubleValue = number.doubleValue
        if doubleValue.isFinite {
          result[key] = number
        }
      default:
        continue
      }
    }
    return result
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
    if let error {
      NSLog("IronPath WCSession activation failed: %@", error.localizedDescription)
    }
    emitState(session)
    if activationState == .activated {
      do {
        try flushPendingWorkoutContextIfNeeded()
      } catch {
        NSLog("IronPath flush workout context after activation failed: %@", error.localizedDescription)
      }
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    emitState(session)
    do {
      try flushPendingWorkoutContextIfNeeded()
    } catch {
      NSLog("IronPath flush workout context on reachability change failed: %@", error.localizedDescription)
    }
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
