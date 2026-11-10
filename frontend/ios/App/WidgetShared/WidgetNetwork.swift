import Foundation
import WidgetKit

final class WidgetRedirectBlocker: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
enum WidgetNetwork {
    static func validBase(_ value: String) -> Bool {
        guard let url = URLComponents(string: value), url.scheme == "https", let host = url.host,
              host.hasSuffix(".up.railway.app"), url.port == nil, url.user == nil, url.password == nil,
              url.query == nil, url.fragment == nil, url.path == "/api" else { return false }
        return true
    }
    static func refresh(input: Data? = nil, expectedScope: String? = nil, store: NewaveWidgetStore = .shared) async {
        guard let session = try? store.read() else { return }
        if input != nil && (expectedScope == nil || expectedScope != session.scope) { return }
        guard validBase(session.baseURL), let url = URL(string: session.baseURL + (input == nil ? "/widgets/snapshot" : "/widgets/check")) else { return }
        var request = URLRequest(url: url); request.timeoutInterval = 12
        request.httpMethod = input == nil ? "GET" : "PUT"; request.httpBody = input
        request.setValue(session.token, forHTTPHeaderField: "X-Newave-Widget")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let config = URLSessionConfiguration.ephemeral; config.urlCache = nil
        config.timeoutIntervalForRequest = 12; config.timeoutIntervalForResource = 15
        let network = URLSession(configuration: config, delegate: WidgetRedirectBlocker(), delegateQueue: nil)
        defer { network.invalidateAndCancel() }
        do {
            let (data, response) = try await network.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if [401,403,428].contains(status) { try store.revoke(token: session.token); return }
            guard status == 200, data.count <= 100_000 else { throw WidgetStoreError.invalid }
            let snapshot = try JSONDecoder().decode(WidgetSnapshot.self, from: data)
            guard snapshot.schemaVersion == 1 else { throw WidgetStoreError.invalid }
            try store.update(token: session.token, snapshot: snapshot, checked: input != nil)
        } catch {
            try? store.failed(token: session.token, revision: session.snapshot?.revision ?? 0,
                message: input == nil ? "연결 확인 필요" : "저장 확인 필요 · 앱 열기")
        }
    }
}
