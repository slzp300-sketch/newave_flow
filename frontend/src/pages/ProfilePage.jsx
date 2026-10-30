import AppSelect from '../components/common/AppSelect'
import { CollapsePanel } from '../components/common/Motion'
import PhotoReviewStatus from '../components/common/PhotoReviewStatus'
import { readProfilePhoto } from '../utils/profilePhoto'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import {
  LogOut, User, Mail, Shield, Lock, Eye, EyeOff, ChevronRight,
  Type, Camera, Image as ImageIcon, X, Phone, Calendar, PenLine,
  CheckCircle2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import useAuthStore from '../store/authStore'
import { authApi } from '../api/auth'
import { usersApi } from '../api/users'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import NotificationPreferences from '../components/notifications/NotificationPreferences'

const ROLE_MAP = {
  PASTOR:    { label: '목사님',  bg: 'bg-primary-100    text-primary-700' },
  EXECUTIVE: { label: '임원',    bg: 'bg-amber-100   text-amber-700' },
  TEACHER:   { label: '교사',    bg: 'bg-secondary-100 text-secondary-700' },
  ADMIN:     { label: '관리자',  bg: 'bg-rose-100    text-rose-700' },
}

function calcAge(birth) {
  if (!birth) return null
  const today = new Date()
  const b = new Date(birth)
  let age = today.getFullYear() - b.getFullYear()
  if (today.getMonth() < b.getMonth() ||
    (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age--
  return age
}

export default function ProfilePage() {
  const navigate    = useNavigate()
  const { user, clearAuth, updateUserSettings } = useAuthStore()
  const queryClient = useQueryClient()

  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [pwOpen, setPwOpen]               = useState(false)
  const [profileOpen, setProfileOpen]     = useState(false)
  const [currentPw, setCurrentPw]         = useState('')
  const [newPw, setNewPw]                 = useState('')
  const [confirmPw, setConfirmPw]         = useState('')
  const [showCurrent, setShowCurrent]     = useState(false)
  const [showNew, setShowNew]             = useState(false)
  const [showConfirm, setShowConfirm]     = useState(false)
  const [pwResult, setPwResult]           = useState(null)
  const [profileResult, setProfileResult] = useState(null)

  const roleCfg      = ROLE_MAP[user?.role] ?? ROLE_MAP.TEACHER
  const largeFontMode = user?.largeFont ?? false

  // ── 내 프로필 데이터 (profileImage 포함) ──────────────────
  const { data: myProfile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => usersApi.getMyProfile().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const CHURCH_POSITIONS = ['', '성도', '청년', '집사', '안수집사', '권사', '목사']

  const [profileForm, setProfileForm] = useState(null)
  const form = profileForm ?? {
    name:          user?.name ?? '',
    phone:         myProfile?.phone ?? user?.phone ?? '',
    gender:        myProfile?.gender ?? '',
    birthDate:     myProfile?.birthDate ?? user?.birthDate ?? '',
    profileImage:  myProfile?.profileImage ?? '',
    churchPosition: myProfile?.churchPosition ?? user?.churchPosition ?? '',
  }
  const setForm = (key, val) => setProfileForm(prev => ({ ...(prev ?? form), [key]: val }))

  // ── 프로필 저장 ──────────────────────────────────────────
  const profileMutation = useMutation({
    mutationFn: () => usersApi.updateProfile({
      name:           form.name,
      phone:          form.phone,
      gender:         form.gender,
      birthDate:      form.birthDate || null,
      profileImage:   form.profileImage || null,
      churchPosition: form.churchPosition || null,
    }),
    onSuccess: () => {
      updateUserSettings({ name: form.name, phone: form.phone, birthDate: form.birthDate, churchPosition: form.churchPosition })
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      queryClient.invalidateQueries({ queryKey: ['teacher-roster'] })
      queryClient.invalidateQueries({ queryKey: ['weekly-worship'] })
      queryClient.invalidateQueries({ queryKey: ['weekly-report'] })
      queryClient.invalidateQueries({ queryKey: ['photo-review-status'] })
      queryClient.invalidateQueries({ queryKey: ['safety-summary'] })
      setProfileResult({ ok: true, msg: '프로필이 저장되었습니다.' })
      setProfileForm(null)
      setTimeout(() => setProfileResult(null), 2500)
    },
    onError: (err) => {
      setProfileResult({ ok: false, msg: err?.response?.data?.message ?? '저장에 실패했습니다.' })
    },
  })

  // ── 큰글씨 모드 ──────────────────────────────────────────
  const handleToggleLargeFont = async () => {
    const newValue = !largeFontMode
    updateUserSettings({ largeFont: newValue })
    try {
      await usersApi.updateSettings({ largeFont: newValue })
    } catch {
      updateUserSettings({ largeFont: largeFontMode })
    }
  }

  // ── 로그아웃 ─────────────────────────────────────────────
  const handleLogout = async () => {
    setLogoutLoading(true)
    try { await authApi.logout() } catch {
      alert('서버에 연결하지 못해 이 기기에서만 로그아웃합니다. 다른 기기의 로그인은 유지될 수 있습니다.')
    }
    queryClient.clear()
    clearAuth()
    navigate('/login', { replace: true })
  }

  // ── 비밀번호 변경 ─────────────────────────────────────────
  const pwMutation = useMutation({
    mutationFn: () => usersApi.changePassword(currentPw, newPw),
    onSuccess: () => {
      alert('비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.')
      queryClient.clear()
      clearAuth()
      navigate('/login', { replace: true })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    },
    onError: (err) => {
      setPwResult({ ok: false, msg: err?.response?.data?.message ?? '비밀번호 변경에 실패했습니다.' })
    },
  })

  const handlePwSubmit = (e) => {
    e.preventDefault()
    setPwResult(null)
    if (newPw.length < 8) { setPwResult({ ok: false, msg: '새 비밀번호는 8자 이상이어야 합니다.' }); return }
    if (newPw !== confirmPw) { setPwResult({ ok: false, msg: '새 비밀번호가 일치하지 않습니다.' }); return }
    pwMutation.mutate()
  }

  const closePwPanel = () => {
    setPwOpen(false); setPwResult(null)
    setCurrentPw(''); setNewPw(''); setConfirmPw('')
  }

  const profileImage = profileForm?.profileImage ?? myProfile?.profileImage ?? null

  return (
    <div className="min-h-screen bg-surface">
      <Header title="내 정보" />

      {/* 프로필 헤더 */}
      <div className="bg-primary-900 px-6 pt-6 pb-12">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 shrink-0 rounded-full bg-white/20 backdrop-blur flex items-center justify-center border-2 border-white/40 overflow-hidden">
            {profileImage
              ? <img src={profileImage} alt={user?.name} className="w-full h-full object-cover" />
              : <span className="text-white text-3xl font-bold">{user?.name?.[0] ?? '?'}</span>
            }
          </div>
          <div className="min-w-0">
            <h2 className="text-white text-xl font-bold leading-snug break-words">{user?.name}</h2>
            <span className={`inline-block mt-1.5 text-sm font-semibold px-3 py-1 rounded-full ${roleCfg.bg}`}>
              {roleCfg.label}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-6 flex flex-col gap-4 pb-10">
        {/* 계정 정보 */}
        <Card className="flex flex-col gap-0 overflow-hidden !p-0">
          <h2 className="text-base font-bold text-gray-900 px-4 pt-4 pb-3">계정 정보</h2>
          <InfoRow icon={User}   label="이름"  value={user?.name} />
          <InfoRow icon={Mail}   label="이메일" value={user?.email}   divider />
          {user?.passwordLoginEnabled === false && <InfoRow icon={Lock} label="로그인 방법" value="Apple로 로그인" divider />}
          <InfoRow icon={Shield} label="권한"  value={roleCfg.label} divider />
        </Card>

        <Card className="!p-0 overflow-hidden">
          <button type="button" onClick={() => navigate('/profile/connections')} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-4 text-left text-base font-bold text-gray-900">
            <span>계정 연결 관리</span><ChevronRight size={18} aria-hidden="true" />
          </button>
        </Card>

        {/* 내 프로필 편집 */}
        <Card className="!p-0 overflow-hidden">
          <button
            aria-expanded={profileOpen} aria-controls="profile-editor" onClick={() => { setProfileOpen(v => !v); setProfileResult(null) }}
            className="w-full flex items-center justify-between gap-3 px-4 py-4 active:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary-50 flex items-center justify-center flex-shrink-0">
                <PenLine size={15} className="text-secondary-700" />
              </div>
              <div className="text-left">
                <span className="text-base font-bold text-gray-900">프로필 정보 수정</span>

              </div>
            </div>
            <motion.div animate={{ rotate: profileOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronRight size={18} className="text-gray-500" />
            </motion.div>
          </button>

          <AnimatePresence>
            {profileOpen && (
              <CollapsePanel id="profile-editor"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-5 pt-2 flex flex-col gap-4 border-t border-gray-50">
                  {/* 프로필 사진 */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-gray-200">
                        {form.profileImage
                          ? <img src={form.profileImage} alt="preview" className="w-full h-full object-cover" />
                          : <Camera size={28} className="text-gray-500" />
                        }
                      </div>
                      <label className="absolute -bottom-1 -right-1 w-11 h-11 bg-primary-500 text-white rounded-full flex items-center justify-center shadow-lg cursor-pointer focus-within:ring-2 focus-within:ring-primary-300 focus-within:ring-offset-2 active:scale-90 transition-all">
                        <ImageIcon size={14} />
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          aria-label="내 프로필 사진 선택"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={e => {
                            const file = e.target.files[0]
                            if (file) {
                              readProfilePhoto(file).then(image => { setForm('profileImage', image); setProfileResult(null) })
                                .catch(error => setProfileResult({ ok: false, msg: error.message }))
                            }
                          }}
                        />
                      </label>
                      {form.profileImage && (
                        <button
                          aria-label="선택한 프로필 사진 삭제" onClick={() => setForm('profileImage', '')}
                          className="absolute -top-4 -right-4 w-11 h-11 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                    <PhotoReviewStatus textClassName="text-sm leading-relaxed text-gray-600" targetType="USER" targetId={user?.id} onRemoved={() => setForm('profileImage', '')} />
                  </div>

                  {/* 이름 */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="profile-name" className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
                      <User size={12} /> 이름
                    </label>
                    <input
                      id="profile-name" type="text"
                      value={form.name}
                      onChange={e => setForm('name', e.target.value)}
                      className="w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base text-gray-900 outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>

                  {/* 전화번호 */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="profile-phone" className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
                      <Phone size={12} /> 전화번호
                    </label>
                    <input
                      id="profile-phone" type="tel"
                      value={form.phone}
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
                        let formatted = digits
                        if (digits.length > 7) formatted = `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`
                        else if (digits.length > 3) formatted = `${digits.slice(0,3)}-${digits.slice(3)}`
                        setForm('phone', formatted)
                      }}
                      placeholder="010-0000-0000"
                      className="w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base text-gray-900 outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="profile-gender" className="text-sm font-semibold text-gray-600">성별</label>
                    <AppSelect aria-label="성별" id="profile-gender" value={form.gender} onChange={e => setForm('gender', e.target.value)} className="w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base text-gray-900">
                      <option value="">미등록</option><option value="남">남</option><option value="여">여</option>
                    </AppSelect>

                  </div>

                  {/* 생년월일 */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="profile-birthDate" className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
                      <Calendar size={12} /> 생년월일
                    </label>
                    <input
                      id="profile-birthDate" type="date"
                      value={form.birthDate}
                      onChange={e => setForm('birthDate', e.target.value)}
                      className="w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base text-gray-900 outline-none focus:ring-2 focus:ring-primary-300"
                    />
                    {form.birthDate && (
                      <p className="text-sm text-primary-700 font-medium px-1">
                        만 {calcAge(form.birthDate)}세
                      </p>
                    )}
                  </div>

                  {/* 직분 */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="profile-position" className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
                      🙏 직분 <span className="font-normal text-gray-600">(선택)</span>
                    </label>
                    <AppSelect aria-label="직분" id="profile-position"
                      value={form.churchPosition}
                      onChange={e => setForm('churchPosition', e.target.value)}
                      className="w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base text-gray-900 outline-none focus:ring-2 focus:ring-primary-300 appearance-none"
                    >
                      {CHURCH_POSITIONS.map(p => (
                        <option key={p} value={p}>{p || '선택 안 함'}</option>
                      ))}
                    </AppSelect>

                  </div>

                  {profileResult && (
                    <div role="status" className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold ${
                      profileResult.ok ? 'bg-secondary-50 text-secondary-700' : 'bg-red-50 text-red-600'
                    }`}>
                      {profileResult.ok && <CheckCircle2 size={14} />}
                      {profileResult.msg}
                    </div>
                  )}

                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => { setProfileOpen(false); setProfileForm(null); setProfileResult(null) }}
                      className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-semibold text-base active:bg-gray-200 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => profileMutation.mutate()}
                      disabled={profileMutation.isPending}
                      className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-bold text-base active:bg-primary-600 disabled:opacity-50 transition-colors"
                    >
                      {profileMutation.isPending ? '저장 중...' : '저장하기'}
                    </button>
                  </div>
                </div>
              </CollapsePanel>
            )}
          </AnimatePresence>
        </Card>

        {/* 비밀번호 변경 */}
        {user?.passwordLoginEnabled !== false && <Card className="!p-0 overflow-hidden">
          <button
            aria-expanded={pwOpen} aria-controls="password-editor" onClick={() => { setPwOpen(v => !v); setPwResult(null) }}
            className="w-full flex items-center justify-between gap-3 px-4 py-4 active:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Lock size={15} className="text-primary-500" />
              </div>
              <span className="text-base font-bold text-gray-900">비밀번호 변경</span>
            </div>
            <motion.div animate={{ rotate: pwOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronRight size={18} className="text-gray-500" />
            </motion.div>
          </button>

          <AnimatePresence>
            {pwOpen && (
              <CollapsePanel id="password-editor"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <form onSubmit={handlePwSubmit} className="px-4 pb-5 pt-4 flex flex-col gap-4 border-t border-gray-50">
                  <PwInput label="현재 비밀번호" value={currentPw} onChange={setCurrentPw}
                    show={showCurrent} onToggle={() => setShowCurrent(v => !v)} id="current-pw" autoComplete="current-password" />
                  <PwInput label="새 비밀번호 (8자 이상)" value={newPw} onChange={setNewPw}
                    show={showNew} onToggle={() => setShowNew(v => !v)} id="new-pw" autoComplete="new-password" />
                  <PwInput label="새 비밀번호 확인" value={confirmPw} onChange={setConfirmPw}
                    show={showConfirm} onToggle={() => setShowConfirm(v => !v)} id="confirm-pw" autoComplete="new-password" />
                  {pwResult && (
                    <p role="alert" className={`text-sm font-semibold px-1 ${pwResult.ok ? 'text-secondary-600' : 'text-red-500'}`}>
                      {pwResult.msg}
                    </p>
                  )}
                  <div className="flex gap-2 mt-1">
                    <button type="button" onClick={closePwPanel}
                      className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-semibold text-base active:bg-gray-200 transition-colors">
                      취소
                    </button>
                    <button type="submit" disabled={pwMutation.isPending || !currentPw || !newPw || !confirmPw}
                      className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-bold text-base active:bg-primary-600 disabled:opacity-50 transition-colors">
                      {pwMutation.isPending ? '변경 중...' : '변경하기'}
                    </button>
                  </div>
                </form>
              </CollapsePanel>
            )}
          </AnimatePresence>
        </Card>}

        {/* 화면 설정 */}
        <Card className="!p-0 overflow-hidden">
          <h2 className="text-base font-bold text-gray-900 px-4 pt-4 pb-3">화면 설정</h2>
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-t border-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Type size={15} className="text-primary-500" />
              </div>
              <div>
                <p className="text-base font-bold text-gray-900">큰 글씨 모드</p>

              </div>
            </div>
            <button
              onClick={handleToggleLargeFont}
              role="switch"
              aria-label="큰 글씨 모드"
              aria-checked={largeFontMode}
              className="w-12 min-h-11 flex items-center shrink-0"
            >
              <span className={`relative block w-12 h-6 rounded-full transition-colors ${largeFontMode ? 'bg-secondary-700' : 'bg-gray-200'}`}>
              <motion.div
                animate={{ x: largeFontMode ? 24 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
              />
              </span>
            </button>
          </div>
        </Card>

        <NotificationPreferences />

        {/* 앱 정보 */}
        <Card className="!p-0 overflow-hidden">
          <h2 className="text-base font-bold text-gray-900 px-4 pt-4 pb-3">앱 정보</h2>
          <div className="flex flex-col gap-1 px-4 py-3.5 border-t border-gray-50">
            <span className="text-sm font-semibold text-gray-700">버전</span>
            <span className="min-w-0 text-sm text-gray-600 break-all">{__APP_BUILD_ID__}</span>
          </div>
          <div className="flex flex-col gap-1 px-4 py-3.5 border-t border-gray-50">
            <span className="text-sm text-gray-700">Newave Flow</span>
            <span className="text-sm text-gray-600">교회 교육부 관리 시스템</span>
          </div>
        </Card>

        {/* 이용 안내 */}
        <Card className="!p-0 overflow-hidden">
          <h2 className="px-4 pt-4 pb-2 text-sm font-semibold text-gray-600">이용 안내</h2>
          <button className="w-full px-4 py-4 text-left text-base font-semibold text-gray-800" onClick={() => navigate('/safety/report')}>콘텐츠·사용자 신고</button>
          <button className="w-full px-4 py-4 text-left text-base font-semibold text-gray-800 border-t border-gray-100" onClick={() => navigate('/community-guidelines')}>이용수칙</button>
          <button className="w-full px-4 py-4 text-left text-base font-semibold text-gray-800 border-t border-gray-100" onClick={() => navigate('/privacy')}>개인정보처리방침</button>
          <button className="w-full px-4 py-4 text-left text-base font-bold text-gray-900 border-t border-gray-100" onClick={() => navigate('/support')}>고객지원</button>
          <button className="w-full px-4 py-4 text-left text-base font-bold text-gray-900 border-t border-gray-100" onClick={() => navigate('/account-deletion')}>회원 탈퇴·계정 삭제 요청</button>
        </Card>
        {!logoutConfirm ? (
          <button
            onClick={() => setLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2.5 bg-white border border-red-200 text-red-500 font-bold py-4 rounded-2xl active:bg-red-50 transition-colors"
          >
            <LogOut size={18} /> 로그아웃
          </button>
        ) : (
          <Card className="flex flex-col gap-3 border border-red-100 bg-red-50">
            <p className="text-center font-semibold text-gray-900 text-base">정말 로그아웃 하시겠어요?</p>
            <div className="flex gap-2">
              <button onClick={() => setLogoutConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-gray-600 font-semibold text-base active:bg-gray-50">
                취소
              </button>
              <button onClick={handleLogout} disabled={logoutLoading}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-base active:bg-red-600 disabled:opacity-60">
                {logoutLoading ? '처리 중...' : '로그아웃'}
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, divider = false }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${divider ? 'border-t border-gray-50' : ''}`}>
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-600 mb-1">{label}</p>
        <p className="text-base font-semibold text-gray-900 break-words [overflow-wrap:anywhere]">{value ?? '-'}</p>
      </div>
    </div>
  )
}

function PwInput({ label, value, onChange, show, onToggle, id, autoComplete = 'off' }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-gray-600">{label}</label>
      <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-xl">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full min-w-0 flex-1 bg-transparent px-3.5 py-3 pr-12 text-base text-gray-900 outline-none focus:ring-2 focus:ring-primary-300 rounded-xl"
          placeholder="••••••••"
          autoComplete={autoComplete}
        />
        <button type="button" onClick={onToggle} aria-label={`${label} ${show ? '숨기기' : '보기'}`} aria-pressed={show} className="absolute right-0.5 min-w-11 min-h-11 flex items-center justify-center text-gray-600 rounded-lg focus-visible:ring-2 focus-visible:ring-primary-300">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )
}
