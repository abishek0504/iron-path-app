import Foundation

let complicationAppGroupId = "group.com.alexpreo.ironpath.shared"

struct ComplicationSnapshot: Codable {
    var active: Bool
    var phase: String
    var exerciseName: String
    var restEndsAt: Double?
}
