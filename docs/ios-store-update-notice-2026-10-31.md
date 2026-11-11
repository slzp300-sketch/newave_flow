# iOS 새 버전 안내 — 2026-10-31

사용자가 앱 실행 시 새 버전 안내와 App Store 이동을 요청했다. 로컬 소스와 가상 미리보기에 반영했으며 배포·원격 푸시·스토어 제출은 하지 않았다. 이미 공개된 1.0.2에 소급 적용되지 않는다. 이 기능을 포함한 다음 업데이트를 설치한 사용자부터 이후 새 버전 안내를 받는다.

## 동작

- iOS 앱 시작과 다시 활성화될 때 설치된 버전(`App.getInfo`)과 한국 App Store 공개 버전을 비교한다. 숫자 구성요소로 비교하며 1.0.10을 1.0.9보다 높게 처리한다. 같은 버전이나 더 최신 검수 빌드에는 안내하지 않는다.
- Apple 공개 lookup에서 고정 App ID 6823391707, bundle app.newaveflow.mobile, software 종류, 유효한 버전·최소 OS·공개 시점을 확인한다. 미래 공개일은 안내하지 않는다. 확인 가능한 iOS 버전이 최소 요구 버전보다 낮으면 안내하지 않는다.
- 기존 디자인의 작은 하단 안내: “새 버전이 있어요”, 현재→새 버전, “나중에 / 업데이트”. 사용을 강제로 막거나 화면을 새로고침하지 않는다.
- 업데이트 링크는 응답에서 받은 임의 주소가 아닌 고정 `https://apps.apple.com/kr/app/id6823391707`이다. `target=_blank` 외부 이동은 설치된 Capacitor 8.5.3의 iOS WKWebView 위임 코드가 `UIApplication.shared.open`으로 처리한다. 앱 내부 웹 화면을 스토어 페이지로 교체하지 않는다.
- 나중에는 해당 버전을 24시간 숨긴다. 더 새로운 버전은 별도로 안내한다. 저장 중(`useIsMutating`)에는 업데이트 이동을 막고, 저장 전 내용 확인 문구를 짧게 표시한다.
- 성공한 공개 버전 조회는 1시간 캐시, 실패는 다음 활성화/온라인 복구 때 최소 15분 간격으로 재시도한다. 오프라인·실패·저장 공간 접근 오류는 앱 사용을 차단하지 않는다. 백그라운드에서는 안내를 숨긴다.
- 늦게 도착한 응답과 리스너 등록 결과는 화면 정리 후 무시/해제한다. 버전·캐시 시각·나중에 시각만 로컬에 저장한다. 서비스 로그인 토큰·회원 정보를 Apple에 보내지 않는다.
- 웹의 기존 서비스워커 안내와 Android 동작은 유지한다. 서버·DB·새 네이티브 플러그인·패키지 의존성 변경 없음.

## 검증

- 프런트엔드 전체 **233/233 통과**, 새 버전 확인 관련 15개 포함: 숫자 비교, 다른 앱/미래 공개 제외, 최신 설치/낮은 OS, 플랫폼 제한, 캐시/재실행/나중에, 온라인 복구, 실패 제한, 중복 요청·정리 후 응답·리스너, 백그라운드, 로컬 저장 실패.
- native 모드 웹 빌드 성공: `frontend/.verification/store-update-build`. 기존 혼합 import·500kB 청크 경고만 남음.
- 실제 Apple 공개 응답으로 1.0.1 설치는 1.0.2 안내, 1.0.2 설치는 안내 없음 확인.
- 실제 안내 컴포넌트와 가상 iOS 서비스로 375px, 320px/120% 글씨 확인. 페이지 가로 넘침 없음, 터치 영역 최소 44px 유지. 저장 중 이동 차단, 저장 완료 후 링크, 나중에/다시 확인, 작성 내용 보존, 최신 버전·오프라인 시 안내 없음 확인.
- 미리보기는 가상 1.0.2→1.0.3을 사용한다. **1.0.3은 시연 값이며 출시 번호 확정이나 제출을 의미하지 않는다.** 링크 클릭도 외부 이동 대신 목적지를 표시한다.
- 실제 iPhone에서 새 빌드를 설치하고 App Store 앱으로 전환하는 최종 검수는 다음 서명 빌드에서 필요하다. Windows의 브라우저 확인을 실제 iOS 설치 검수로 표현하지 않는다.

## 현재 출시와 구분

1.0.2(9)는 10월 30일 자동 출시로 저장했다. 10월 31일 04:25 KST 승인 메일과 Apple 한국 공개 조회의 04:26:16 KST 출시 시각을 확인했다. 사용자가 이후 자신의 아이폰에도 업데이트 버튼이 생겼다고 확인했다. 이번 새 버전 안내 코드는 이 출시본 이후 로컬 변경이다.

## 미리보기·근거

- `http://127.0.0.1:5197/.verification/store-update-app.html`
- `?large=1`: 큰 글씨, `?current=1`: 이미 최신, `?offline=1`: 조회 실패. 모든 입력은 가상 자료이며 운영 API에 연결하지 않는다.
- 구현: `frontend/src/native/storeUpdate.js`, `NativeStoreUpdate.jsx`, `frontend/src/components/common/StoreUpdateNotice.jsx`, App.jsx의 전역 연결.
- [Capacitor App API](https://capacitorjs.com/docs/apis/app), [Capacitor HTTP](https://capacitorjs.com/docs/apis/http), [Apple 공개 lookup](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/LookupExamples.html).
