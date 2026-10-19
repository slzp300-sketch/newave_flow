import XCTest
import UIKit
import WebKit
import AuthenticationServices
@testable import App

final class NewaveKeychainTests: XCTestCase {
    private var store: NewaveKeychainStore!

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
        let startupDeadline = Date().addingTimeInterval(60)
        let activeScene = {
            UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
                .first { $0.activationState == .foregroundActive }
        }
        while activeScene() == nil && Date() < startupDeadline {
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        let windowScene = try XCTUnwrap(
            activeScene(),
            "The packaged WebView test requires an active application window scene within 60 seconds"
        )
        let previousKeyWindow = windowScene.windows.first { $0.isKeyWindow }
        let controller = NewaveBridgeViewController()
        let testWindow = UIWindow(windowScene: windowScene)
        testWindow.frame = windowScene.coordinateSpace.bounds
        defer {
            // Keep the bridge and its window alive across every awaited WebKit operation.
            withExtendedLifetime((controller, testWindow)) {
                controller.webView?.stopLoading()
                testWindow.isHidden = true
                testWindow.rootViewController = nil
                previousKeyWindow?.makeKeyAndVisible()
            }
        }
        // An offscreen WKWebView may suspend its JavaScript and native bridge callbacks.
        testWindow.rootViewController = controller
        testWindow.makeKeyAndVisible()
        controller.loadViewIfNeeded()
        testWindow.layoutIfNeeded()
        controller.view.layoutIfNeeded()
        XCTAssertNotNil(controller.bridge?.plugin(withName: "NewaveSecureStorage"))
        let webView = try XCTUnwrap(controller.webView)
        guard webView.window === testWindow, testWindow.isKeyWindow, !testWindow.isHidden,
              webView.bounds.width > 0, webView.bounds.height > 0 else {
            XCTFail("The packaged WebView must be attached to a visible window with valid bounds")
            return
        }
        while (webView.isLoading || webView.url?.scheme != "capacitor") && Date() < startupDeadline {
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        guard !webView.isLoading, webView.url?.scheme == "capacitor" else {
            XCTFail("The packaged WebView startup did not finish within 60 seconds; JavaScript checks were not started")
            return
        }
        XCTAssertEqual(webView.url?.scheme, "capacitor")
        let result = try await webView.callAsyncJavaScript("""
            const readyBy = Date.now() + 30000;
            const loginReady = () => document.querySelector('#root form #login-password')
                && document.querySelector('#root form button[type="submit"]')?.textContent.includes('로그인');
            while (!loginReady() && Date.now() < readyBy) await new Promise(resolve => setTimeout(resolve, 100));
            if (!loginReady()) throw new Error('The packaged React login screen did not render after native storage hydration');
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
}
