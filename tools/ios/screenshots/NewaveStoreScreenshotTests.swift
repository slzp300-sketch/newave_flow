import XCTest
import WebKit
@testable import App

// This source replaces the test source only in the disposable screenshot CI checkout.
// It is never linked into App.app or the normal iOS check test bundle.
private final class ScreenshotBridge: NewaveBridgeViewController {
    var bootstrap = ""
    var networkRules: WKContentRuleList!
    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        configuration.userContentController.add(networkRules)
        configuration.userContentController.addUserScript(WKUserScript(source: bootstrap,
            injectionTime: .atDocumentStart, forMainFrameOnly: true))
        return super.webView(with: frame, configuration: configuration)
    }
}

final class NewaveStoreScreenshotTests: XCTestCase {
    @MainActor func testCaptureFiveStoreScreens() async throws {
        let fixture = try XCTUnwrap(Data(base64Encoded: "__FIXTURE_BASE64__"))
        let script = try XCTUnwrap(String(data: XCTUnwrap(Data(base64Encoded: "__SCRIPT_BASE64__")), encoding: .utf8))
        let auth = try XCTUnwrap(String(data: XCTUnwrap(Data(base64Encoded: "__AUTH_BASE64__")), encoding: .utf8))
        let geometryScript = try XCTUnwrap(String(data: XCTUnwrap(Data(base64Encoded: "__GEOMETRY_BASE64__")), encoding: .utf8))
        let data = try XCTUnwrap(JSONSerialization.jsonObject(with: fixture) as? [String: Any])
        let scenes = try XCTUnwrap(data["scenes"] as? [[String: Any]])
        let rules = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<WKContentRuleList, Error>) in
            WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "newave-screenshots-no-network",
                encodedContentRuleList: """
                [{"trigger":{"url-filter":"^https?://"},"action":{"type":"block"}}]
                """) { rules, error in
                    if let error { continuation.resume(throwing: error) }
                    else if let rules { continuation.resume(returning: rules) }
                    else { continuation.resume(throwing: NSError(domain: "ScreenshotRules", code: 1)) }
                }
        }
        let directory = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("newave-store-screenshots", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let windowScene = try XCTUnwrap(UIApplication.shared.connectedScenes.first as? UIWindowScene)
        let window = try XCTUnwrap(windowScene.windows.first(where: { $0.isKeyWindow }) ?? windowScene.windows.first)
        let originalController = window.rootViewController
        let store = NewaveKeychainStore()
        UserDefaults.standard.set(true, forKey: "newave.session.install.v1")
        try store.set("newave-auth", value: auth)
        defer {
            window.rootViewController = originalController
            try? store.remove("newave-auth")
        }
        for scene in scenes {
            let filename = try XCTUnwrap(scene["file"] as? String)
            let route = try XCTUnwrap(scene["route"] as? String)
            let routeJSON = String(data: try JSONSerialization.data(withJSONObject: route, options: .fragmentsAllowed), encoding: .utf8)!
            let controller = ScreenshotBridge()
            controller.bootstrap = script + "\nhistory.replaceState(null, '', \(routeJSON));"
            controller.networkRules = rules
            window.rootViewController = controller
            window.makeKeyAndVisible()
            controller.loadViewIfNeeded()
            let webView = try XCTUnwrap(controller.webView)
            let deadline = Date().addingTimeInterval(60)
            var ready = false
            while Date() < deadline {
                if let value = try? await webView.callAsyncJavaScript("""
                    const state = window.__newaveScreenshot;
                    if (!state) return false;
                    if (state.errors.length) throw new Error(state.errors.join('; '));
                    const body = document.body?.innerText || '';
                    return Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Seoul'
                        && expected.every(text => body.includes(text)) && paths.every(path => state.requests.includes(path))
                        && !!document.querySelector('nav[aria-label="주요 메뉴"]')
                        && !document.querySelector('[role="alert"]');
                    """, arguments: ["expected": scene["text"]!, "paths": scene["requests"]!], in: nil, contentWorld: .page),
                    value as? Bool == true { ready = true; break }
                try await Task.sleep(nanoseconds: 200_000_000)
            }
            if ready {
                _ = try await webView.evaluateJavaScript("window.scrollTo(0,0); document.activeElement?.blur()")
                try await Task.sleep(nanoseconds: 1_500_000_000)
            }
            let webFrame = webView.convert(webView.bounds, to: window)
            let nativeGeometry: [String: Any] = [
                "safeTop": Double(window.safeAreaInsets.top), "safeBottom": Double(window.safeAreaInsets.bottom),
                "windowWidth": Double(window.bounds.width), "windowHeight": Double(window.bounds.height),
                "webViewOriginX": Double(webFrame.minX), "webViewOriginY": Double(webFrame.minY),
                "webViewWidth": Double(webFrame.width), "webViewHeight": Double(webFrame.height),
                "screenScale": Double(window.screen.scale), "scrollOffsetY": Double(webView.scrollView.contentOffset.y),
                "adjustedContentInsetTop": Double(webView.scrollView.adjustedContentInset.top)
            ]
            let geometry = (try? await webView.callAsyncJavaScript(geometryScript, arguments: ["native": nativeGeometry],
                in: nil, contentWorld: .page)) as? [String: Any] ?? [:]
            let diagnostics = (try? await webView.callAsyncJavaScript("""
                return JSON.stringify({timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,
                    localTime:new Date().toString(), fixture:window.__newaveScreenshot,
                    text:document.body?.innerText, geometry});
                """, arguments: ["geometry": geometry], in: nil, contentWorld: .page)) as? String ?? "WebView not ready"
            try diagnostics.write(to: directory.appendingPathComponent(filename + ".json"), atomically: true, encoding: .utf8)
            XCTAssertTrue(ready, "Screenshot screen not ready: \(filename); see synthetic diagnostics")
            guard ready else { return }
            let headerSafe = geometry["valid"] as? Bool == true
            XCTAssertTrue(headerSafe, "Header overlaps the native safe area: \(filename); see geometry diagnostics")
            guard headerSafe else { return }
            try Data(filename.utf8).write(to: directory.appendingPathComponent("ready"), options: .atomic)
            let acknowledged = directory.appendingPathComponent(filename + ".captured")
            let captureDeadline = Date().addingTimeInterval(120)
            while !FileManager.default.fileExists(atPath: acknowledged.path) && Date() < captureDeadline {
                try await Task.sleep(nanoseconds: 200_000_000)
            }
            XCTAssertTrue(FileManager.default.fileExists(atPath: acknowledged.path), "Host did not capture \(filename)")
            guard FileManager.default.fileExists(atPath: acknowledged.path) else { return }
        }
        try Data("complete".utf8).write(to: directory.appendingPathComponent("complete"), options: .atomic)
    }
}
