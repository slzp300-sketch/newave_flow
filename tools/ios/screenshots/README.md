# iOS 스토어 화면 촬영

`iOS synthetic store screenshots` workflow를 main의 정확한 SHA로 수동 실행한다. Apple 계정·인증서·운영 계정은 사용하지 않는다. iOS 앱의 실제 웹 번들·Capacitor·화면 코드를 Release 설정으로 빌드하고, 테스트 번들에서만 `WKUserScript`와 별도 가상 응답을 넣는다. 승인 전에 실행할 수 있으며 이 작업이 App Store 제출·실제 Apple 로그인 검수 완료를 의미하지 않는다.

- `fixtures.json`의 사람·학교·일정·기록은 새로 만든 예시다. 기존 roster/MSW 자료를 가져오지 않는다.
- 웹 API는 `.invalid` 호스트로 빌드한다. 촬영용 WebView는 모든 HTTP(S) 연결을 차단하고, 미등록 요청이나 쓰기 요청은 실패시킨다. 생산 코드에 촬영용 로그인·라우트·환경 플래그를 추가하지 않는다.
- 일회용 CI checkout에서만 기존 AppTests 소스를 촬영 전용 테스트로 교체한다. App.app에는 가상 자료가 들어가지 않으며 앱/IPA는 산출물로 배포하지 않는다. 실제 화면 준비를 확인한 뒤 `simctl io screenshot`으로 전체 기기 화면을 촬영한다.
- 화면 픽셀과 크기는 앱의 원본이다. `normalize-png.swift`는 완전히 불투명한 원본만 허용하고 sRGB RGB PNG로 저장한다. 텍스트·도형 합성, 화면 재배치·리사이즈·보정은 하지 않는다. 원본도 `originals/`에 보존한다.
- `screenshots/`의 `01-home.png`부터 `05-event.png`와 `capture-receipt.json`을 제출 준비 패키지에 넣는다. 실제 최종 출시 버전의 기능·디자인·데이터 표시가 바뀌면 같은 과정으로 다시 촬영한다.

2026-10-15 확인한 [Apple 공식 규격](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)의 Dynamic Island 중형 규격 중 세로 1206×2622, PNG RGB 무알파로 고정한다. 설치된 iPhone 16 Pro·17·17 Pro 중 최신 런타임을 선택한다. 해당 기기가 없거나 실제 픽셀 크기가 맞지 않으면 확대하거나 다른 규격으로 바꾸지 않고 실패한다. 개인정보·연락처나 실제 로그인 정보가 없는지와 화면 잘림은 산출물에서 사람이 마지막으로 확인한다.

로컬 합성 검증:

```sh
node --test tools/ios/screenshots/fixture-network.test.mjs
python -B -m unittest discover -s tools/ios/screenshots -p 'test_*.py'
```
