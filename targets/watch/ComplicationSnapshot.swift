import Foundation

let complicationAppGroupId = "group.com.ironpath.app.watch"

struct ComplicationSnapshot: Codable {
    var active: Bool
    var phase: String
    var exerciseName: String
    var restEndsAt: Double?
}
