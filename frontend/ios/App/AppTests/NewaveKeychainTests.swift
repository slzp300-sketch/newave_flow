import XCTest
import WebKit
@testable import App

final class NewaveKeychainTests: XCTestCase {
    private var store: NewaveKeychainStore!

    override func setUpWithError() throws {
        store = NewaveKeychainStore(service: "app.newaveflow.synthetic-tests.\(UUID().uuidString)")
    }

    override func tearDownWithError() throws {
        try store.remove("newave-auth")
        try store.remove("newave-kakao-pending")
    }

    func testSessionAndKakaoProofDoNotOverwriteEachOther() throws {
        try store.set("newave-auth", value: "가상 교사 session 🧪")
        try store.set("newave-kakao-pending", value: "synthetic verifier")
        XCTAssertEqual(try store.get("newave-auth"), "가상 교사 session 🧪")
        XCTAssertEqual(try store.get("newave-kakao-pending"), "synthetic verifier")
        try store.remove("newave-kakao-pending")
        XCTAssertNil(try store.get("newave-kakao-pending"))
        XCTAssertEqual(try store.get("newave-auth"), "가상 교사 session 🧪")
    }

    func testRefreshUpdatesAnExistingItemAndLogoutRemovesIt() throws {
        try store.set("newave-auth", value: "old synthetic session")
        try store.set("newave-auth", value: "new synthetic session")
        XCTAssertEqual(try store.get("newave-auth"), "new synthetic session")
        try store.remove("newave-auth")
        try store.remove("newave-auth")
        XCTAssertNil(try store.get("newave-auth"))
    }

    func testUnsupportedKeysCannotReachOtherKeychainItems() throws {
        for key in ["", "password", "other-app", "newave-auth.backup"] {
            XCTAssertThrowsError(try store.set(key, value: "synthetic"))
            XCTAssertThrowsError(try store.get(key))
            XCTAssertThrowsError(try store.remove(key))
        }
    }

    func testOversizedUtf8DoesNotReplaceAValidSession() throws {
        try store.set("newave-auth", value: "existing synthetic session")
        XCTAssertThrowsError(try store.set("newave-auth", value: String(repeating: "가", count: 22_000)))
        XCTAssertEqual(try store.get("newave-auth"), "existing synthetic session")
    }

    func testIndependentAppNamespacesCannotReadAnotherSession() throws {
        try store.set("newave-auth", value: "isolated synthetic session")
        let other = NewaveKeychainStore(service: "app.newaveflow.synthetic-tests.\(UUID().uuidString)")
        XCTAssertNil(try other.get("newave-auth"))
    }

    @MainActor
    func testPackagedWebViewHandlesFreshStorageAndKakaoDeviceProof() async throws {
        let controller = NewaveBridgeViewController()
        controller.loadViewIfNeeded()
        XCTAssertNotNil(controller.bridge?.plugin(withName: "NewaveSecureStorage"))
        let webView = try XCTUnwrap(controller.webView)
        let deadline = Date().addingTimeInterval(15)
        while webView.isLoading && Date() < deadline {
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertEqual(webView.url?.scheme, "capacitor")
        let result = try await webView.callAsyncJavaScript("""
            const storage = (method, options) => Capacitor.nativePromise('NewaveSecureStorage', method, options);
            const key = 'newave-kakao-pending';
            await storage('remove', { key });
            try {
                const empty = await storage('get', { key });
                if (!empty || empty.value !== null) throw new Error('Missing storage must resolve to an object with a null value');
                const value = '가상 기기 인증 증명 🧪';
                await storage('set', { key, value });
                if ((await storage('get', { key })).value !== value) throw new Error('Native storage bridge lost the value');
            } finally {
                await storage('remove', { key });
            }
            if ((await storage('get', { key })).value !== null) throw new Error('Removed storage must return null');
            const bytes = new Uint8Array(32);
            crypto.getRandomValues(bytes);
            const digest = await crypto.subtle.digest('SHA-256', bytes);
            return digest.byteLength;
            """, arguments: [:], in: nil, contentWorld: .page)
        XCTAssertEqual(result as? Int, 32)
    }
}
