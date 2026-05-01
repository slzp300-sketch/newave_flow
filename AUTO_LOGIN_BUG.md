# 자동로그인 데이터 로딩 버그 — 분석 및 수정 계획

## 현상
- 처음 로그인 시: 데이터 정상 로딩 ✅
- 몇 분 후 재접속(자동로그인): 교적부 "데이터 준비중", 기타 탭 오류 화면 ❌

---

## 지금까지 시도한 수정

### 시도 1 (커밋 a463da9)
auth hydration guard, 토큰 refresh 큐 강화 → 실패

### 시도 2 (커밋 4519db7) — 현재 적용됨
워밍업 2단계 구조:
1. `/health` 성공까지 재시도
2. JWT exp 파싱 → 만료됐거나 5분 내 만료 예정이면 선제 refresh

→ 여전히 실패

---

## 남은 원인 가설

### 가설 A — `/health`가 DB 준비 여부를 확인하지 않음 ⭐ 유력
- `/api/health`는 `Map.of("status", "ok")`만 반환 (DB 쿼리 없음)
- Railway 콜드스타트 시 Spring Boot가 뜨는 시점에 health는 통과하지만
  HikariCP DB 커넥션 풀이 아직 초기화 중일 수 있음
- 워밍업 완료 후 실제 API(`/classes/roster` 등)가 DB에 접근하면 커넥션 에러
- `classesApi.getRoster()`의 catch가 잡아 `setHasError(true)` — 단, 빈 배열을 반환하면 "데이터 준비중"으로 보임

### 가설 B — 토큰이 만료됐는데 선제 refresh가 동작하지 않음
- `isTokenExpiredOrExpiring` 함수의 JWT 파싱이 실패하면 `return true`이므로 refresh 시도
- 하지만 Railway 환경에서 JWT_SECRET이 재시작 시마다 달라지면 refresh도 실패 → clearAuth → 로그인으로 리다이렉트
  (이 경우엔 오류 화면이 아니라 로그인 화면으로 가야 함)
- 토큰이 아직 유효한데(1시간 이내 복귀) 다른 원인으로 API가 실패하는 경우

### 가설 C — 네트워크 에러 1회 재시도로 부족
- 인터셉터의 네트워크 에러 재시도는 1회만 수행
- 백엔드가 막 깨어난 직후 첫 번째 요청이 실패하면 재시도 1회 후 오류로 처리

### 가설 D — React Query 에러 캐시
- 일부 useQuery 쿼리가 실패 → 에러 상태로 캐시됨
- 이후 토큰이 갱신돼도 staleTime 내에는 재요청 안 함 (retry: 1이므로 1회만 재시도)

---

## 다음 수정 방향

### 수정 1 — health 엔드포인트에 DB 핑 추가 (백엔드)
```java
// HealthController.java
@GetMapping("/health")
public ResponseEntity<Map<String, String>> health() {
    // DB 연결 확인용 쿼리 (경량)
    entityManager.createNativeQuery("SELECT 1").getSingleResult();
    return ResponseEntity.ok(Map.of("status", "ok"));
}
```
→ DB가 준비되지 않으면 500 반환 → 워밍업이 재시도 → 완전히 준비된 후 페이지 렌더

### 수정 2 — 워밍업 완료 후 실제 인증 API 1회 호출
DB도 체크하고 토큰도 동시에 검증:
```javascript
// health 통과 후 실제 인증 API를 테스트 호출
// 401이면 refresh, 성공이면 통과, 서버 에러면 재시도
try {
  await client.get('/classes/roster') // 혹은 다른 경량 엔드포인트
} catch (e) {
  if (e.response?.status !== 401) {
    // 토큰 문제가 아닌 서버 에러 → 재시도
    await new Promise(r => setTimeout(r, 3000))
    continue
  }
}
```

### 수정 3 — 네트워크 에러 재시도 횟수 증가
```javascript
// client.js 인터셉터 — 재시도 횟수 1 → 3
if (!error.response && original._networkRetryCount < 3) {
  original._networkRetryCount = (original._networkRetryCount || 0) + 1
  await new Promise(resolve => setTimeout(resolve, 2000 * original._networkRetryCount))
  return client(original)
}
```

### 수정 4 — React Query 에러 시 자동 재시도 강화
```javascript
// queryClient.js
retry: (failureCount, error) => {
  if (error?.response?.status === 401) return false // 401은 인터셉터가 처리
  return failureCount < 3
},
retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000),
```

---

## 디버깅을 위해 추가할 로그

브라우저 콘솔에서 확인할 수 있도록 아래 로그를 추가하면 원인 특정 가능:

```javascript
// router/index.jsx tryWarmup 내부
console.log('[Warmup] health check passed')
console.log('[Warmup] token expiry check:', isTokenExpiredOrExpiring(tok))
console.log('[Warmup] token refresh result:', data)

// classesApi.getRoster() 호출부
console.log('[Roster] fetch start, token:', useAuthStore.getState().accessToken?.slice(-10))
// catch 내부
console.log('[Roster] fetch error:', error.response?.status, error.message)
```

---

## 우선순위

1. **수정 1 (health DB 핑)** — 가장 근본적, 백엔드 1줄 수정
2. **수정 3 (네트워크 재시도 증가)** — 프론트엔드, 방어적 대응
3. **수정 4 (React Query retry 강화)** — 프론트엔드, 방어적 대응
4. **수정 2 (워밍업에서 실제 API 호출)** — 수정 1이 해결 안 될 경우
