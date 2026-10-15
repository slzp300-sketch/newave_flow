import Capacitor
import Foundation

@objc(NewaveSecureStoragePlugin)
public class NewaveSecureStoragePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NewaveSecureStoragePlugin"
    public let jsName = "NewaveSecureStorage"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise)
    ]
    private let store = NewaveKeychainStore()
    private let queue = DispatchQueue(label: "app.newaveflow.mobile.secure-session")

    private func perform(_ call: CAPPluginCall, action: @escaping (String) throws -> Void) {
        guard let key = call.getString("key") else { call.reject("Unsupported storage key"); return }
        queue.async {
            do { try action(key) }
            catch NewaveKeychainError.invalidKey { call.reject("Unsupported storage key") }
            catch NewaveKeychainError.invalidValue { call.reject("Invalid session") }
            catch { call.reject("Secure session is unavailable. Unlock the device and try again.") }
        }
    }

    @objc func get(_ call: CAPPluginCall) {
        perform(call) { key in
            if let value = try self.store.get(key) { call.resolve(["value": value]) }
            else { call.resolve(["value": NSNull()]) }
        }
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let value = call.getString("value") else { call.reject("Invalid session"); return }
        perform(call) { key in
            try self.store.set(key, value: value)
            call.resolve()
        }
    }

    @objc func remove(_ call: CAPPluginCall) {
        perform(call) { key in
            try self.store.remove(key)
            call.resolve()
        }
    }
}
