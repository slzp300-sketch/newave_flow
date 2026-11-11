import WidgetKit
import SwiftUI

struct NewaveEntry: TimelineEntry { let date: Date; let session: WidgetSession? }
struct NewaveProvider: TimelineProvider {
    static func example() -> NewaveEntry {
        let now = Date(), today = WidgetLinks.today(now)
        let snapshot = WidgetSnapshot(schemaVersion: 1, revision: 0, generatedAt: ISO8601DateFormatter().string(from: now),
            date: today, validUntil: "", events: [WidgetSchedule(title: "청소년부 예배", date: today, time: "10:00", path: "/calendar")],
            checks: [WidgetCheck(id: -1, title: "말씀", checked: true), WidgetCheck(id: -2, title: "기도", checked: false), WidgetCheck(id: -3, title: "묵상", checked: false)],
            tasks: [WidgetTask(id: "prayer", title: "기도모임 투표", state: "pending", path: "/meeting/prayer"),
                    WidgetTask(id: "meeting", title: "교사회의 체크", state: "pending", path: "/meeting/sat")], calendarDates: [today])
        return NewaveEntry(date: now, session: WidgetSession(token: "", baseURL: "", scope: "preview", expiresAt: "", snapshot: snapshot))
    }
    func placeholder(in context: Context) -> NewaveEntry { Self.example() }
    func getSnapshot(in context: Context, completion: @escaping (NewaveEntry) -> Void) {
        completion(context.isPreview ? Self.example() : NewaveEntry(date: Date(), session: try? NewaveWidgetStore.shared.read()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<NewaveEntry>) -> Void) {
        Task {
            let cached = try? NewaveWidgetStore.shared.read()
            if cached?.hasRecentConfirmedCheck() != true && cached?.hasRecentSnapshot() != true { await WidgetNetwork.refresh() }
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
    let variant: WidgetVariant
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var colorScheme
    private var large: Bool { family == .systemLarge }
    private var navy: Color { colorScheme == .dark ? Color(red: 0.72, green: 0.81, blue: 1) : Color(red: 0.04, green: 0.20, blue: 0.54) }
    private var green: Color { colorScheme == .dark ? Color(red: 0.55, green: 0.83, blue: 0.65) : Color(red: 0.14, green: 0.40, blue: 0.28) }
    private var surface: Color { Color(uiColor: .secondarySystemBackground) }
    private var snapshot: WidgetSnapshot? {
        guard let snapshot = entry.session?.snapshot, snapshot.date == WidgetLinks.today(entry.date) else { return nil }
        return snapshot
    }
    private var pending: [WidgetTask] { snapshot?.tasks.filter { $0.state == "pending" } ?? [] }
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 5) {
                Text("NEWAVE").font(.system(size: 14, weight: .black, design: .rounded)).italic()
                Text("FLOW").font(.system(size: 9, weight: .bold)).foregroundStyle(green)
                Spacer()
                Text(String(WidgetLinks.today(entry.date).suffix(5)).replacingOccurrences(of: "-", with: ".")).font(.system(size: 10)).foregroundStyle(.secondary)
            }
            if let snapshot = snapshot {
                if let error = entry.session?.error {
                    Link(destination: WidgetLinks.url("/profile/widgets")) {
                        Label(error, systemImage: "exclamationmark.circle").font(.system(size: 12)).lineLimit(2)
                            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    }.foregroundStyle(.orange)
                    Spacer()
                } else {
                    switch variant {
                    case .daily:
                        HStack { Text("오늘의 말씀과 기도").font(.system(size: 13, weight: .semibold)); Spacer()
                            Text("\(snapshot.checks.filter { $0.checked }.count) / \(snapshot.checks.count)").font(.system(size: 12, weight: .bold)).foregroundStyle(green) }
                        daily(snapshot, spacious: true)
                        if snapshot.checks.count > 3 && large { appLink("전체 영성 체크", path: "/tts") }
                    case .weekly: weekly(limit: large ? 4 : (pending.count > 2 ? 1 : 2))
                    case .combined:
                        schedule(snapshot.events.first)
                        HStack(spacing: 6) {
                            daily(snapshot, spacious: false)
                            Link(destination: WidgetLinks.url(pending.first?.path ?? "/")) {
                                VStack(spacing: 2) { Text("이번 주").font(.system(size: 9)); Text("\(pending.count)개").font(.system(size: 17, weight: .bold)) }
                                    .frame(width: 48, height: large ? 68 : 48).background(navy.opacity(0.06), in: RoundedRectangle(cornerRadius: 11))
                            }.accessibilityLabel("이번 주 남은 체크 \(pending.count)개")
                        }
                        if large { weekly(limit: 2) }
                    case .calendar: month(snapshot)
                    }
                }
            } else {
                Spacer()
                appLink("앱을 열어 위젯을 연결해주세요", path: "/profile/widgets")
                Spacer()
            }
        }
        .foregroundStyle(navy).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(12)
        .containerBackground(for: .widget) { variant == .daily ? green.opacity(colorScheme == .dark ? 0.12 : 0.07) : Color(uiColor: .systemBackground) }
        .widgetURL(WidgetLinks.url(variant == .calendar ? "/calendar" : variant == .daily ? "/tts" : variant == .weekly ? "/" : "/profile/widgets"))
        .privacySensitive()
    }
    private func appLink(_ title: String, path: String) -> some View {
        Link(destination: WidgetLinks.url(path)) {
            HStack { Text(title).font(.system(size: 11)); Spacer(); Image(systemName: "chevron.right").font(.system(size: 10)) }
                .frame(maxWidth: .infinity, minHeight: 44).contentShape(Rectangle())
        }
    }
    private func schedule(_ event: WidgetSchedule?) -> some View {
        Link(destination: WidgetLinks.url(event?.path ?? "/calendar")) {
            HStack(spacing: 9) {
                VStack(spacing: 0) {
                    if let event = event {
                        Text("\(Int(event.date.dropFirst(5).prefix(2)) ?? 0)월").font(.system(size: 9))
                        Text("\(Int(event.date.suffix(2)) ?? 0)").font(.system(size: 21, weight: .bold))
                    } else { Image(systemName: "calendar").font(.system(size: 22)) }
                }.frame(width: 39, height: 42).background(navy.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
                VStack(alignment: .leading, spacing: 3) {
                    Text(event?.title ?? "예정된 일정이 없어요").font(.system(size: 12, weight: .semibold)).lineLimit(1)
                    Text(event == nil ? "교회 달력 보기" : (event!.time.isEmpty ? "종일" : event!.time)).font(.system(size: 10)).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.system(size: 10))
            }.frame(maxWidth: .infinity, minHeight: 44, alignment: .leading).contentShape(Rectangle())
        }
    }
    @ViewBuilder private func daily(_ snapshot: WidgetSnapshot, spacious: Bool) -> some View {
        if snapshot.checks.isEmpty { appLink("오늘 체크할 항목이 없어요", path: "/tts") }
        else {
            let layout = spacious && large ? AnyLayout(VStackLayout(spacing: 8)) : AnyLayout(HStackLayout(spacing: 6))
            layout {
                ForEach(snapshot.checks.prefix(3)) { check in
                    Button(intent: WidgetCheckIntent(check, date: snapshot.date, scope: entry.session?.scope ?? "", kind: variant.kind)) {
                        checkLabel(check, spacious: spacious).invalidatableContent()
                    }.buttonStyle(.plain)
                    .accessibilityLabel(check.title).accessibilityValue(check.checked ? "체크 완료" : "체크 안 함")
                    .accessibilityHint(check.checked ? "체크를 해제합니다" : "체크합니다")
                }
            }
        }
    }
    private func checkLabel(_ check: WidgetCheck, spacious: Bool) -> some View {
        let layout = spacious && large ? AnyLayout(HStackLayout(spacing: 10)) : AnyLayout(VStackLayout(spacing: spacious ? 6 : 2))
        return layout {
            Image(systemName: check.checked ? "checkmark.circle.fill" : "circle").font(.system(size: spacious ? 24 : 17)).accessibilityHidden(true)
            Text(check.title).font(.system(size: spacious ? 12 : 10, weight: .semibold)).lineLimit(1)
            if spacious && large { Spacer(minLength: 0) }
        }
        .padding(.horizontal, spacious && large ? 16 : 4)
        .frame(maxWidth: .infinity, minHeight: spacious ? (large ? 68 : 72) : (large ? 68 : 48))
        .foregroundStyle(check.checked ? Color.white : green)
        .background(check.checked ? Color(red: 0.14, green: 0.40, blue: 0.28) : surface, in: RoundedRectangle(cornerRadius: 12))
        .contentShape(RoundedRectangle(cornerRadius: 12))
    }
    private func weekly(limit: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack { Text("이번 주 남은 체크").font(.system(size: 13, weight: .semibold)); Spacer()
                Text("\(pending.count)개").font(.system(size: 15, weight: .bold)).foregroundStyle(green) }
            if pending.isEmpty {
                Spacer(minLength: 0)
                Label("남은 체크가 없어요", systemImage: "checkmark.circle").font(.system(size: 13)).foregroundStyle(green).frame(maxWidth: .infinity, minHeight: 44)
                Spacer(minLength: 0)
            }
            ForEach(pending.prefix(limit)) { task in
                Link(destination: WidgetLinks.url(task.path)) {
                    HStack(spacing: 7) { Image(systemName: "circle").font(.system(size: 13)); Text(task.title).font(.system(size: 12)).lineLimit(1); Spacer(minLength: 0); Image(systemName: "chevron.right").font(.system(size: 10)) }
                        .padding(.horizontal, 9).frame(maxWidth: .infinity, minHeight: 44)
                        .background(navy.opacity(0.05), in: RoundedRectangle(cornerRadius: 10)).contentShape(Rectangle())
                }
            }
            if pending.count > limit { appLink("남은 \(pending.count - limit)개 더 보기", path: "/") }
        }
    }
    private func month(_ snapshot: WidgetSnapshot) -> some View {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Seoul")!
        let components = calendar.dateComponents([.year, .month], from: entry.date)
        let first = calendar.date(from: components)!
        let days = calendar.range(of: .day, in: .month, for: first)!.count
        let offset = calendar.component(.weekday, from: first) - 1
        let rows = (days + offset + 6) / 7
        let marked = Set(snapshot.calendarDates ?? [])
        return VStack(spacing: 3) {
            HStack { Text("\(String(components.year!))년 \(components.month!)월").font(.system(size: 16, weight: .bold)); Spacer(); Image(systemName: "calendar").font(.system(size: 14)) }
            Link(destination: WidgetLinks.url("/calendar?date=\(snapshot.date)")) {
                VStack(spacing: 1) {
                    HStack(spacing: 0) { ForEach(Array(["일","월","화","수","목","금","토"].enumerated()), id: \.offset) { _, day in Text(day).font(.system(size: 10)).foregroundStyle(.secondary).frame(maxWidth: .infinity) } }.padding(.bottom, 3)
                    ForEach(0..<rows, id: \.self) { row in
                        HStack(spacing: 0) {
                            ForEach(0..<7, id: \.self) { col in
                                let day = row * 7 + col - offset + 1
                                let valid = day > 0 && day <= days
                                let date = String(snapshot.date.prefix(8)) + String(format: "%02d", day)
                                VStack(spacing: 0) {
                                    Text(valid ? "\(day)" : "").font(.system(size: 11, weight: date == snapshot.date ? .bold : .regular))
                                        .frame(width: 18, height: 18)
                                        .foregroundStyle(date == snapshot.date ? Color.white : navy)
                                        .background(date == snapshot.date ? navy : Color.clear, in: Circle())
                                    Circle().fill(valid && marked.contains(date) ? green : Color.clear).frame(width: 3, height: 3)
                                }.frame(maxWidth: .infinity)
                            }
                        }
                    }
                }.contentShape(Rectangle())
            }.accessibilityLabel("\(components.month!)월 교회 달력 열기")
            Spacer(minLength: 0)
            Divider()
            if snapshot.calendarDates == nil { appLink("앱을 열어 일정을 새로고침해주세요", path: "/profile/widgets") }
            else {
                if snapshot.events.isEmpty { schedule(nil) }
                ForEach(Array(snapshot.events.prefix(2).enumerated()), id: \.offset) { _, event in schedule(event) }
            }
        }
    }
}

@available(iOS 17.0, *)
struct NewaveConfiguredWidget: Widget {
    let variant: WidgetVariant
    init() { variant = .combined }
    init(variant: WidgetVariant) { self.variant = variant }
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: variant.kind, provider: NewaveProvider()) { entry in NewaveWidgetView(entry: entry, variant: variant) }
            .contentMarginsDisabled() // Explicit 12pt insets keep six-row months within small-phone large widgets.
            .configurationDisplayName("뉴웨이브 · \(variant.title)")
            .description(variant == .calendar ? "한 달의 교회 일정과 가까운 모임" : variant == .daily ? "오늘의 말씀과 기도를 바로 체크" : variant == .weekly ? "이번 주 남은 체크를 확인하고 앱으로 이동" : "가까운 일정과 나의 체크를 함께")
            .supportedFamilies(variant == .calendar ? [.systemLarge] : [.systemMedium, .systemLarge])
    }
}
@main
@available(iOS 17.0, *)
struct NewaveWidgets: WidgetBundle {
    var body: some Widget {
        NewaveConfiguredWidget(variant: .daily)
        NewaveConfiguredWidget(variant: .weekly)
        NewaveConfiguredWidget(variant: .combined)
        NewaveConfiguredWidget(variant: .calendar)
    }
}
