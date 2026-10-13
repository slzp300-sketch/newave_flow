export default function KakaoButton({ onClick, disabled, loading, children = '카카오 로그인', className = '' }) {
  return <button type="button" disabled={disabled || loading} aria-busy={loading || undefined} onClick={onClick}
    className={`social-kakao flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60 ${className}`}>
    <svg width="19" height="19" viewBox="61 16 14 14" fill="currentColor" aria-hidden="true">
      {/* Kakao's official symbol, from the login design resource. */}
      <path d="M68.001 16.5225C64.4222 16.5225 61.5225 19.0037 61.5225 22.0641C61.5225 24.0312 62.7219 25.7596 64.5292 26.7423L63.9181 29.2113C63.8954 29.285 63.9132 29.364 63.9619 29.4184C63.9975 29.457 64.0461 29.478 64.0931 29.478C64.1337 29.478 64.1742 29.464 64.2082 29.4341L66.834 27.5144C67.2117 27.5723 67.6007 27.6039 67.9994 27.6039C71.5767 27.6039 74.478 25.1226 74.478 22.0623C74.478 19.002 71.5783 16.5225 68.001 16.5225Z" />
    </svg>{loading ? '카카오 연결 중…' : children}
  </button>
}
