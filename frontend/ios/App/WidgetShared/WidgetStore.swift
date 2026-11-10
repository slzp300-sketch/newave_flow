import Foundation
import Security
import Darwin

struct WidgetCheck: Codable, Identifiable { let id: Int64; let title: String; let checked: Bool }
struct WidgetTask: Codable, Identifiable { let id: String; let title: String; let state: String; let path: String }
struct WidgetSchedule: Codable { let title: String; let date: String; let time: String; let path: String }
struct WidgetSnapshot: Codable {
    let schemaVersion: Int; let revision: Int64; let generatedAt: String; let date: String; let validUntil: String
    let events: [WidgetSchedule]; let checks: [WidgetCheck]; let tasks: [WidgetTask]
}
struct WidgetSession: Codable {
    let token: String; let baseURL: String; let scope: String; let expiresAt: String
    var snapshot: WidgetSnapshot?; var error: String?; var lastCheckAt: String?
}
enum WidgetStoreError: Error { case unavailable, invalid, keychain(OSStatus) }

final class NewaveWidgetStore {
    static let kind = "NewavePersonalWidget"
    static let appGroup = "group.app.newaveflow.mobile.widgets"
    static let shared = NewaveWidgetStore()
    private let service: String
    private let accessGroup: String?
    private let directory: URL?
    init(service: String = "app.newaveflow.mobile.widget.v1",
         accessGroup: String? = Bundle.main.object(forInfoDictionaryKey: "NewaveWidgetKeychainGroup") as? String,
         directory: URL? = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: NewaveWidgetStore.appGroup)) {
        self.service = service; self.accessGroup = accessGroup; self.directory = directory
    }
    private func locked<T>(_ operation: () throws -> T) throws -> T {
        guard let directory = directory else { throw WidgetStoreError.unavailable }
        let descriptor = open(directory.appendingPathComponent("widget.lock").path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
        guard descriptor >= 0 else { throw WidgetStoreError.unavailable }
        defer { close(descriptor) }
        guard flock(descriptor, LOCK_EX) == 0 else { throw WidgetStoreError.unavailable }
        defer { flock(descriptor, LOCK_UN) }
        return try operation()
    }
    private var query: [String: Any] {
        var result: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
            kSecAttrAccount as String: "widget-session", kSecAttrSynchronizable as String: false]
        if let group = accessGroup { result[kSecAttrAccessGroup as String] = group }
        return result
    }
    private func readUnlocked() throws -> WidgetSession? {
        var request = query; request[kSecReturnData as String] = true; request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?; let status = SecItemCopyMatching(request as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw WidgetStoreError.keychain(status) }
        guard let data = result as? Data else { throw WidgetStoreError.invalid }
        return try JSONDecoder().decode(WidgetSession.self, from: data)
    }
    private func writeUnlocked(_ session: WidgetSession) throws {
        let data = try JSONEncoder().encode(session)
        guard data.count <= 131_072 else { throw WidgetStoreError.invalid }
        let value: [String: Any] = [kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        var status = SecItemUpdate(query as CFDictionary, value as CFDictionary)
        if status == errSecItemNotFound { var request = query; request.merge(value) { _, new in new }; status = SecItemAdd(request as CFDictionary, nil) }
        guard status == errSecSuccess else { throw WidgetStoreError.keychain(status) }
    }
    private func clearUnlocked() throws {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw WidgetStoreError.keychain(status) }
    }
    func read() throws -> WidgetSession? { try locked { try readUnlocked() } }
    func configure(_ session: WidgetSession) throws { try locked { try writeUnlocked(session) } }
    func clear() throws { try locked { try clearUnlocked() } }
    func revoke(token: String) throws { try locked { if try readUnlocked()?.token == token { try clearUnlocked() } } }
    func update(token: String, snapshot: WidgetSnapshot, checked: Bool) throws {
        try locked {
            guard var current = try readUnlocked(), current.token == token,
                  snapshot.revision >= (current.snapshot?.revision ?? 0) else { return }
            current.snapshot = snapshot; current.error = nil
            if checked { current.lastCheckAt = snapshot.generatedAt }
            try writeUnlocked(current)
        }
    }
    func failed(token: String, revision: Int64, message: String) throws {
        try locked {
            guard var current = try readUnlocked(), current.token == token,
                  (current.snapshot?.revision ?? 0) <= revision else { return }
            current.error = message; try writeUnlocked(current)
        }
    }
}

enum WidgetLinks {
    static func url(_ path: String) -> URL {
        var components = URLComponents(); components.scheme = "newaveflow"; components.host = "widget"; components.path = "/open"
        components.queryItems = [URLQueryItem(name: "path", value: path)]
        return components.url!
    }
    static func today(_ date: Date = Date()) -> String {
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul"); formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
