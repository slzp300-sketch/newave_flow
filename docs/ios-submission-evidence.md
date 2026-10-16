# iOS 개인정보·연령·암호화 제출 근거

최초 확인: 2026-10-15(`fc985b1`), 현황·공식 기준 갱신: 2026-10-16. 현재 배포·실기기 확인된 Apple 로그인 빌드는 `0e12009f`의 TestFlight 1.0.0(2)다. 후속 공개 삭제 접수·본문 삭제 보완은 구현·합성 검증 후 `85998e55`의 서버·웹 배포를 완료했다. 새 TestFlight 빌드에는 아직 반영하지 않았다. 실제 회원·학생 자료, 운영 로그 본문, 비밀번호, 운영 DB를 조회하지 않았다. 개인정보 15유형은 사용자 명시 승인 후 App Store Connect에 게시했고 게시자·방금 게시 상태를 확인했다. **정식 심사는 미완료**다. 만 14세 이상 승인 교사·담당자 정책과 가입 코드는 구현·검증 후 `85998e55`의 서버·웹 배포를 완료했다. 새 TestFlight 빌드는 아직 생성하지 않았다. 아래 근거를 최종 코드·콘솔 문구·제출 Archive와 대조한다. 완료 증거는 [최초 등록 기록](ios-store/activation-checkpoint-2026-10-16.md)과 [Apple 로그인 기록](ios-store/apple-login-checkpoint-2026-10-16.md)을 따른다.

사용자 확정 배포 조건은 **대한민국(KR)만, 무료, 공개 App Store 배포, 새 국가 자동 추가 안 함, 심사 승인 후 수동 공개**이며 콘솔 저장 기록이 있다. 공개 배포여도 일반 신규 계정은 관리자 승인 후 로그인한다. 앱·교회 콘텐츠의 권리자는 사용자 확인을 받았으며, 민감정보 서비스의 제출 명의 적합성은 개인 멤버십 활성화와 별도로 검토한다.

## 1. App Privacy 입력값

첫 질문은 **데이터를 수집함: 예**. 아래 선택 항목의 목적은 모두 **App Functionality**, 추적은 모두 **아니오**, 사용자 연결은 모두 **예**로 준비한다. 광고·마케팅·행동 분석 목적은 선택하지 않는다. 계정이 없는 학생·보호자도 식별되는 사람이며, 삭제 후 익명화나 해시 저장은 수집 시점의 연결성을 없애지 않는다. 로그도 비식별 처리 선행이 입증되지 않아 연결되지 않음으로 주장하지 않는다.

Apple의 데이터 유형·수집·목적·연결성 기준을 현재 코드에 적용한 판단이다. 일반 자유 기록은 Other User Content로 처리하되, 별도로 요청하는 건강·사진·연락처는 해당 항목에도 포함한다. [Apple App Privacy 기준](https://developer.apple.com/app-store/app-privacy-details/)

| 선택할 유형 | 실제 코드·처리 근거 | 해당 기능 |
| --- | --- | --- |
| Name | `User`, `Student`의 이름·보호자 이름 | 계정·반·연락처 관리 |
| Email Address | 이메일 가입·로그인, 지원 회신 정보, Apple에서 검증된 이메일·비공개 중계 주소 | 인증·문의 대응 |
| Phone Number | 교사 선택 연락처, 학생·보호자 전화번호 | 연락·반 관리 |
| Physical Address | `Student`의 주소 | 학생 정보 관리 |
| Health | `AttendancePage.jsx` 불참 사유 예시가 `몸살`을 직접 제시하며 출결 사유를 서버 저장 | 출결·공동 보고. HealthKit 사용이라는 뜻은 아님 |
| Sensitive Info | 세례 여부, 교회 소속, 말씀·기도·예배 참여 기록 | 사역·종교 활동 기록 |
| Contacts | 수동 입력한 교사·학생·보호자 연락처 목록과 반·보호자 관계 | 연락처 목록·관계 관리. 단말 주소록 접근과 별개 |
| Photos or Videos | 교사·학생 승인 사진과 서버에 저장되는 승인 전 후보 사진 | 프로필·사진 게시 검토. 동영상 업로드 기능은 없음 |
| Customer Support | `ContentReport`, `AccountDeletionRequest`의 신고·삭제 요청과 처리 안내 | 이용자 지원·권리 행사 |
| Other User Content | 기도제목·학생 메모·공동 보고·회의록, 사진 검토 안내, 정지·복구 사유 | 기록·협업·안전 관리 |
| User ID | 내부 계정 ID, 카카오 회원번호, Apple 개발자별 식별자, 신청자·검토자·신고 담당자 연결 | 인증·권한·안전 관리 |
| Product Interaction | 일정 읽음·업무 체크·회의 확인, 업무 신청·수정·처리 시각 | 실제 기능 수행·상태 표시 |
| Performance Data | 호스팅 HTTP 응답 시간·요청 소요시간 | 서버 성능·가용성 유지 |
| Other Diagnostic Data | 호스팅 접속 IP·요청 경로·응답 상태·User Agent와 장애 로그 | 통신·보안·장애 대응 |
| Other Data Types | 생년월일·성별·학교·학년·반·권한·승인 상태, 신고 우선순위·목표일, 삭제 접수·조회 코드 해시·인계 상태, Apple 인증 흐름·연결·알림 처리 상태 | 프로필·업무·권리 행사 관리 |

고객지원의 선택 공개 예외를 적용하지 않는다. 앱 내 신고·삭제 요청을 지속적으로 보관하고 안전·계정 기능의 일부로 사용하기 때문이다. 자유 입력에 가능한 모든 정보를 가정해 데이터 유형을 무한히 늘리지는 않는다. 건강은 현재 안내 문구가 구체적인 입력 근거여서 포함했다. 몸살 예시를 지우는 것만으로 기존 건강 기록·실제 수집 절차가 사라지지는 않는다.

### 현재 선택하지 않는 유형·목적

- Fitness, Payment Info, Credit Info, Other Financial Info, Purchases: 운동 측정·결제·구독·재무 기능이 없다. TTS는 말씀·기도 실천 기록이며 운동 데이터가 아니다.
- Precise/Coarse Location: 기기 위치를 요청하거나 IP에서 위치를 산출하는 앱 기능이 없다. 학생 주소는 Physical Address로 신고한다. 호스팅 IP는 진단 목적으로 분류한다.
- Device ID: IDFA/IDFV나 지속적인 기기 고유번호 수집을 확인하지 않았다. 인증용 난수·PKCE·일회용 흐름 ID는 기기 추적 식별자로 사용하지 않는다.
- Other User Contact Info: 현재 이름·이메일·전화·주소 외의 별도 연락 수단 필드가 없다. Contacts는 위 목록·관계 용도로 별도 선택한다.
- Emails or Text Messages, Audio Data, Gameplay Content: 기기 메일·문자·녹음·게임 기록에 접근하지 않는다. 문의·신고는 Customer Support로 신고한다. 메일 작성 링크는 사용자가 자신의 메일 앱에서 보내는 기능이다.
- Browsing History, Search History, Advertising Data: 방문 이력·검색어 수집 또는 광고 처리 기능을 확인하지 않았다. 업무 일정 읽음은 Product Interaction이다.
- Crash Data: 개발자용 앱 충돌 전송 SDK를 탑재하지 않았다. 서버 예외·요청 오류는 Other Diagnostic Data에 포함한다. Apple 자체 수집과 별도 개발자 수집은 구분한다.
- Other Usage Data: 현재 저장하는 기능 이용 기록은 Product Interaction으로 분류한다. 별도 중복 항목으로 추정해 추가하지 않는다.
- Analytics, Product Personalization, Developer Advertising or Marketing, Third-Party Advertising, Other Purposes: 현재 코드의 사용 목적에 없다. 본인 TTS 합계와 역할에 따른 업무 화면은 앱 기능이다.
- Tracking: 광고 SDK·광고 ID·데이터 브로커 제공·광고 목적의 타사 자료 결합이 없다. 로그인·호스팅 자체를 광고 추적으로 답하지 않는다.

이는 현재 소스·설정 기준이다. 새로운 SDK, 로그 목적, 위치 추정, 광고·분석 또는 데이터 판매를 추가하면 신고를 갱신한다. `PrivacyInfo.xcprivacy`의 UserDefaults 선언은 이 설문을 대신하지 않는다.

### 카카오 응답과 호스팅 로그

`KakaoClient.identify`는 토큰을 교환하고 `/v2/user/me` 결과에서 회원번호 `id`만 추출한다. 응답 필드 제한이 없으므로 동의한 프로필·이메일이 응답에 포함되지 않는다고 단정하지 않는다. 코드에는 응답·토큰의 DB 보관이나 로깅이 없고 요청 처리 중 일시 파싱한다. 계정에는 카카오 회원번호만 연결한다. 이와 별도로 앱 가입 시 직접 받은 이름·이메일은 위 라벨에 포함된다. 비공개 카카오 콘솔의 실제 동의 항목은 재출시 시 확인하며 필요 이상의 동의를 요구하지 않는다.

Railway 공식 HTTP 로그 필드에는 클라이언트 IP, User Agent, 경로, 상태, 요청·응답 시간이 있다. 앱 정책의 접속·보안 로그 안내와 이 제공자 문서를 근거로 Performance Data·Other Diagnostic Data를 포함한다. 원본 로그나 실제 이용자 IP는 읽지 않았다. [Railway 로그 필드](https://docs.railway.com/observability/logs)

iOS 기본 화면은 번들 자산을 읽고 API는 Railway에 연결한다. 공개 지원·방침 웹사이트는 Vercel에서 제공한다. Vercel의 웹 요청 운영 기록도 웹사이트 방침 범위이며, 앱에 별도 Vercel Analytics/Speed Insights SDK가 있다는 뜻은 아니다. 제공자 보관·삭제 정책과 운영자의 업무 자료 보관 기간은 다르다. 조회 가능한 로그 기간을 완전 삭제 기한으로 기재하지 않는다.

## 2. 연령 설문 답변

기존 운영 문구의 대상은 만 18세 이상 교사·사역 담당자다. 10/16 사용자가 만 14세 미만 가입은 불필요하다고 확인해, 만 14세 이상 승인된 교사·담당자만 이용하도록 정책·가입 코드를 구현·검증했다. 학생·보호자 직접 계정은 제공하지 않으며 새 정책의 서버·웹 배포를 완료했다. 새 TestFlight 반영은 남아 있으며 스토어 등급은 사용자 승인 후 저장했다. 개인정보 Health를 선택하는 것과 건강·의료 조언 콘텐츠를 제공하는 것은 별개다. 현재 기능을 [Apple 연령 질문 정의](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)에 대조한 입력안은 다음과 같다.

| 질문 | 입력값 | 현재 근거 |
| --- | --- | --- |
| Parental Controls | No | 보호자가 자녀 기능을 제한하는 설정이 없다 |
| Age Assurance | No | 관리자의 가입 승인이나 만 14세 이상 가입 자기 확인은 신분증·나이 범위 검증이 아니다 |
| User-Generated Content | Yes | 교사·관리자가 작성한 공동 보고·메모·회의록·사진이 권한 범위 안에서 공유된다 |
| Messaging and Chat | Yes | 관리자 회의록 게시·교사 공동보고, 관리자 작성 신고/사진 처리 안내를 해당 이용자에게 전달한다. 공식 예시는 게시와 직접/그룹 메시지를 포함하며 실시간 채팅에 한정되지 않음 |
| Social Media | No | 재전파·추천 피드·좋아요·댓글·공유를 중심으로 하는 소셜 기능이 없다 |
| Social Media Disabled for Users Under 13 | No / 비해당 | 소셜 미디어 기능과 Declared Age Range API가 없다 |
| Unrestricted Web Access | No | 주소 입력·임의 탐색 UI가 없다. 외부 회의 링크는 시스템 브라우저로 넘김. 아래 기술 근거 참조 |
| Advertising | No | 광고 표시·수익화 코드가 없다 |
| Medical or Treatment Information | None | 진단·치료·의학적 조치 안내 기능이 없다. 불참 사유의 건강 입력과 구분 |
| Health or Wellness Topics | No | 식단·운동·자가 관리 권고 기능이 없다. 말씀·기도 실천을 의료·웰니스 조언으로 소개하지 않음 |
| Gambling / Loot Boxes | No | 금전·확률형 보상 기능이 없다 |
| Simulated Gambling | None | 베팅·판돈·현금 교환 또는 모의 도박 기능이 없다 |
| Contests | Frequent | TTS가 모든 교사에게 주간·분기 점수순 순위와 목표 달성 기록을 상시 제공한다. 상금이 없더라도 공식 정의의 순위/개인 목표 경쟁에 해당한다고 해석해 신고하며 초기 None 초안을 정정함 |
| Made for Kids | 선택하지 않음 | 학생·보호자 직접 이용 앱이 아니다 |

Messaging and Chat의 Yes는 실시간 채팅을 지원한다는 제품 소개가 아니다. 공동 문서 편집만으로 반드시 해당한다는 Apple의 개별 예시는 확인하지 못했지만, 이 앱에는 관리자 작성 메시지를 신고자·사진 신청자에게 직접 보여주는 경로도 있다. `ContentReportsAdminPage.jsx`의 처리 안내 입력과 `ContentReportPage.jsx`의 본인 결과 표시, `ContentPhotosAdminPage.jsx`의 신청자 안내 입력, `MeetingMinutesAdminPage.jsx`/`MeetingMinutesPage.jsx`의 게시·열람을 근거로 Yes를 유지한다. [Apple 정의](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)

Contests는 `frontend/src/components/tts/TtsStats.jsx`의 주간/분기 순위 화면, `frontend/src/utils/ttsStats.js`의 점수순 공동 순위 계산, `TtsController`의 모든 교사용 통계와 `TtsService.getStats/getWeekStats`를 대조했다. 다른 이용자의 점수·순위를 반복 비교하는 정규 기능이며 주간 화면은 1분마다 갱신한다. 공식 정의는 보상뿐 아니라 순위·목표 달성 경쟁을 포함하므로 상금·금전·확률 요소가 없다는 이유로 None을 선택하지 않는다. 상시 반복 노출을 근거로 Frequent가 타당하다는 **소스 기반 해석**이며, Apple이 이 앱의 분류나 빈도를 개별 확인한 것은 아니다. 실제 운영 자료·이용 빈도를 조회한 결과도 아니다. [Apple 정의](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)

`frontend/capacitor.config.json`에는 `allowNavigation`이 없고 `WebViewDelegationHandler.swift`는 앱 밖 최상위 링크를 `UIApplication.shared.open`으로 연 뒤 내장 WebView 탐색을 취소한다. `MeetingMinutesPage.jsx`의 영상은 외부 링크다. 카카오의 `Browser.open`은 지정한 인증 URL을 여는 용도다. 제출 빌드에서 링크가 실제 시스템 브라우저로 열리고 복귀하는지 iPhone으로 확인한다.

사용자는 운영자가 제공하는 콘텐츠에 욕설·공포·음주·흡연·약물·성적 표현·폭력·무기 묘사를 제공하지 않는다고 답했다. 빈도 None 초안은 이 답변과 고정 화면·합성 자료를 근거로 한다. 실제 영상·본문을 모두 소스 검사로 확인했다는 뜻은 아니며 콘텐츠가 바뀌면 재평가한다. 텍스트 필터가 모든 성경 표현·이미지·영상 문맥을 보증하지 않는다.

과거에는 사용자 요청으로 등급 저장을 보류했고 운영 문구는 만 18세 이상이었다. 10/16 사용자가 글로벌16+ 저장을 승인한 뒤 App Store Connect에 설문을 저장했다. UGC=Yes, Messaging and Chat=Yes, Contests=Frequent의 자동 결과는13+였고, 만14세 최소 가입 조건에 맞춰 글로벌16+로 상향했다. 콘솔 결과는 글로벌16+ 173개 지역, 대한민국15+이며 OS26 미만은 글로벌17+(지역별 예외 있음)이다. 이는 등급 저장 결과이고 앱 심사 승인은 아니다. 서버·웹 배포 증거는 별도 기록을 따른다. 가입 자기 확인은 공인 Age Assurance가 아니므로 해당 응답은 No다. 증거: `.verification/ios-age-rating-saved-20261016.png`. [연령 상향 설정](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/)

신고 접수·텍스트 사전 검사·사진 승인·관리자 숨김·정지·복구는 구현되어 있다. 개인별 차단 목록은 제공하지 않는다. 앱 심사 지침의 UGC 요건 충족 및 민감정보 앱 제출 주체 적합성을 Apple이 인정한 것으로 표시하지 않는다.

## 3. 수출 규정·암호화

| 질문/설정 | 현재 답변 | 근거 |
| --- | --- | --- |
| 암호화를 사용하는가 | 예 | HTTPS·WKWebView, Security Keychain, WebCrypto 난수·SHA-256 |
| 자체·비표준 암호 알고리즘 | 아니오 | 자체 암호 구현 없음 |
| Apple OS 밖의 앱 포함 암호 라이브러리 | 아니오 | 현재 iOS 런타임 의존성·Swift 코드는 OS 제공 API 사용 |
| `ITSAppUsesNonExemptEncryption` | `false` | OS 제공 암호화로 제한된 현재 번들 판단이며 ‘암호화를 전혀 안 씀’이라는 뜻 아님 |
| App Store Connect 암호화 서류 | 현재 구성은 별도 서류 불요 | OS 제공 암호화만 쓰는 경우에 대한 공식 표 적용 |
| 프랑스 배포 | 아니오 | 확정 배포 국가는 KR만 |

Apple의 공식 표에서 OS 내 암호화만 사용하는 앱은 별도 암호화 서류를 요구하지 않는다. 면제 대상만 쓰는 앱은 해당 Info.plist 값을 false로 지정할 수 있다. [암호화 서류 기준](https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption/), [Info.plist 키](https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption)

근거 파일은 `NewaveKeychainStore.swift`, `NewaveAppleSignInPlugin.swift`, `frontend/src/auth/kakao.js`, `appleFlow.js`, `frontend/package.json`과 잠금 파일의 iOS 런타임 의존성이다. 인증 PKCE 해시는 `crypto.subtle.digest`, 난수는 `crypto.getRandomValues`를 사용한다. 서버 Java의 JWT·Apple 토큰 저장 암호화와 Android Keystore 구현을 iOS 안에 포함된 라이브러리로 세지 않는다. 최종 Archive 검사에서 plist 값과 탑재 SDK를 다시 검증한다.

## 4. 활성화된 Apple 로그인과 남은 검증

2026-10-16 운영 서버·TestFlight 1.0.0(2)의 Apple 로그인을 활성화했고 공개 방침 시행일도 2026-10-16으로 갱신했다. 신규 가입은 검증된 Apple 이메일·중계 주소를 보존하며 별도 앱 비밀번호를 만들지 않는다. Name·Email Address·User ID·Other Data Types에 해당 처리를 포함하고 [정책 반영 기록](ios-apple-privacy-addendum.md)과 게시된 개인정보 신고를 대조한다.

사용자 보고로 Apple 인증 후 선택 화면 복귀와 기존 계정 연결·로그아웃·Apple 재로그인은 확인했다. 실제 iPhone의 Apple 신규 가입·이메일 가리기·취소·철회 알림·삭제 전체는 미검수다. 승인 대기·정지·비활성 계정도 정상 로그인 없이 이메일·비밀번호 또는 새 Apple 인증으로 삭제 접수하는 경로는 구현·합성 검증 후 `85998e55`의 서버·웹 배포를 완료했다. 새 TestFlight 빌드에는 아직 반영하지 않았다. 개인 메모 삭제·공동 문서 소유권 결정·부분 삭제·복원 감사도 새 합성 PostgreSQL DB 검사에 통과했다. 백엔드 전체 169개 중 157개 통과·선택 PG 12개 건너뜀, 별도 실제 PG 1/1과 Node 8/8 통과를 구분하며, 만 14세 이상 가입 확인을 포함한 최종 로컬 검증이며 프론트 109개도 통과했다. 검사 결과 자체를 실기기 성공으로 바꾸어 기록하지 않는다. 서버·웹 배포 성공은 아래 배포 기록과 별도로 확인했다. 두 번째 iPhone이나 다른 개인 Apple 계정 확보는 Apple의 필수 제출 절차가 아니다. [계정 삭제 검토](account-deletion-runbook.md)

## 5. 실행 대기와 확인 책임

| 준비된 것 | 남은 실제 단계 |
| --- | --- |
| App Privacy 15유형 사용자 승인 후 게시 완료, 목적·연결성·추적 근거 | 후속 기능 변경 시 신고 내용 재대조 |
| 기능별 연령 응답·콘텐츠 빈도 확인, 만 14세 미만 가입 불필요·승인 교사 한정 정책안 | 새 TestFlight에 정책·가입 코드 반영. 서버·웹 배포 및 사용자 승인 후 글로벌16+/대한민국15+ 콘솔 저장 완료 |
| 빌드 2의 암호화 면제 설정·실제 Archive 검사·Apple 처리 완료 | 후속 코드 변경 시 새 빌드에서 재확인 |
| 앱 레코드·KR 무료·수동 공개 저장, 메타데이터 JSON | 최종 제출 빌드·스토어 문구·가격/지역 재대조 |
| 비공개 심사 연락처 접수 | 비공개 콘솔 입력의 최종 대조. 이 문서에는 값 없음 |
| 가상 심사 서버 배포 성공. 심사용 계정 3개를 Apple 비공개 심사 정보에 저장하고 다시 불러와 유지 확인 | 새 빌드의 최종 iPhone 심사 동선 검수 |
| 승인 대기·정지 계정 공개 삭제 접수, 개인 메모·공동 본문 처리·복원 감사 구현·합성 검증 | 새 TestFlight 반영, 실제 미확인 경로·공개 문구 검수 |

공개 파일에는 비밀번호·개인 심사 전화·개인 심사 이메일을 저장하지 않는다. 정확한 콘텐츠 권리자는 사용자 확인값만 사용한다. 최종 iPhone 검수·TestFlight 업로드·Apple 심사 승인과 소스/시뮬레이터 증거를 구분한다.


2026-10-16 서버·웹 배포 확인: `main`의 `85998e55` push 후 운영 Railway `f3076d3a-886b-46e2-885d-e211ddfe4847`는 해당 SHA로 SUCCESS, 가상 심사 Railway `23b73bca-0fcc-4110-aab9-d255b3a3ae3c`와 Vercel 배포도 SUCCESS로 확인했다. 회귀 작업 5개가 모두 성공했다. 별도 iOS 네이티브 실행 `38842193400`은 실패했고 원인 조사 중이므로 성공 검사에 포함하지 않는다. 이 기록은 새 TestFlight 빌드 3 생성이나 실제 Apple 신규 가입·이메일 가리기·취소·철회·삭제 검수를 뜻하지 않는다. 후속 공개 계정 도움말 문구 수정은 아직 빌드 중이며 이 배포에 포함됐다고 기록하지 않는다. 삭제 운영 도구 준비와 실제 운영 삭제 실행도 구분하며 이 작업에서는 실제 운영 계정을 삭제하지 않았다.

2026-10-16 개인정보 게시 확인: App Privacy 15유형은 사용자 명시 승인 후 게시·확정했고 App Store Connect의 게시 완료 표시를 확인했다. 증거는 `.verification/ios-privacy-published-20261016.png`다. 비공개 계정·전화·비밀번호는 이 기록에 포함하지 않는다.
