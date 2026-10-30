import Capacitor
import Foundation
import UIKit

enum NewaveReportFileError: Error { case invalidFile }

// The bridge accepts a report, never an arbitrary local path or authenticated URL.
struct NewaveReportFile {
    static let maxBytes = 25 * 1024 * 1024
    let filename: String
    let data: Data

    init(filename: String, base64: String) throws {
        let pattern = #"\A청소년부 주간보고서 \([0-9]{4}-[0-9]{2}-[0-9]{2}\)\.(pdf|hwpx)\z"#
        guard filename.range(of: pattern, options: .regularExpression) != nil,
              base64.utf8.count <= ((Self.maxBytes + 2) / 3) * 4,
              let data = Data(base64Encoded: base64), !data.isEmpty, data.count <= Self.maxBytes else {
            throw NewaveReportFileError.invalidFile
        }
        let signature: [UInt8] = filename.hasSuffix(".pdf") ? [0x25, 0x50, 0x44, 0x46, 0x2d] : [0x50, 0x4b, 0x03, 0x04]
        guard data.starts(with: signature) else { throw NewaveReportFileError.invalidFile }
        self.filename = filename
        self.data = data
    }

    func writeTemporaryCopy() throws -> URL {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("newave-report-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        do {
            let file = folder.appendingPathComponent(filename)
            try data.write(to: file, options: [.atomic, .completeFileProtection])
            return file
        } catch {
            try? FileManager.default.removeItem(at: folder)
            throw error
        }
    }

    static func removeTemporaryCopy(_ file: URL) {
        let folder = file.deletingLastPathComponent().standardizedFileURL
        guard folder.deletingLastPathComponent() == FileManager.default.temporaryDirectory.standardizedFileURL,
              folder.lastPathComponent.hasPrefix("newave-report-") else { return }
        try? FileManager.default.removeItem(at: folder)
    }
}

@objc(NewaveReportExportPlugin)
public class NewaveReportExportPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate, UIAdaptivePresentationControllerDelegate {
    public let identifier = "NewaveReportExportPlugin"
    public let jsName = "NewaveReportExport"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise)]
    private var pendingCall: CAPPluginCall?
    private var temporaryFile: URL?

    @objc func save(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let presenter = self.bridge?.viewController,
                  presenter.viewIfLoaded?.window != nil else {
                call.reject("저장 화면을 열지 못했습니다. 다시 시도해주세요."); return
            }
            guard self.pendingCall == nil, presenter.presentedViewController == nil else {
                call.reject("열려 있는 창을 닫은 뒤 다시 시도해주세요."); return
            }
            do {
                let report = try NewaveReportFile(filename: call.getString("filename") ?? "", base64: call.getString("base64") ?? "")
                let file = try report.writeTemporaryCopy()
                self.temporaryFile = file
                self.pendingCall = call
                let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
                picker.delegate = self
                picker.shouldShowFileExtensions = true
                picker.modalPresentationStyle = .formSheet
                presenter.present(picker, animated: true)
                picker.presentationController?.delegate = self
            } catch {
                call.reject("보고서를 저장하지 못했습니다. 파일을 다시 받아주세요.")
            }
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        finish(cancelled: urls.isEmpty)
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { finish(cancelled: true) }
    public func presentationControllerDidDismiss(_ presentationController: UIPresentationController) { finish(cancelled: true) }

    private func finish(cancelled: Bool) {
        let call = pendingCall
        pendingCall = nil
        if let file = temporaryFile { NewaveReportFile.removeTemporaryCopy(file) }
        temporaryFile = nil
        call?.resolve(["cancelled": cancelled])
    }

    deinit {
        if let file = temporaryFile { NewaveReportFile.removeTemporaryCopy(file) }
    }
}
