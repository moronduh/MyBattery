import WidgetKit
import SwiftUI

// MARK: - Colors

private extension Color {
    init(hex: String) {
        let v = UInt64(hex, radix: 16) ?? 0
        let r = Double((v >> 16) & 0xFF) / 255
        let g = Double((v >> 8)  & 0xFF) / 255
        let b = Double(v         & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }

    static let mbTeal  = Color(hex: "4a9e8e")
    static let mbCream = Color(hex: "f4f7f7")
    static let mbInk   = Color(hex: "141e1e")
}

// MARK: - Timeline (static)

struct QuickAddEntry: TimelineEntry {
    let date: Date
}

struct QuickAddProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickAddEntry { QuickAddEntry(date: .now) }
    func getSnapshot(in context: Context, completion: @escaping (QuickAddEntry) -> Void) {
        completion(QuickAddEntry(date: .now))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickAddEntry>) -> Void) {
        completion(Timeline(entries: [QuickAddEntry(date: .now)], policy: .never))
    }
}

// MARK: - View

struct QuickAddWidgetView: View {
    var body: some View {
        VStack(spacing: 8) {
            Link(destination: URL(string: "mybattery://add-task")!) {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: 44))
                    .foregroundColor(.mbTeal)
            }
            Text("Add Task")
                .font(.custom("DM Sans", size: 12))
                .foregroundColor(.mbInk)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.mbCream)
        .widgetURL(URL(string: "mybattery://add-task"))
    }
}

// MARK: - Widget

@main
struct QuickAddWidget: Widget {
    let kind = "QuickAddWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickAddProvider()) { _ in
            QuickAddWidgetView()
                .containerBackground(Color.mbCream, for: .widget)
        }
        .configurationDisplayName("Quick Add Task")
        .description("Add a task without opening the app.")
        .supportedFamilies([.systemSmall])
    }
}
