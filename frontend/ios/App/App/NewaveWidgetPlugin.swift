import Capacitor
import Foundation
import WidgetKit

@objc(NewaveWidgetPlugin)
public class NewaveWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NewaveWidgetPlugin"
    public let jsName = "NewaveWidgets"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "refresh", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pin", returnType: CAPPluginReturnPromise)
    ]
    private func state() throws -> [String: Any] {
        let session = try NewaveWidgetStore.shared.read()
        return ["connected": session != nil, "scope": session?.scope ?? "", "expiresAt": session?.expiresAt ?? "",
            "lastCheckAt": session?.lastCheckAt ?? "", "error": session?.error ?? ""]
    }
    @objc func configure(_ call: CAPPluginCall) {
        do {
            guard let raw = call.getString("session"), let data = raw.data(using: .utf8), data.count <= 131_072 else { throw WidgetStoreError.invalid }
            let session = try JSONDecoder().decode(WidgetSession.self, from: data)
            guard WidgetNetwork.validBase(session.baseURL), !session.token.isEmpty, session.token.count <= 4096,
                  session.snapshot?.schemaVersion == 1 else { throw WidgetStoreError.invalid }
            try NewaveWidgetStore.shared.configure(session)
            WidgetCenter.shared.reloadAllTimelines(); call.resolve(try state())
        } catch { call.reject("Unable to configure widget") }
    }
    @objc func clear(_ call: CAPPluginCall) {
        do { try NewaveWidgetStore.shared.clear(); WidgetCenter.shared.reloadAllTimelines(); call.resolve(try state()) }
        catch { call.reject("Unable to clear widget") }
    }
    @objc func getState(_ call: CAPPluginCall) { do { call.resolve(try state()) } catch { call.reject("Unable to read widget") } }
    @objc func refresh(_ call: CAPPluginCall) {
        Task {
            await WidgetNetwork.refresh()
            WidgetCenter.shared.reloadAllTimelines()
            do { call.resolve(try state()) } catch { call.reject("Unable to refresh widget") }
        }
    }
    @objc func pin(_ call: CAPPluginCall) { call.resolve(["supported": false]) }
}
