import Capacitor

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
        bridge?.registerPluginInstance(NewaveSecureStoragePlugin())
        bridge?.registerPluginInstance(NewaveAppleSignInPlugin())
    }
}
