import Foundation
import Security

enum NewaveKeychainError: Error {
    case invalidKey
    case invalidValue
    case status(OSStatus)
}

// Each item is confined to this app and cannot migrate through iCloud/device backup.
// Login sessions and short-lived OAuth handoffs must remain independent items.
final class NewaveKeychainStore {
    private let service: String
    private static let keys: Set<String> = ["newave-auth", "newave-kakao-pending", "newave-deletion-receipt"]

    init(service: String = (Bundle.main.bundleIdentifier ?? "app.newaveflow.mobile") + ".session.v1") {
        self.service = service
    }

    private func query(_ key: String) throws -> [String: Any] {
        guard Self.keys.contains(key) else { throw NewaveKeychainError.invalidKey }
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecAttrSynchronizable as String: false
        ]
    }

    func get(_ key: String) throws -> String? {
        var request = try query(key)
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw NewaveKeychainError.status(status) }
        guard let data = result as? Data, let value = String(data: data, encoding: .utf8) else {
            throw NewaveKeychainError.invalidValue
        }
        return value
    }

    func set(_ key: String, value: String) throws {
        var request = try query(key)
        let data = Data(value.utf8)
        guard data.count <= 65_536 else { throw NewaveKeychainError.invalidValue }
        let updates: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        var status = SecItemUpdate(request as CFDictionary, updates as CFDictionary)
        if status == errSecItemNotFound {
            request.merge(updates) { _, new in new }
            status = SecItemAdd(request as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw NewaveKeychainError.status(status) }
    }

    func remove(_ key: String) throws {
        let status = SecItemDelete(try query(key) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw NewaveKeychainError.status(status)
        }
    }
}
