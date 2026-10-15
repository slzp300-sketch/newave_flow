import Foundation
import Vision

// This tool runs only on the macOS CI host. It does not change or instrument the app.
func hasLoginScreen(_ lines: [String]) -> Bool {
    let text = lines.joined().uppercased().filter { !$0.isWhitespace }
    return text.contains("FLOW") && text.contains("비밀번호")
}

if CommandLine.arguments.count == 2 && CommandLine.arguments[1] == "--self-test" {
    precondition(!hasLoginScreen([]))
    precondition(!hasLoginScreen(["Carrier", "4:04 AM"]))
    precondition(!hasLoginScreen(["FLOW"]))
    precondition(hasLoginScreen(["F L O W", "아이디", "비밀 번호", "로그인"]))
    print("Launch-screen readiness matcher checks passed")
    exit(0)
}
guard CommandLine.arguments.count == 2 else {
    fputs("Usage: check-launch-screen <screenshot.png>\n", stderr)
    exit(1)
}
do {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["ko-KR", "en-US"]
    request.usesLanguageCorrection = false
    request.customWords = ["FLOW", "비밀번호"]
    try VNImageRequestHandler(url: URL(fileURLWithPath: CommandLine.arguments[1]), options: [:])
        .perform([request])
    let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
    guard hasLoginScreen(lines) else {
        print("Login screen is not visible yet; rejecting this capture")
        exit(2)
    }
    print("Release login screen is visible (brand and password field verified)")
} catch {
    fputs("Could not validate the launch screenshot: \(error.localizedDescription)\n", stderr)
    exit(1)
}
