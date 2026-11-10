import WidgetKit
import SwiftUI

struct NewaveEntry: TimelineEntry { let date: Date; let session: WidgetSession? }
struct NewaveProvider: TimelineProvider {
    func placeholder(in context: Context) -> NewaveEntry { NewaveEntry(date: Date(), session: nil) }
    func getSnapshot(in context: Context, completion: @escaping (NewaveEntry) -> Void) {
        completion(NewaveEntry(date: Date(), session: try? NewaveWidgetStore.shared.read()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<NewaveEntry>) -> Void) {
        Task {
            await WidgetNetwork.refresh()
            let now = Date(), session = try? NewaveWidgetStore.shared.read()
            var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(identifier: "Asia/Seoul")!
            let midnight = calendar.startOfDay(for: now).addingTimeInterval(24*60*60)
            completion(Timeline(entries: [NewaveEntry(date: now, session: session), NewaveEntry(date: midnight, session: nil)],
                policy: .after(now.addingTimeInterval(30*60))))
        }
    }
}

@available(iOS 17.0, *)
struct NewaveWidgetView: View {
    let entry: NewaveEntry
    @Environment(\.widgetFamily) var family
    private let navy = Color(red: 0.04, green: 0.20, blue: 0.54)
    private let green = Color(red: 0.13, green: 0.40, blue: 0.28)
    private var snapshot: WidgetSnapshot? {
        guard let snapshot = entry.session?.snapshot, snapshot.date == WidgetLinks.today(entry.date) else { return nil }
        return snapshot
    }
    private var tasks: [WidgetTask] { snapshot?.tasks.filter { $0.state != "none" } ?? [] }
    private var progress: String { "이번 주  \(tasks.filter { $0.state == "done" }.count) / \(tasks.count)" }
    var body: some View {
        VStack(alignment: .leading, spacing: family == .systemLarge ? 10 : 6) {
            HStack { Text("NEWAVE").font(.system(size: 15, weight: .black, design: .rounded)); Text("FLOW").font(.system(size: 10, weight: .bold)).foregroundStyle(green); Spacer(); Text(String(WidgetLinks.today(entry.date).suffix(5)).replacingOccurrences(of: "-", with: ".")).font(.caption2).foregroundStyle(green) }
            if let snapshot = snapshot {
                if let error = entry.session?.error { Link(error, destination: WidgetLinks.url("/profile/widgets")).font(.caption2).foregroundStyle(.orange).lineLimit(1) }
                if family == .systemMedium {
                    HStack(alignment: .top, spacing: 14) {
                        spiritual(snapshot).frame(maxWidth: .infinity, alignment: .leading)
                        VStack(alignment: .leading, spacing: 8) { schedule(snapshot); weekly(limit: 1) }.frame(maxWidth: .infinity, alignment: .leading)
                    }
                } else { schedule(snapshot); spiritual(snapshot); weekly(limit: 2) }
            } else {
                Spacer(); Link("앱을 열어 오늘의 체크를 확인해주세요", destination: WidgetLinks.url("/profile/widgets")).font(.system(size: 14, weight: .medium)).foregroundStyle(green); Spacer()
            }
        }
        .foregroundStyle(navy).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(.white, for: .widget)
        .widgetURL(WidgetLinks.url("/profile/widgets"))
        .privacySensitive()
    }
    @ViewBuilder private func schedule(_ snapshot: WidgetSnapshot) -> some View {
        if let event = snapshot.events.first {
            Link(destination: WidgetLinks.url(event.path)) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("가까운 일정 · \(event.date.suffix(5)) \(event.time)").font(.system(size: 10)).foregroundStyle(green).lineLimit(1)
                    Text(event.title).font(.system(size: 13, weight: .semibold)).lineLimit(2)
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
        } else { Text("등록된 일정이 없어요").font(.caption).foregroundStyle(.secondary) }
    }
    private func spiritual(_ snapshot: WidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack { Text("오늘 영성 체크").font(.system(size: 11, weight: .semibold)); Spacer(); Link("전체 ›", destination: WidgetLinks.url("/tts")).font(.system(size: 10)) }.foregroundStyle(green)
            if snapshot.checks.isEmpty { Link("오늘 체크할 항목이 없어요", destination: WidgetLinks.url("/tts")).font(.caption2).foregroundStyle(.secondary) }
            ForEach(Array(snapshot.checks.prefix(3))) { check in
                Button(intent: WidgetCheckIntent(check, date: snapshot.date, scope: entry.session?.scope ?? "")) {
                    HStack(spacing: 7) { Image(systemName: check.checked ? "checkmark.circle.fill" : "circle").foregroundStyle(check.checked ? green : navy.opacity(0.4)); Text(check.title).font(.system(size: 12, weight: .medium)).lineLimit(1); Spacer(minLength: 0) }
                        .frame(minHeight: 26).padding(.horizontal, 7).background(check.checked ? green.opacity(0.08) : navy.opacity(0.04), in: RoundedRectangle(cornerRadius: 9))
                }.buttonStyle(.plain).disabled(entry.session?.error != nil).accessibilityLabel("\(check.title), \(check.checked ? "체크됨" : "미체크")")
            }
        }
    }
    private func weekly(limit: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Link(progress, destination: WidgetLinks.url("/")).font(.system(size: 11, weight: .semibold)).foregroundStyle(green)
            ForEach(Array(tasks.sorted { ($0.state == "done" ? 1 : 0) < ($1.state == "done" ? 1 : 0) }.prefix(limit))) { task in
                Link(destination: WidgetLinks.url(task.path)) {
                    HStack { Text(task.title).lineLimit(1); Spacer(minLength: 2); Text(task.state == "done" ? "완료" : "확인 ›").foregroundStyle(task.state == "done" ? green : navy) }.font(.system(size: 11)).frame(minHeight: 20)
                }
            }
        }
    }
}

@main
struct NewaveWidgets: Widget {
    let kind = NewaveWidgetStore.kind
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NewaveProvider()) { entry in NewaveWidgetView(entry: entry) }
            .configurationDisplayName("뉴웨이브 · 나의 체크")
            .description("가까운 일정과 영성 체크, 이번 주 체크사항")
            .supportedFamilies([.systemMedium, .systemLarge])
    }
}
