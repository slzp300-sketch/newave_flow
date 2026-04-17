# Newave Flow — 실행 가이드

## 1. DB 세팅

```bash
mysql -u root -p < docs/db-schema.sql
```

## 2. 백엔드 실행

```bash
cd backend

# 환경변수 설정 (또는 application.yml 직접 수정)
export DB_USERNAME=root
export DB_PASSWORD=your_password
export JWT_SECRET=newaveflow-secret-key-must-be-at-least-256-bits-long

./gradlew bootRun
# → http://localhost:8080
```

## 3. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

## 4. 테스트 계정

| 이름   | 이메일                  | 비밀번호      | 역할     |
|--------|------------------------|-------------|---------|
| 김목사  | pastor@church.com      | password123 | PASTOR  |
| 이임원  | exec@church.com        | password123 | EXECUTIVE |
| 박교사  | teacher1@church.com    | password123 | TEACHER |
| 최교사  | teacher2@church.com    | password123 | TEACHER |

## 5. MVP 이후 구현 순서

| 우선순위 | 기능 |
|---------|------|
| 1 | 캘린더 화면 (FullCalendar 또는 직접 구현) |
| 2 | 체크리스트 화면 |
| 3 | 교사 회의 참석 체크 |
| 4 | 행사 생성 및 참석 체크 |
| 5 | 사용자·반 관리 화면 (CRUD) |
| 6 | PWA 설정 (vite-plugin-pwa) |
| 7 | 푸시 알림 (미제출 알림) |
