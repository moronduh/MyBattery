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

    static let mbTeal      = Color(hex: "4a9e8e")
    static let mbTealLight = Color(hex: "b8ddd8")
    static let mbSlate     = Color(hex: "4a7a9b")
    static let mbGold      = Color(hex: "b87028")
    static let mbCream     = Color(hex: "f4f7f7")
    static let mbInk       = Color(hex: "141e1e")
}

// MARK: - Model

struct WidgetTask: Codable, Identifiable {
    let id: String
    let title: String
    let tier: String          // "Must" | "Should" | "Could"
    let estimatedEnergy: Int
}

private let kSuite = "group.app.web.mindfulstillflow"

private func readTasks() -> [WidgetTask] {
    guard
        let data  = UserDefaults(suiteName: kSuite)?.data(forKey: "todayTasks"),
        let tasks = try? JSONDecoder().decode([WidgetTask].self, from: data)
    else { return [] }

    let order = ["Must": 0, "Should": 1, "Could": 2]
    return tasks.sorted { (order[$0.tier] ?? 3) < (order[$1.tier] ?? 3) }
}

// MARK: - Timeline

struct TaskEntry: TimelineEntry {
    let date: Date
    let tasks: [WidgetTask]
}

struct TaskProvider: TimelineProvider {
    func placeholder(in context: Context) -> TaskEntry {
        TaskEntry(date: .now, tasks: [
            WidgetTask(id: "1", title: "Morning review", tier: "Must",   estimatedEnergy: 20),
            WidgetTask(id: "2", title: "Reply to team",  tier: "Should", estimatedEnergy: 15),
            WidgetTask(id: "3", title: "Read article",   tier: "Could",  estimatedEnergy: 10),
        ])
    }

    func getSnapshot(in context: Context, completion: @escaping (TaskEntry) -> Void) {
        completion(TaskEntry(date: .now, tasks: readTasks()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TaskEntry>) -> Void) {
        let entry   = TaskEntry(date: .now, tasks: readTasks())
        let refresh = Calendar.current.date(byAdding: .minute, value: 15, to: .now)!
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }
}

// MARK: - Tier badge

private func tierColor(_ tier: String) -> Color {
    switch tier {
    case "Must":   return .mbTeal
    case "Should": return .mbSlate
    default:       return .mbTealLight
    }
}

private struct TierBadge: View {
    let tier: String

    var body: some View {
        Text(tier)
            .font(.custom("DM Sans", size: 9))
            .fontWeight(.semibold)
            .foregroundColor(.white)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(tierColor(tier))
            .clipShape(Capsule())
    }
}

// MARK: - Task row

private struct TaskRow: View {
    let task: WidgetTask

    var body: some View {
        HStack(spacing: 8) {
            TierBadge(tier: task.tier)

            Text(task.title)
                .font(.custom("DM Sans", size: 13))
                .foregroundColor(.mbInk)
                .lineLimit(1)

            Spacer()

            Text("\(task.estimatedEnergy)%")
                .font(.custom("DM Sans", size: 11))
                .foregroundColor(.mbGold)
        }
    }
}

// MARK: - Shared layout

private struct TaskListView: View {
    let tasks: [WidgetTask]
    let limit: Int

    var body: some View {
        Link(destination: URL(string: "mybattery://tasks")!) {
            VStack(alignment: .leading, spacing: 0) {
                Text("Today")
                    .font(.custom("Playfair Display", size: 18))
                    .foregroundColor(.mbInk)
                    .padding(.bottom, 10)

                if tasks.isEmpty {
                    Spacer()
                    Text("All clear today")
                        .font(.custom("DM Sans", size: 14))
                        .foregroundColor(.mbTeal)
                        .frame(maxWidth: .infinity, alignment: .center)
                    Spacer()
                } else {
                    VStack(alignment: .leading, spacing: 9) {
                        ForEach(tasks.prefix(limit)) { task in
                            TaskRow(task: task)
                            if task.id != tasks.prefix(limit).last?.id {
                                Divider().background(Color.mbTealLight.opacity(0.5))
                            }
                        }
                    }
                }

                Spacer(minLength: 0)
            }
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(Color.mbCream)
        }
    }
}

// MARK: - Entry view

struct TaskWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: TaskEntry

    var body: some View {
        switch family {
        case .systemLarge:
            TaskListView(tasks: entry.tasks, limit: 6)
        default:
            TaskListView(tasks: entry.tasks, limit: 3)
        }
    }
}

// MARK: - Widget

@main
struct TaskPreviewWidget: Widget {
    let kind = "TaskPreviewWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TaskProvider()) { entry in
            TaskWidgetEntryView(entry: entry)
                .containerBackground(Color.mbCream, for: .widget)
        }
        .configurationDisplayName("Today's Tasks")
        .description("See your priority tasks at a glance.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}
