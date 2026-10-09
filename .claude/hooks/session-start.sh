#!/bin/bash
# 클라우드(웹) 세션 시작 시 개발 환경 자동 준비
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# 프론트엔드 패키지 설치
(cd frontend && npm ci --no-audit --no-fund)

# 백엔드 의존성 미리 받아두기 (gradle 캐시)
chmod +x backend/gradlew
(cd backend && ./gradlew compileJava --no-daemon -q)
