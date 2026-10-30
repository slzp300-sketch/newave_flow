import XCTest
import UIKit
import WebKit
import AuthenticationServices
@testable import App

final class NewaveKeychainTests: XCTestCase {
    private var store: NewaveKeychainStore!

    func testReportExportValidatesFileNamesAndDocumentBytes() throws {
        let pdf = Data("%PDF-1.7 synthetic".utf8)
        let valid = try NewaveReportFile(filename: "청소년부 주간보고서 (2026-10-25).pdf", base64: pdf.base64EncodedString())
        XCTAssertEqual(valid.data, pdf)
        let hwpx = Data([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff])
        XCTAssertEqual(try NewaveReportFile(filename: "청소년부 주간보고서 (2026-10-25).hwpx", base64: hwpx.base64EncodedString()).data, hwpx)
        for filename in ["../report.pdf", "청소년부 주간보고서 (2026-10-25).html", "청소년부 주간보고서 (2026-10-25).pdf\n"] {
            XCTAssertThrowsError(try NewaveReportFile(filename: filename, base64: pdf.base64EncodedString()))
        }
        for base64 in ["", "invalid!", Data("<html>error</html>".utf8).base64EncodedString(), hwpx.base64EncodedString()] {
            XCTAssertThrowsError(try NewaveReportFile(filename: valid.filename, base64: base64))
        }
        XCTAssertThrowsError(try NewaveReportFile(filename: valid.filename, base64: Data(repeating: 65, count: NewaveReportFile.maxBytes + 1).base64EncodedString()))
    }

    func testReportTemporaryCopiesStaySeparateAndAreRemovedAfterExport() throws {
        let report = try NewaveReportFile(filename: "청소년부 주간보고서 (2026-10-25).pdf", base64: Data("%PDF-1.7 synthetic".utf8).base64EncodedString())
        let first = try report.writeTemporaryCopy()
        let second = try report.writeTemporaryCopy()
        defer { NewaveReportFile.removeTemporaryCopy(first); NewaveReportFile.removeTemporaryCopy(second) }
        XCTAssertNotEqual(first, second)
        XCTAssertEqual(try Data(contentsOf: first), report.data)
        NewaveReportFile.removeTemporaryCopy(first)
        XCTAssertFalse(FileManager.default.fileExists(atPath: first.deletingLastPathComponent().path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: second.path))
    }

    @MainActor
    func testReportBridgePresentsSaveDialogAndResolvesCancellation() async throws {
        let controller = NewaveBridgeViewController()
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previousKeyWindow = scene.windows.first { $0.isKeyWindow }
        let window = UIWindow(windowScene: scene)
        window.rootViewController = controller
        window.makeKeyAndVisible()
        defer { window.isHidden = true; previousKeyWindow?.makeKeyAndVisible() }
        controller.loadViewIfNeeded()
        let webView = try XCTUnwrap(controller.webView)
        let deadline = Date().addingTimeInterval(15)
        while (webView.isLoading || webView.url == nil) && Date() < deadline {
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        for (format, data) in [("pdf", Data("%PDF-1.7 synthetic".utf8)), ("hwpx", Data([0x50, 0x4b, 0x03, 0x04, 0x00]))] {
            let pending = Task { @MainActor in
                try await webView.callAsyncJavaScript("""
                    return await Capacitor.nativePromise('NewaveReportExport', 'save', { filename, base64 });
                    """, arguments: ["filename": "청소년부 주간보고서 (2026-10-25).\(format)", "base64": data.base64EncodedString()], in: nil, contentWorld: .page)
            }
            let presentedBy = Date().addingTimeInterval(10)
            while controller.presentedViewController == nil && Date() < presentedBy {
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            let picker = try XCTUnwrap(controller.presentedViewController as? UIDocumentPickerViewController)
            XCTAssertTrue(picker.shouldShowFileExtensions)
            picker.delegate?.documentPickerWasCancelled?(picker)
            picker.dismiss(animated: false)
            let result = try await pending.value as? [String: Any]
            XCTAssertEqual(result?["cancelled"] as? Bool, true)
        }
    }

    @MainActor func testAppleRevocationObserverRemovesNotificationSubscriptionOnRelease() {
        let center = NotificationCenter()
        var received = 0
        var observer: NewaveAppleCredentialObserver? = NewaveAppleCredentialObserver(center: center) { received += 1 }
        XCTAssertNotNil(observer)
        center.post(name: ASAuthorizationAppleIDProvider.credentialRevokedNotification, object: nil)
        XCTAssertEqual(received, 1)
        observer = nil
        center.post(name: ASAuthorizationAppleIDProvider.credentialRevokedNotification, object: nil)
        XCTAssertEqual(received, 1)
    }

    @MainActor func testAppleRequestPreservesNonceStateAndRejectsMalformedProof() throws {
        let nonce = String(repeating: "n", count: 43)
        let state = String(repeating: "s", count: 43)
        let request = try XCTUnwrap(NewaveAppleSignInPlugin.makeRequest(nonce: nonce, state: state))
        XCTAssertEqual(request.nonce, nonce)
        XCTAssertEqual(request.state, state)
        XCTAssertEqual(request.requestedScopes, [.fullName, .email])
        XCTAssertNil(NewaveAppleSignInPlugin.makeRequest(nonce: "short", state: state))
        XCTAssertNil(NewaveAppleSignInPlugin.makeRequest(nonce: nonce, state: state + "\n"))
        XCTAssertNil(NewaveAppleSignInPlugin.makeRequest(nonce: String(repeating: "x", count: 129), state: state))
    }

    override func setUpWithError() throws {
        store = NewaveKeychainStore(service: "app.newaveflow.synthetic-tests.\(UUID().uuidString)")
    }

    override func tearDownWithError() throws {
        try store.remove("newave-auth")
        try store.remove("newave-kakao-pending")
        try store.remove("newave-deletion-receipt")
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
        try store.set("newave-deletion-receipt", value: "synthetic receipt")
        try store.set("newave-auth", value: "old synthetic session")
        try store.set("newave-auth", value: "new synthetic session")
        XCTAssertEqual(try store.get("newave-auth"), "new synthetic session")
        try store.remove("newave-auth")
        try store.remove("newave-auth")
        XCTAssertNil(try store.get("newave-auth"))
        XCTAssertEqual(try store.get("newave-deletion-receipt"), "synthetic receipt")
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
        XCTAssertNotNil(controller.bridge?.plugin(withName: "NewaveReportExport"))
        let webView = try XCTUnwrap(controller.webView)
        let deadline = Date().addingTimeInterval(15)
        while webView.isLoading && Date() < deadline {
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertEqual(webView.url?.scheme, "capacitor")
        let result = try await webView.callAsyncJavaScript("""
            const readyBy = Date.now() + 30000;
            const loginReady = () => document.querySelector('#root form #login-password')
                && document.querySelector('#root form button[type="submit"]')?.textContent.includes('로그인');
            while (!loginReady() && Date.now() < readyBy) await new Promise(resolve => setTimeout(resolve, 100));
            if (!loginReady()) throw new Error('The packaged React login screen did not render after native storage hydration');
            const fields = [...document.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]), select, textarea')];
            if (fields.some(field => parseFloat(getComputedStyle(field).fontSize) < 16)) throw new Error('iOS login fields must not trigger focus zoom');
            if (document.querySelector('meta[name="viewport"]').content.includes('user-scalable=no')) throw new Error('User pinch zoom must remain available');
            const options = document.querySelector('button[aria-controls="account-environment-options"]');
            if (!options || options.getAttribute('aria-expanded') !== 'false' || document.querySelector('input[value="review"]')) throw new Error('Review options must be publicly discoverable but initially collapsed');
            options.click();
            await new Promise(resolve => setTimeout(resolve, 350));
            document.querySelector('input[value="review"]').click();
            await new Promise(resolve => setTimeout(resolve, 100));
            if (!document.querySelector('form button[type="submit"]').textContent.includes('가상 자료')) throw new Error('Review login must remain explicitly selectable');
            document.querySelector('input[value="production"]').click(); options.click();
            await new Promise(resolve => setTimeout(resolve, 350));
            const viewport = (method, options = {}) => Capacitor.nativePromise('NewaveAuthViewport', method, options);
            await viewport('prepare');
            if ((await viewport('restore', { finish: true, force: false })).restored !== true) throw new Error('Native authentication viewport bridge did not restore');
            if ((await viewport('restore', { finish: false, force: false })).restored !== false) throw new Error('Ordinary resume must preserve user zoom');
            const storage = (method, options) => Capacitor.nativePromise('NewaveSecureStorage', method, options);
            const apple = (method, options = {}) => Capacitor.nativePromise('NewaveAppleSignIn', method, options);
            const availability = await apple('getAvailability');
            if (availability.available !== false) throw new Error('Simulator CI must keep Apple login disabled');
            try {
                await apple('signIn', { nonce: 'n'.repeat(43), state: 's'.repeat(43) });
                throw new Error('Unconfigured Apple sign-in must reject before showing a sheet');
            } catch (error) {
                if (error.code !== 'APPLE_NOT_CONFIGURED') throw error;
            }
            const artwork = await apple('buttonImage', { width: 327 });
            if (!artwork.image?.startsWith('data:image/png;base64,') || artwork.image.length < 1000) throw new Error('System Apple button artwork is missing');
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
    @MainActor
    func testAuthenticationViewportRestoresOnlyTheAuthHandoff() {
        let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        let viewport = NewaveAuthViewport()
        let originalPinchEnabled = webView.scrollView.pinchGestureRecognizer?.isEnabled
        webView.pageZoom = 1.4
        XCTAssertFalse(viewport.restore(webView, finish: false))
        XCTAssertEqual(webView.pageZoom, 1.4)
        viewport.prepare(webView)
        XCTAssertTrue(viewport.pending)
        XCTAssertEqual(webView.pageZoom, 1)
        webView.pageZoom = 1.3
        XCTAssertTrue(viewport.restore(webView, finish: false))
        XCTAssertEqual(webView.pageZoom, 1)
        XCTAssertTrue(viewport.pending)
        webView.pageZoom = 1.2
        XCTAssertTrue(viewport.restore(webView, finish: true))
        XCTAssertEqual(webView.pageZoom, 1)
        XCTAssertFalse(viewport.pending)
        webView.pageZoom = 1.5
        XCTAssertFalse(viewport.restore(webView, finish: false))
        XCTAssertEqual(webView.pageZoom, 1.5)
        XCTAssertTrue(viewport.restore(webView, finish: true, force: true))
        XCTAssertEqual(webView.pageZoom, 1)
        XCTAssertEqual(webView.scrollView.pinchGestureRecognizer?.isEnabled, originalPinchEnabled)
    }

}
