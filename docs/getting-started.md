# Newave Flow — 실행 가이드

현재 운영은 PostgreSQL + Spring Boot `prod` 프로필과 Vercel 프런트로 구성됩니다. 로컬 개발은 H2 메모리 DB를 사용하는 `dev` 또는 `local` 프로필로 실행합니다. MySQL용 과거 SQL은 현재 초기화에 사용하지 않습니다.

## 로컬 실행 (Windows PowerShell)

Node.js 20 이상, JDK 17 이상이 필요합니다. 저장소 루트에서 별도 터미널 두 개로 실행합니다.

```powershell
cd backend
.\gradlew.bat bootRun --args='--spring.profiles.active=dev'
```

```powershell
cd frontend
npm ci
npm run dev
```

백엔드는 8080, 프런트는 5173 포트를 사용합니다. 프런트의 `/api` 요청은 로컬 백엔드로 연결됩니다. macOS/Linux에서는 `./gradlew`를 사용합니다. 로컬 검수에서는 `VITE_API_URL`에 운영 주소를 넣지 않습니다.

## 검수 데이터와 계정

기본 설정에서는 계정·학생 명단을 자동 생성하지 않습니다. 예전 문서의 공용 테스트 계정·비밀번호는 유효한 접속 안내가 아닙니다.

- 자동 검사는 `test` 프로필에서 각 테스트가 가상 계정과 데이터를 준비합니다.
- UI 저장 검수는 별도 로컬/검수 DB의 가상 계정·반·행사로 수행합니다. 운영 학생·교사의 기록으로 저장 동작을 시험하지 않습니다.
- `app.seed.enabled=true` 초기화는 실제 명단 파일을 읽으므로 일반 검수에는 사용하지 않습니다. 초기 설정은 [배포 체크리스트](deployment-checklist.md)를 따릅니다.
- 비밀번호·토큰·DB 연결 정보는 코드나 문서에 기록하지 않고 환경변수로 설정합니다.

## 검증

```powershell
cd frontend
npm test
npm run build -- --outDir .verification/build
```

```powershell
cd backend
.\gradlew.bat build
```

화면을 바꾸면 로컬 브라우저에서 휴대폰 폭과 오류·재시도 동작을 확인합니다. 추적 중인 과거 `frontend/dist` 대신 Git 제외 폴더 `.verification/build`에 검증 결과를 출력합니다.

## 운영 설정

`SPRING_PROFILES_ACTIVE=prod`, PostgreSQL의 `PG*` 환경변수, 충분히 긴 무작위 `JWT_SECRET`이 필요합니다. 운영은 DB 구조를 자동 변경하지 않고 `ddl-auto=validate`로 확인합니다. DB 변경은 백업과 별도 복원본 검증 후 [배포 체크리스트](deployment-checklist.md)를 따릅니다.

프런트 `VITE_API_URL`은 서버 주소 또는 `/api`가 포함된 주소를 받을 수 있습니다. 설정하지 않으면 공통 클라이언트의 운영 기본 주소를 사용합니다. `main`에 반영하면 자동 배포됩니다.

앱에 새 버전 안내가 표시되면 작성 내용을 저장한 다음 `새 버전으로 다시 열기`를 누릅니다. 내 정보의 앱 버전으로 실제 실행 중인 빌드를 확인할 수 있습니다.
