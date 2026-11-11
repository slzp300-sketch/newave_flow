import AppIntents
import WidgetKit
import Foundation

@available(iOS 17.0, *)
struct WidgetCheckIntent: AppIntent {
    static var title: LocalizedStringResource = "영성 체크"
    static var openAppWhenRun = false
    @Parameter(title: "항목") var questionId: Int
    @Parameter(title: "날짜") var date: String
    @Parameter(title: "체크") var checked: Bool
    @Parameter(title: "기존 체크") var expected: Bool
    @Parameter(title: "계정") var scope: String
    @Parameter(title: "위젯 종류", default: "NewavePersonalWidget") var originKind: String
    init() {}
    init(_ check: WidgetCheck, date: String, scope: String, kind: String = NewaveWidgetStore.kind) { self.questionId = Int(check.id); self.date = date; checked = !check.checked; expected = check.checked; self.scope = scope; originKind = kind }
    func perform() async throws -> some IntentResult {
        let input = try JSONSerialization.data(withJSONObject: ["questionId": questionId, "date": date,
            "checked": checked, "expectedChecked": expected])
        await WidgetNetwork.refresh(input: input, expectedScope: scope)
        // WidgetKit reloads the originating kind after perform. Refresh the
        // other kinds too, using the confirmed shared snapshot without a GET.
        for variant in WidgetVariant.allCases where variant.kind != originKind {
            WidgetCenter.shared.reloadTimelines(ofKind: variant.kind)
        }
        return .result()
    }
}
