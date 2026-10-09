# Newave Flow — Claude 작업 지침

교회 교육부서(교사·학생)용 출석·모임·보고 관리 웹앱. 사용자는 비개발자이므로 이 지침을 따른다.

## 핵심 규칙

1. **쉬운 말로** — 한글로 답하고, 전문 용어는 괄호로 쉽게 풀어 쓴다.
2. **계획 먼저** — 여러 파일을 고치는 작업은 무엇을 어떻게 바꿀지 먼저 짧게 말하고 시작한다. "이거 바꿔줘" 같은 작은 수정은 바로 반영한다.
3. **모바일 우선** — 교사 대부분이 폰으로 쓴다. 화면을 바꾸면 폰 폭(약 375px)에서도 확인한다.
4. **비밀값은 코드에 넣지 않는다** — 비밀번호·키·토큰은 환경변수(.env, Railway/Vercel 설정)로. 새로 하드코딩하지 않는다.
5. **실데이터 보호** — 운영 앱(https://newave-flow.vercel.app)에는 실제 학생·교사 정보가 있다. 확인할 때는 화면 표시와 오류만 보고, 저장·제출·삭제·승인 버튼은 누르지 않는다. 학생 명단(`backend/src/main/resources/roster_data.json`)의 내용을 외부로 옮기거나 출력하지 않는다.
6. **확인하고 끝낸다** — 코드를 고치면 아래 "검증" 절차로 직접 확인한 뒤 결과를 보고한다.

## 구조

| 폴더 | 내용 |
|---|---|
| `frontend/` | React 18 + Vite, Tailwind, React Query, zustand(로그인 상태), PWA. 화면은 `src/pages/`, 주소 연결은 `src/router/index.jsx`, 서버 호출은 `src/api/` |
| `backend/` | Spring Boot 3 (Java 17+), JWT 로그인, JPA. `controller → service → repository → entity` |
| `docs/` | API 명세, DB 스키마 (오래된 내용일 수 있음 — 코드가 우선) |

- 역할(권한): `ADMIN`(최종 관리자) / `PASTOR` / `EXECUTIVE`(임원교사) / `TEACHER`. 관리자 전용 API는 `ADMIN/PASTOR/EXECUTIVE`로 제한돼 있고, ADMIN 권한 부여·변경은 ADMIN만 가능.
- 서버 시간대는 Asia/Seoul 고정. 프론트에서 '오늘' 날짜는 `toISOString()`(UTC) 말고 `toApiDate()`를 쓴다.
- 체크(출석·TTS·기도모임 투표·교사회의)는 마감 없이 이번 주·지난 주 언제든 수정 가능, 미래 주만 막는다. 관리자 화면은 마지막 수정 시각을 보여준다.

## 로컬 실행

필요: Node.js 20+, JDK 17+, Git.

```bash
# 백엔드 (8080) — Windows는 gradlew.bat
cd backend && ./gradlew bootRun

# 프론트 (5173) — /api 요청은 8080으로 프록시됨
cd frontend && npm ci && npm run dev
```

- 기본 프로필은 `dev`: 메모리 DB(H2)라서 서버를 껐다 켜면 데이터가 초기화된다. 시작할 때 관리자 계정(admin@naver.com)과 반·학생 명단이 자동으로 생성된다.
- 로그인 화면 아이디 칸에는 `admin`만 입력한다(@naver.com은 옆 선택칸).
- 브라우저 자동화로 로그인할 때 값을 한 번에 채워 넣는 방식(form_input)은 로그인 버튼이 반응하지 않는다. 칸을 클릭하고 직접 타이핑해야 한다.

## 검증

```bash
cd frontend && npm run build        # 화면 코드 빌드 확인
cd backend && ./gradlew build       # 백엔드 컴파일 + 테스트
```

화면을 바꿨으면 로컬에서 띄워 해당 화면을 열고 콘솔 오류가 없는지 확인한다.

## 배포 (운영)

| 대상 | 서비스 | 동작 |
|---|---|---|
| 프론트 | Vercel `newave-flow` → https://newave-flow.vercel.app | main에 머지되면 자동 배포 |
| 백엔드 | Railway → `https://newaveflow-production.up.railway.app` | `prod` 프로필 + PostgreSQL(`PG*` 환경변수), `JWT_SECRET` 환경변수 |

- 운영 API 주소는 두 곳에 하드코딩돼 있다: `frontend/src/api/client.js`, `frontend/src/router/index.jsx`. 주소가 바뀌면 **둘 다** 고친다.
- Railway에 `SPRING_PROFILES_ACTIVE=prod`가 빠지면 메모리 DB로 떠서 데이터가 사라진다. 백엔드 배포 설정을 만질 때 반드시 확인한다.
- `frontend/dist/`는 .gitignore에 있지만 과거에 커밋돼 있어서, 빌드하면 변경으로 잡힌다. 의도한 게 아니면 커밋하지 말고 `git checkout -- frontend/dist`로 되돌린다.

## Git 작업 방식

- 저장소: `slzp300-sketch/newave_flow` (사용자 소유).
- **작은 수정**(문구·스타일·한두 파일의 화면 수정 등) → 검증 후 main에 바로 커밋·푸시한다. main 푸시 = 운영 자동 배포이므로 빌드 확인은 꼭 한다.
- **큰 작업**(여러 파일에 걸친 기능, 백엔드·DB 변경, 권한·배포 설정 변경) → PR은 필수가 아니다. 커밋 전에 "PR로 올릴까요, main에 바로 푸시할까요?"라고 물어보고 사용자 답에 따른다. PR로 하면 기능별 브랜치 → PR → 사용자가 Vercel 미리보기로 확인 후 main 머지.
- 커밋 안 된 변경이 있으면 지우거나 되돌리기 전에 먼저 물어본다.
- 커밋 메시지는 `fix:`, `feat:`, `chore:`, `docs:` 접두사 + 한글 설명 (기존 이력과 동일).

## 작업 로그 (노션)

- **"작업로그 저장해줘"** (비슷한 말: "작업 내용 저장해줘", "여기까지 기록해줘") → `worklog-save` 스킬로 노션 "Claude Code 작업 로그" DB에 저장한다. `프로젝트` 값은 반드시 **`newaveflow`**(repo 이름 `newave_flow` 아님). 저장 후 노션 링크와 함께 보고한다.
- 사용자가 "오늘은 여기까지", "다른 PC에서 할게"처럼 마무리하면 저장할지 먼저 묻는다.
- **"작업로그 불러와줘"** (비슷한 말: "지난번에 하던 거 이어서 하자") → `worklog-load` 스킬로 최근 기록을 읽고 현재 저장소 상태와 대조해 요약한다.

## 미해결 메모

- 관리자 초기 비밀번호가 `backend/.../config/DataInitService.java`에 하드코딩돼 있음 → 환경변수로 옮길 예정(미착수).
- 임원교사(EXECUTIVE) 권한 범위 축소는 사용자가 추후 결정.
- 루트의 `brand-config.md`, `cs-templates.md`, `brand/`는 다른 프로젝트(이커머스) 템플릿에서 넘어온 파일로 이 앱과 무관하다.
