import SwiftUI

@main
struct IronPathWatchApp: App {
    @StateObject private var workoutSession = WatchWorkoutSession()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(workoutSession)
                .environmentObject(workoutSession.standalone)
        }
    }
}
