import Capacitor
import WebKit

class NewaveBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        // Keychain items can outlive an uninstall. A new installation starts logged out.
        let defaults = UserDefaults.standard
        if !defaults.bool(forKey: "newave.session.install.v1") {
            let store = NewaveKeychainStore()
            do {
                try store.remove("newave-auth")
                try store.remove("newave-kakao-pending")
                try store.remove("newave-deletion-receipt")
                defaults.set(true, forKey: "newave.session.install.v1")
            } catch {
                // Keep the marker unset so clearing is retried on the next launch.
                return
            }
        }
        bridge?.registerPluginInstance(NewaveAuthViewportPlugin())
        bridge?.registerPluginInstance(NewaveSecureStoragePlugin())
        bridge?.registerPluginInstance(NewaveAppleSignInPlugin())
        bridge?.registerPluginInstance(NewaveReportExportPlugin())
    }
}

// Scope restoration to authentication handoffs; ordinary app resumes retain user zoom.
final class NewaveAuthViewport {
    private(set) var pending = false
    func prepare(_ webView: WKWebView) {
        pending = true
        _ = restore(webView, finish: false)
    }
    @discardableResult func restore(_ webView: WKWebView, finish: Bool, force: Bool = false) -> Bool {
        guard pending || force else { return false }
        webView.endEditing(true)
        webView.pageZoom = 1
        webView.scrollView.setZoomScale(1, animated: false)
        let y = webView.scrollView.contentOffset.y
        webView.scrollView.setContentOffset(CGPoint(x: 0, y: y), animated: false)
        webView.setNeedsLayout()
        webView.layoutIfNeeded()
        if finish { pending = false }
        return true
    }
}

@objc(NewaveAuthViewportPlugin)
public class NewaveAuthViewportPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NewaveAuthViewportPlugin"
    public let jsName = "NewaveAuthViewport"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise)
    ]
    private let viewport = NewaveAuthViewport()
    @objc func prepare(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let webView = self.bridge?.webView else { call.reject("App view unavailable"); return }
            self.viewport.prepare(webView)
            call.resolve()
        }
    }
    @objc func restore(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let webView = self.bridge?.webView else { call.reject("App view unavailable"); return }
            let restored = self.viewport.restore(webView, finish: call.getBool("finish") ?? false, force: call.getBool("force") ?? false)
            call.resolve(["restored": restored])
        }
    }
}
