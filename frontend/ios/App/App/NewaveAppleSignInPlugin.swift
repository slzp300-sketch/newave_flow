import AuthenticationServices
import Capacitor
import UIKit

final class NewaveAppleCredentialObserver {
    private let center: NotificationCenter
    private var observer: NSObjectProtocol?
    init(center: NotificationCenter = .default, onRevoked: @escaping () -> Void) {
        self.center = center
        observer = center.addObserver(forName: ASAuthorizationAppleIDProvider.credentialRevokedNotification,
                                      object: nil, queue: .main) { _ in onRevoked() }
    }
    deinit { if let observer = observer { center.removeObserver(observer) } }
}

// Apple tokens only cross the bridge for immediate server verification. They are never persisted here.
@objc(NewaveAppleSignInPlugin)
public class NewaveAppleSignInPlugin: CAPPlugin, CAPBridgedPlugin,
    ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "NewaveAppleSignInPlugin"
    public let jsName = "NewaveAppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getAvailability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "buttonImage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCredentialState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]
    private var pendingCall: CAPPluginCall?
    private var pendingState: String?
    private var controller: ASAuthorizationController?
    private var anchor: ASPresentationAnchor?
    private var credentialObserver: NewaveAppleCredentialObserver?

    override public func load() {
        credentialObserver = NewaveAppleCredentialObserver { [weak self] in
            self?.notifyListeners("credentialRevoked", data: [:])
        }
    }

    static var isConfigured: Bool {
        (Bundle.main.object(forInfoDictionaryKey: "NewaveAppleSignInEnabled") as? String) == "YES"
    }

    @MainActor static func makeRequest(nonce: String, state: String) -> ASAuthorizationAppleIDRequest? {
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_")
        guard (32...128).contains(nonce.utf8.count), (32...128).contains(state.utf8.count),
              nonce.unicodeScalars.allSatisfy({ allowed.contains($0) }),
              state.unicodeScalars.allSatisfy({ allowed.contains($0) }) else { return nil }
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = nonce
        request.state = state
        return request
    }

    @objc func getAvailability(_ call: CAPPluginCall) {
        call.resolve(["available": Self.isConfigured])
    }

    @objc func getCredentialState(_ call: CAPPluginCall) {
        guard Self.isConfigured else { call.reject("Apple 로그인이 아직 준비되지 않았습니다.", "APPLE_NOT_CONFIGURED"); return }
        guard let userId = call.getString("userId"), !userId.isEmpty, userId.utf8.count <= 255,
              userId.rangeOfCharacter(from: .whitespacesAndNewlines) == nil else {
            call.reject("Apple 로그인 계정을 확인하지 못했습니다.", "APPLE_INVALID_REQUEST"); return
        }
        ASAuthorizationAppleIDProvider().getCredentialState(forUserID: userId) { state, error in
            guard error == nil else {
                call.reject("Apple 계정 상태를 확인하지 못했습니다.", "APPLE_STATE_UNAVAILABLE"); return
            }
            let value: String
            switch state {
            case .authorized: value = "authorized"
            case .revoked: value = "revoked"
            case .notFound: value = "notFound"
            case .transferred: value = "transferred"
            @unknown default: value = "unknown"
            }
            call.resolve(["state": value])
        }
    }

    @objc func buttonImage(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // Render the system button instead of recreating Apple's artwork in HTML.
            let width = CGFloat(min(600, max(140, call.getInt("width") ?? 327)))
            let height: CGFloat = 48
            let button = ASAuthorizationAppleIDButton(type: .continue, style: .black)
            button.frame = CGRect(x: 0, y: 0, width: width, height: height)
            button.cornerRadius = 12
            button.layoutIfNeeded()
            let image = UIGraphicsImageRenderer(size: button.bounds.size).image { context in
                button.layer.render(in: context.cgContext)
            }
            guard let data = image.pngData() else { call.reject("Apple button unavailable"); return }
            call.resolve(["image": "data:image/png;base64," + data.base64EncodedString()])
        }
    }

    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard Self.isConfigured else {
                call.reject("Apple 로그인이 아직 준비되지 않았습니다.", "APPLE_NOT_CONFIGURED"); return
            }
            guard self.pendingCall == nil else {
                call.reject("진행 중인 Apple 로그인을 먼저 완료해 주세요.", "APPLE_BUSY"); return
            }
            guard let nonce = call.getString("nonce"), let state = call.getString("state"),
                  let request = Self.makeRequest(nonce: nonce, state: state) else {
                call.reject("Apple 인증 요청을 확인하지 못했습니다.", "APPLE_INVALID_REQUEST"); return
            }
            guard let window = self.bridge?.viewController?.view.window else {
                call.reject("Apple 로그인 화면을 열 수 없습니다.", "APPLE_PRESENTATION_UNAVAILABLE"); return
            }
            self.pendingCall = call
            self.pendingState = state
            self.anchor = window
            let controller = ASAuthorizationController(authorizationRequests: [request])
            self.controller = controller
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        // This delegate is only assigned after a live window is retained above.
        return anchor ?? ASPresentationAnchor()
    }

    public func authorizationController(controller: ASAuthorizationController,
                                        didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = pendingCall else { return }
        defer { clearPending() }
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              credential.state == pendingState,
              let tokenData = credential.identityToken, let token = String(data: tokenData, encoding: .utf8), !token.isEmpty,
              let codeData = credential.authorizationCode, let code = String(data: codeData, encoding: .utf8), !code.isEmpty else {
            call.reject("Apple 인증 응답을 확인하지 못했습니다.", "APPLE_INVALID_RESPONSE"); return
        }
        var result: [String: JSValue] = ["identityToken": token, "authorizationCode": code, "state": credential.state ?? ""]
        // Apple may provide these fields only the first time. They never identify an existing app account.
        if let email = credential.email { result["email"] = email }
        if let givenName = credential.fullName?.givenName { result["givenName"] = givenName }
        if let familyName = credential.fullName?.familyName { result["familyName"] = familyName }
        call.resolve(result)
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = pendingCall else { return }
        defer { clearPending() }
        if let appleError = error as? ASAuthorizationError, appleError.code == .canceled {
            call.reject("Apple 로그인을 취소했습니다.", "APPLE_CANCELLED")
        } else {
            // Do not send provider errors or credentials to logs or the web UI.
            call.reject("Apple 로그인을 완료하지 못했습니다. 다시 시도해 주세요.", "APPLE_FAILED")
        }
    }

    private func clearPending() {
        pendingCall = nil
        pendingState = nil
        controller = nil
        anchor = nil
    }
}
