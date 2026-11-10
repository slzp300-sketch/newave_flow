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
    init() {}
    init(_ check: WidgetCheck, date: String, scope: String) { self.questionId = Int(check.id); self.date = date; checked = !check.checked; expected = check.checked; self.scope = scope }
    func perform() async throws -> some IntentResult {
        let input = try JSONSerialization.data(withJSONObject: ["questionId": questionId, "date": date,
            "checked": checked, "expectedChecked": expected])
        await WidgetNetwork.refresh(input: input, expectedScope: scope)
        WidgetCenter.shared.reloadTimelines(ofKind: NewaveWidgetStore.kind)
        return .result()
    }
}
