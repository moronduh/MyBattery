import WidgetKit
import SwiftUI

// MARK: - Palette

private extension Color {
    static let mbTeal      = Color(red: 74/255,  green: 158/255, blue: 142/255)
    static let mbTealDark  = Color(red: 31/255,  green: 122/255, blue: 104/255)
    static let mbTealLight = Color(red: 184/255, green: 221/255, blue: 216/255)
    static let mbSlate     = Color(red: 74/255,  green: 122/255, blue: 155/255)
    static let mbCream     = Color(red: 244/255, green: 247/255, blue: 247/255)
    static let mbRed       = Color(red: 217/255, green: 79/255,  blue: 79/255)
    static let mbGold      = Color(red: 200/255, green: 144/255, blue: 58/255)
}

// MARK: - Timeline entry

struct EnergyDisplayEntry: TimelineEntry {
    let date: Date
    let level: Int
    let lastUpdated: Date?
}

// MARK: - Provider

struct EnergyDisplayProvider: TimelineProvider {
    private let suite = UserDefaults(suiteName: "group.app.web.mindfulstillflow")

    func placeholder(in context: Context) -> EnergyDisplayEntry {
        EnergyDisplayEntry(date: Date(), level: 72, lastUpdated: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (EnergyDisplayEntry) -> Void) {
        completion(makeEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<EnergyDisplayEntry>) -> Void) {
        let entry = makeEntry()
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: entry.date) ?? entry.date
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func makeEntry() -> EnergyDisplayEntry {
        let level = suite?.object(forKey: "energyLevel") != nil
            ? suite!.integer(forKey: "energyLevel")
            : 100
        let ts = suite?.double(forKey: "lastUpdated") ?? 0
        return EnergyDisplayEntry(
            date: Date(),
            level: level,
            lastUpdated: ts > 0 ? Date(timeIntervalSince1970: ts) : nil
        )
    }
}

// MARK: - Helpers

// Single color function drives both the bar and all text accents.
private func levelColor(level: Int) -> Color {
    if level <= 25 { return .mbRed }
    if level <= 45 { return .mbGold }
    if level <= 70 { return .mbTeal }
    return .mbTealDark
}

private func contextLabel(level: Int) -> String {
    if level <= 25 { return "Running on empty" }
    if level <= 45 { return "Running low" }
    if level <= 70 { return "Moderate energy" }
    return "Feeling charged"
}

private func updatedString(from date: Date?) -> String {
    guard let date else { return "Not synced yet" }
    let mins = max(0, Int(Date().timeIntervalSince(date) / 60))
    if mins < 1  { return "Just updated" }
    if mins < 60 { return "Updated \(mins) min ago" }
    let hrs = mins / 60
    return hrs == 1 ? "Updated 1 hr ago" : "Updated \(hrs) hrs ago"
}

// MARK: - Battery bar

private struct BatteryBar: View {
    let level: Int

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(levelColor(level: level).opacity(0.18))
                Capsule()
                    .fill(levelColor(level: level))
                    .frame(width: geo.size.width * CGFloat(max(0, min(100, level))) / 100)
            }
        }
        .frame(height: 6)
    }
}

// MARK: - Small view

private struct EnergySmallView: View {
    let entry: EnergyDisplayEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Spacer()
            Text("\(entry.level)%")
                .font(.custom("PlayfairDisplay-Regular", size: 44))
                .foregroundColor(levelColor(level: entry.level))
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            BatteryBar(level: entry.level)
            Text("Your Energy")
                .font(.custom("DMSans-Regular", size: 11))
                .foregroundColor(levelColor(level: entry.level).opacity(0.7))
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

// MARK: - Medium view

private struct EnergyMediumView: View {
    let entry: EnergyDisplayEntry

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text("\(entry.level)%")
                    .font(.custom("PlayfairDisplay-Regular", size: 48))
                    .foregroundColor(levelColor(level: entry.level))
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                BatteryBar(level: entry.level)
                    .frame(maxWidth: 120)
                Text("Your Energy")
                    .font(.custom("DMSans-Regular", size: 11))
                    .foregroundColor(levelColor(level: entry.level).opacity(0.7))
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 8) {
                Text(contextLabel(level: entry.level))
                    .font(.custom("DMSans-Medium", size: 13))
                    .foregroundColor(levelColor(level: entry.level))
                    .multilineTextAlignment(.trailing)
                Text(updatedString(from: entry.lastUpdated))
                    .font(.custom("DMSans-Regular", size: 10))
                    .foregroundColor(.mbSlate)
                    .multilineTextAlignment(.trailing)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Entry view

struct EnergyDisplayWidgetEntryView: View {
    let entry: EnergyDisplayEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        Group {
            switch family {
            case .systemSmall: EnergySmallView(entry: entry)
            default:           EnergyMediumView(entry: entry)
            }
        }
        .widgetURL(URL(string: "mybattery://log-energy")!)
    }
}

// MARK: - Widget

struct EnergyDisplayWidget: Widget {
    let kind = "EnergyDisplayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: EnergyDisplayProvider()) { entry in
            if #available(iOS 17.0, *) {
                EnergyDisplayWidgetEntryView(entry: entry)
                    .containerBackground(Color.mbCream, for: .widget)
            } else {
                EnergyDisplayWidgetEntryView(entry: entry)
                    .padding()
                    .background(Color.mbCream)
            }
        }
        .configurationDisplayName("My Energy")
        .description("Your current energy level at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
