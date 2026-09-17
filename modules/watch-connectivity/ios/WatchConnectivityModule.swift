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
        self?.emitOnMain("onSetCompleted", payload)
      }
      self.sessionDelegate.onSkipRest = { [weak self] payload in
        self?.emitOnMain("onSkipRest", payload)
      }
      self.sessionDelegate.onExtendRest = { [weak self] payload in
        self?.emitOnMain("onExtendRest", payload)
      }
      self.sessionDelegate.onSubmitRpe = { [weak self] payload in
        self?.emitOnMain("onSubmitRpe", payload)
      }
      self.sessionDelegate.onHeartRate = { [weak self] payload in
        self?.emitOnMain("onHeartRate", payload)
      }
      self.sessionDelegate.onWorkoutEnded = { [weak self] payload in
        self?.emitOnMain("onWorkoutEnded", payload)
      }
      self.sessionDelegate.onStateChanged = { [weak self] payload in
        self?.emitOnMain("onWatchStateChanged", payload)
      }
      self.sessionDelegate.activate()
    }

    OnDestroy {
      self.sessionDelegate.teardown()
    }

    Function("isSupported") { () -> Bool in
      WCSession.isSupported()
    }

    AsyncFunction("getWatchState") { () -> [String: Any] in
      self.sessionDelegate.snapshotState()
    }

    AsyncFunction("updateWorkoutContext") { (context: [String: Any]) in
      try self.sessionDelegate.updateWorkoutContext(context)
    }

    AsyncFunction("clearWorkoutContext") { () in
      try self.sessionDelegate.clearWorkoutContext()
    }

    AsyncFunction("startWatchApp") { (sessionId: String) async in
      await MainActor.run {
        self.sessionDelegate.openCompanionWatchApp(sessionId: sessionId)
      }
    }

    AsyncFunction("syncAuthToWatch") { (payload: [String: Any]) in
      WatchSharedAuthStore.save(payload)
      do {
        try self.sessionDelegate.pushAuthToWatch()
      } catch {
        NSLog("IronPath push auth to watch failed: %@", error.localizedDescription)
      }
    }

    AsyncFunction("clearAuthFromWatch") { () in
      WatchSharedAuthStore.clear()
      do {
        try self.sessionDelegate.pushAuthClearToWatch()
      } catch {
        NSLog("IronPath clear auth on watch failed: %@", error.localizedDescription)
      }
    }
  }

  /// WCSession callbacks run off the JS thread; hop before Expo sendEvent.
  private func emitOnMain(_ event: String, _ payload: [String: Any]) {
    DispatchQueue.main.async { [weak self] in
      self?.sendEvent(event, payload)
    }
  }
}

/// App Group bridge so the watch can run standalone Supabase-backed workouts.
private let watchAuthMessageType = "auth"
private let watchAuthClearMessageType = "clearAuth"
private let watchAuthRequestMessageType = "requestAuth"

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
      "expiresAt": WatchPayloadParsing.doubleFromPayload(payload["expiresAt"]) ?? 0,
      "userId": userId,
      "supabaseUrl": supabaseUrl,
      "supabaseAnonKey": supabaseAnonKey,
      "updatedAt": Date().timeIntervalSince1970,
    ]
    defaults.set(record, forKey: authKey)
  }

  static func loadRecord() -> [String: Any]? {
    guard let record = UserDefaults(suiteName: appGroupId)?.dictionary(forKey: authKey) else {
      return nil
    }
    guard let accessToken = record["accessToken"] as? String, !accessToken.isEmpty,
          let refreshToken = record["refreshToken"] as? String, !refreshToken.isEmpty,
          let userId = record["userId"] as? String, !userId.isEmpty,
          let supabaseUrl = record["supabaseUrl"] as? String, !supabaseUrl.isEmpty,
          let supabaseAnonKey = record["supabaseAnonKey"] as? String, !supabaseAnonKey.isEmpty
    else {
      return nil
    }
    return record
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

  private let healthStore = HKHealthStore()
  private var pendingWorkoutContext: [String: Any]?
  private var pendingAuthClear = false
  private var lastHeartRateEmitAt: TimeInterval = 0
  private let heartRateMinInterval: TimeInterval = 5
  private var cachedState: [String: Any] = [
    "supported": false,
    "paired": false,
    "installed": false,
    "reachable": false,
  ]

  func activate() {
    guard WCSession.isSupported() else { return }
    cachedState = [
      "supported": true,
      "paired": false,
      "installed": false,
      "reachable": false,
    ]
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  func teardown() {
    onSetCompleted = nil
    onSkipRest = nil
    onExtendRest = nil
    onSubmitRpe = nil
    onHeartRate = nil
    onWorkoutEnded = nil
    onStateChanged = nil
    if WCSession.isSupported(), WCSession.default.delegate === self {
      WCSession.default.delegate = nil
    }
  }

  func snapshotState() -> [String: Any] {
    guard WCSession.isSupported() else {
      return ["supported": false, "paired": false, "installed": false, "reachable": false]
    }
    return cachedState
  }

  /// Keep the HealthStore alive for the async completion — a stack-allocated
  /// store can be freed before startWatchApp finishes (native UAF).
  func openCompanionWatchApp(sessionId: String) {
    guard WCSession.isSupported() else { return }
    guard WCSession.default.isWatchAppInstalled else { return }

    let configuration = HKWorkoutConfiguration()
    configuration.activityType = .traditionalStrengthTraining
    configuration.locationType = .indoor

    healthStore.startWatchApp(with: configuration) { _, error in
      if let error {
        NSLog("IronPath startWatchApp failed for session %@: %@", sessionId, error.localizedDescription)
      }
    }
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

  /// App Groups are per-device. Auth must ride WatchConnectivity or the watch
  /// never sees the phone session. Merge into applicationContext so the latest
  /// credentials survive watch launches without overwriting workout state.
  func pushAuthToWatch() throws {
    pendingAuthClear = false
    guard WatchSharedAuthStore.loadRecord() != nil else { return }
    try flushPendingWorkoutContextIfNeeded()
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated,
          let record = WatchSharedAuthStore.loadRecord() else { return }
    sendOrQueue(session: session, payload: ["type": watchAuthMessageType, "auth": record])
  }

  func pushAuthClearToWatch() throws {
    pendingAuthClear = true
    try flushPendingWorkoutContextIfNeeded()
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated else { return }
    sendOrQueue(
      session: session,
      payload: ["type": watchAuthClearMessageType, "auth": ["cleared": true]]
    )
  }

  private func flushPendingWorkoutContextIfNeeded() throws {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated else { return }

    let hasPendingWorkout = pendingWorkoutContext != nil
    var context: [String: Any]
    if let pending = pendingWorkoutContext {
      context = pending
    } else {
      context = session.applicationContext
    }

    if pendingAuthClear {
      context["auth"] = ["cleared": true]
    } else if let auth = WatchSharedAuthStore.loadRecord() {
      context["auth"] = auth
    } else if let existingAuth = session.applicationContext["auth"] {
      context["auth"] = existingAuth
    }

    guard !context.isEmpty else { return }
    let shouldClearAuth = pendingAuthClear
    if !NSDictionary(dictionary: context).isEqual(to: session.applicationContext) {
      try session.updateApplicationContext(context)
    }
    if shouldClearAuth {
      pendingAuthClear = false
    }
    if hasPendingWorkout {
      pushWorkoutContextMessageIfReachable(session: session, context: context)
    }
  }

  private func sendOrQueue(session: WCSession, payload: [String: Any]) {
    cancelOutstandingAuthTransfers(session)
    if session.isReachable {
      session.sendMessage(payload, replyHandler: nil) { error in
        NSLog("IronPath sendMessage auth failed: %@", error.localizedDescription)
        session.transferUserInfo(payload)
      }
    } else if session.isWatchAppInstalled {
      session.transferUserInfo(payload)
    }
  }

  private func cancelOutstandingAuthTransfers(_ session: WCSession) {
    for transfer in session.outstandingUserInfoTransfers {
      let type = transfer.userInfo["type"] as? String
      if type == watchAuthMessageType || type == watchAuthClearMessageType {
        transfer.cancel()
      }
    }
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
    let payload: [String: Any] = [
      "supported": true,
      "paired": session.isPaired,
      "installed": session.isWatchAppInstalled,
      "reachable": session.isReachable,
    ]
    cachedState = payload
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
        try pushAuthToWatch()
      } catch {
        NSLog("IronPath flush after WCSession activation failed: %@", error.localizedDescription)
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
      try pushAuthToWatch()
    } catch {
      NSLog("IronPath flush on reachability change failed: %@", error.localizedDescription)
    }
  }

  #if os(iOS)
  func sessionWatchStateDidChange(_ session: WCSession) {
    emitState(session)
    do {
      try flushPendingWorkoutContextIfNeeded()
      try pushAuthToWatch()
    } catch {
      NSLog("IronPath flush on watch state change failed: %@", error.localizedDescription)
    }
  }
  #endif

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

    if type == watchAuthRequestMessageType {
      if let record = WatchSharedAuthStore.loadRecord() {
        replyHandler?(["ok": true, "auth": record])
        if replyHandler == nil {
          do {
            try pushAuthToWatch()
          } catch {
            NSLog("IronPath requestAuth push failed: %@", error.localizedDescription)
          }
        }
      } else {
        replyHandler?(["ok": true])
      }
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
      let now = Date().timeIntervalSince1970
      guard now - lastHeartRateEmitAt >= heartRateMinInterval else {
        replyHandler?(["ok": true])
        return
      }
      lastHeartRateEmitAt = now
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
