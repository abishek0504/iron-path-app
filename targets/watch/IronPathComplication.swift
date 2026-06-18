import WidgetKit
import SwiftUI

struct IronPathComplicationEntry: TimelineEntry {
    let date: Date
    let title: String
    let subtitle: String?
}

struct IronPathComplicationProvider: TimelineProvider {
    func placeholder(in context: Context) -> IronPathComplicationEntry {
        IronPathComplicationEntry(date: .now, title: "IronPath", subtitle: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (IronPathComplicationEntry) -> Void) {
        completion(readEntry(at: .now))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<IronPathComplicationEntry>) -> Void) {
        let entry = readEntry(at: .now)
        let refresh = Calendar.current.date(byAdding: .minute, value: 15, to: .now) ?? .now.addingTimeInterval(900)
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }

    private func readEntry(at date: Date) -> IronPathComplicationEntry {
        guard let defaults = UserDefaults(suiteName: complicationAppGroupId),
              let data = defaults.data(forKey: "complicationSnapshot"),
              let snapshot = try? JSONDecoder().decode(ComplicationSnapshot.self, from: data) else {
            return IronPathComplicationEntry(date: date, title: "IronPath", subtitle: nil)
        }

        if !snapshot.active {
            return IronPathComplicationEntry(date: date, title: "IronPath", subtitle: "No workout")
        }

        if snapshot.phase == "rest", let restEndsAt = snapshot.restEndsAt {
            let remaining = max(0, Int(restEndsAt - date.timeIntervalSince1970))
            let mins = remaining / 60
            let secs = remaining % 60
            return IronPathComplicationEntry(
                date: date,
                title: "Rest",
                subtitle: String(format: "%d:%02d", mins, secs)
            )
        }

        let name = snapshot.exerciseName.isEmpty ? "Workout" : snapshot.exerciseName
        return IronPathComplicationEntry(date: date, title: "IronPath", subtitle: name)
    }
}

struct IronPathComplicationView: View {
    var entry: IronPathComplicationProvider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(entry.title)
                .font(.caption2.weight(.semibold))
            if let subtitle = entry.subtitle {
                Text(subtitle)
                    .font(.caption2)
                    .lineLimit(1)
            }
        }
    }
}

struct IronPathComplication: Widget {
    let kind = "IronPathComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: IronPathComplicationProvider()) { entry in
            IronPathComplicationView(entry: entry)
        }
        .configurationDisplayName("IronPath")
        .description("Active workout and rest countdown.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}
