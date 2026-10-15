# App Store 입력 자료와 스크린샷 묶음

`metadata.ko-KR.json`은 App Store Connect에 옮길 공개 문구와 대한민국 무료 공개 결정을 담는다. Apple에 제출된 상태가 아니다. 심사 연락처·로그인 비밀번호·Apple 키는 이 폴더와 생성 묶음에 넣지 않는다.

## 문구 확인

```sh
python3 tools/ios/prepare-submission.py --metadata-only
```

이름·부제 30자, 홍보 문구 170자, 설명 4,000자, 키워드 UTF-8 100바이트, 심사 메모 UTF-8 4,000바이트와 공개 URL·배포 결정을 확인한다. `copyrightFieldPresent`는 값의 유무만 뜻하며 실제 권리 확인을 대신하지 않는다. 권리자는 사용자 확인값을 사용한다.

## 실제 화면과 묶기

별도 iOS 화면 촬영 workflow에서 받은 가상 자료의 시뮬레이터 캡처를 눈으로 확인한다. 촬영 기록의 커밋·기기·버전을 대조하고 다음 명령을 실행한다. 아래 출력 폴더는 아직 존재하지 않는 새 폴더를 사용한다.

```sh
python3 tools/ios/prepare-submission.py \
  --screenshots frontend/.verification/ios-store-screenshots \
  --receipt frontend/.verification/capture-receipt.json \
  --output frontend/.verification/ios-store-submission
```

도구는 1206×2622, 8-bit RGB, 무알파 PNG 다섯 장의 파일 구조·이미지 데이터·체크섬을 검사한다. 촬영 영수증의 파일명·크기·SHA256과 일치하는지 대조하고, 공개 문구·다섯 이미지·촬영 영수증의 공개 필드만 복사한다. `manifest.json`에 이미지와 문구 파일의 SHA256을 기록한다. 영수증은 원본 CI 실행과 함께 확인해야 하며, 파일 검사만으로 실제 화면 내용까지 증명하지 않는다. 가상 자료 사용과 외부 네트워크 차단은 촬영 절차가 담당한다.

정식 제출 직전에는 서명한 최종 빌드와 화면·기능·개인정보 응답을 다시 대조한다. 이 묶음에는 Apple 연락처 입력, 로그인 비밀값, 국가별 규정 준수 인증, 계약, 서명/업로드, App Review 제출이 포함되지 않는다. 접근성 지원 여부는 실제 기기 검수 전 확정하지 않는다.

## 비공개 심사 연락처

사용자가 제공한 심사 연락처는 개발 PC의 Git 제외 폴더 `frontend/.verification/ios-preapproval/operator-intake.dpapi`에 Windows 사용자 계정 암호화로 보관했다. 해당 PC/사용자에서 복원 검증했으며 공개 문서·작업로그에는 전화번호를 남기지 않았다. 다른 PC로 파일만 옮기면 복원할 수 없다. 콘솔에 입력할 때만 복원하고 터미널 출력·공개 CI artifact·이 폴더로 복사하지 않는다.

심사 로그인값은 기존의 승인된 비밀 보관 위치를 사용한다. 여기서 가상 자료 fixture의 식별자나 로그인 상태를 실제 심사 로그인값으로 사용하지 않는다.

관련 문서: [제출 초안](../ios-app-store-submission.md), [신고 답변 근거](../ios-submission-evidence.md), [권리·제출 주체](../ios-enrollment-dossier.md), [서명·TestFlight 절차](../ios-testflight-runbook.md).
