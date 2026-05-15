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

const ROLE_MAP = {
  PASTOR:    { label: '목사님',  bg: 'bg-blue-100    text-blue-700' },
  EXECUTIVE: { label: '임원',    bg: 'bg-amber-100   text-amber-700' },
  TEACHER:   { label: '교사',    bg: 'bg-emerald-100 text-emerald-700' },
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

  const [profileForm, setProfileForm] = useState(null)
  const form = profileForm ?? {
    name:          user?.name ?? '',
    phone:         myProfile?.phone ?? user?.phone ?? '',
    birthDate:     myProfile?.birthDate ?? user?.birthDate ?? '',
    profileImage:  myProfile?.profileImage ?? '',
    positionTitle: myProfile?.positionTitle ?? user?.positionTitle ?? '',
  }
  const setForm = (key, val) => setProfileForm(prev => ({ ...(prev ?? form), [key]: val }))

  // ── 프로필 저장 ──────────────────────────────────────────
  const profileMutation = useMutation({
    mutationFn: () => usersApi.updateProfile({
      name:          form.name,
      phone:         form.phone,
      birthDate:     form.birthDate || null,
      profileImage:  form.profileImage || null,
      positionTitle: form.positionTitle || null,
    }),
    onSuccess: () => {
      updateUserSettings({ name: form.name, phone: form.phone, birthDate: form.birthDate, positionTitle: form.positionTitle })
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
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
    try { await authApi.logout() } catch {}
    queryClient.clear()
    clearAuth()
    navigate('/login', { replace: true })
  }

  // ── 비밀번호 변경 ─────────────────────────────────────────
  const pwMutation = useMutation({
    mutationFn: () => usersApi.changePassword(currentPw, newPw),
    onSuccess: () => {
      setPwResult({ ok: true, msg: '비밀번호가 성공적으로 변경되었습니다.' })
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
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 px-6 pt-8 pb-14">
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center border-2 border-white/40 overflow-hidden">
            {profileImage
              ? <img src={profileImage} alt={user?.name} className="w-full h-full object-cover" />
              : <span className="text-white text-3xl font-black">{user?.name?.[0] ?? '?'}</span>
            }
          </div>
          <div className="text-center">
            <h2 className="text-white text-xl font-black">{user?.name}</h2>
            <span className={`inline-block mt-1.5 text-xs font-bold px-3 py-1 rounded-full ${roleCfg.bg}`}>
              {roleCfg.label}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-6 flex flex-col gap-3 pb-10">
        {/* 계정 정보 */}
        <Card className="flex flex-col gap-0 overflow-hidden !p-0">
          <p className="text-xs font-bold text-gray-400 px-4 pt-4 pb-2 uppercase tracking-widest">계정 정보</p>
          <InfoRow icon={User}   label="이름"  value={user?.name} />
          <InfoRow icon={Mail}   label="이메일" value={user?.email}   divider />
          <InfoRow icon={Shield} label="권한"  value={roleCfg.label} divider />
        </Card>

        {/* 내 프로필 편집 */}
        <Card className="!p-0 overflow-hidden">
          <button
            onClick={() => { setProfileOpen(v => !v); setProfileResult(null) }}
            className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <PenLine size={15} className="text-emerald-500" />
              </div>
              <div className="text-left">
                <span className="text-sm font-bold text-gray-800">프로필 정보 수정</span>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                  교사 교적부에 표시되는 정보를 입력해 주세요
                </p>
              </div>
            </div>
            <motion.div animate={{ rotate: profileOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronRight size={18} className="text-gray-300" />
            </motion.div>
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
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
                          : <Camera size={28} className="text-gray-300" />
                        }
                      </div>
                      <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center shadow-lg cursor-pointer active:scale-90 transition-all">
                        <ImageIcon size={14} />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files[0]
                            if (file) {
                              const reader = new FileReader()
                              reader.onloadend = () => setForm('profileImage', reader.result)
                              reader.readAsDataURL(file)
                            }
                          }}
                        />
                      </label>
                      {form.profileImage && (
                        <button
                          onClick={() => setForm('profileImage', '')}
                          className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400">JPG, PNG 파일 지원</p>
                  </div>

                  {/* 이름 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                      <User size={12} /> 이름
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm('name', e.target.value)}
                      className="w-full px-3.5 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>

                  {/* 전화번호 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                      <Phone size={12} /> 전화번호
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
                        let formatted = digits
                        if (digits.length > 7) formatted = `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`
                        else if (digits.length > 3) formatted = `${digits.slice(0,3)}-${digits.slice(3)}`
                        setForm('phone', formatted)
                      }}
                      placeholder="010-0000-0000"
                      className="w-full px-3.5 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>

                  {/* 생년월일 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                      <Calendar size={12} /> 생년월일
                    </label>
                    <input
                      type="date"
                      value={form.birthDate}
                      onChange={e => setForm('birthDate', e.target.value)}
                      className="w-full px-3.5 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary-300"
                    />
                    {form.birthDate && (
                      <p className="text-[11px] text-primary-500 font-medium px-1">
                        만 {calcAge(form.birthDate)}세
                      </p>
                    )}
                  </div>

                  {/* 직책 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                      🏷️ 직책 <span className="font-normal text-gray-400">(선택)</span>
                    </label>
                    <input
                      type="text"
                      value={form.positionTitle}
                      onChange={e => setForm('positionTitle', e.target.value)}
                      placeholder="예: 회장, 총무, 서기, 담임 등"
                      maxLength={20}
                      className="w-full px-3.5 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary-300"
                    />
                    <p className="text-[10px] text-gray-400 px-1">교사 교적부에 태그로 표시됩니다</p>
                  </div>

                  {profileResult && (
                    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold ${
                      profileResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                    }`}>
                      {profileResult.ok && <CheckCircle2 size={14} />}
                      {profileResult.msg}
                    </div>
                  )}

                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => { setProfileOpen(false); setProfileForm(null); setProfileResult(null) }}
                      className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm active:bg-gray-200 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => profileMutation.mutate()}
                      disabled={profileMutation.isPending}
                      className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-bold text-sm active:bg-primary-600 disabled:opacity-50 transition-colors"
                    >
                      {profileMutation.isPending ? '저장 중...' : '저장하기'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* 비밀번호 변경 */}
        <Card className="!p-0 overflow-hidden">
          <button
            onClick={() => { setPwOpen(v => !v); setPwResult(null) }}
            className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Lock size={15} className="text-primary-500" />
              </div>
              <span className="text-sm font-bold text-gray-800">비밀번호 변경</span>
            </div>
            <motion.div animate={{ rotate: pwOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronRight size={18} className="text-gray-300" />
            </motion.div>
          </button>

          <AnimatePresence>
            {pwOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <form onSubmit={handlePwSubmit} className="px-4 pb-5 pt-1 flex flex-col gap-3 border-t border-gray-50">
                  <PwInput label="현재 비밀번호" value={currentPw} onChange={setCurrentPw}
                    show={showCurrent} onToggle={() => setShowCurrent(v => !v)} id="current-pw" autoComplete="current-password" />
                  <PwInput label="새 비밀번호 (8자 이상)" value={newPw} onChange={setNewPw}
                    show={showNew} onToggle={() => setShowNew(v => !v)} id="new-pw" autoComplete="new-password" />
                  <PwInput label="새 비밀번호 확인" value={confirmPw} onChange={setConfirmPw}
                    show={showConfirm} onToggle={() => setShowConfirm(v => !v)} id="confirm-pw" autoComplete="new-password" />
                  {pwResult && (
                    <p className={`text-xs font-bold px-1 ${pwResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                      {pwResult.msg}
                    </p>
                  )}
                  <div className="flex gap-2 mt-1">
                    <button type="button" onClick={closePwPanel}
                      className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm active:bg-gray-200 transition-colors">
                      취소
                    </button>
                    <button type="submit" disabled={pwMutation.isPending || !currentPw || !newPw || !confirmPw}
                      className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-bold text-sm active:bg-primary-600 disabled:opacity-50 transition-colors">
                      {pwMutation.isPending ? '변경 중...' : '변경하기'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* 화면 설정 */}
        <Card className="!p-0 overflow-hidden">
          <p className="text-xs font-bold text-gray-400 px-4 pt-4 pb-2 uppercase tracking-widest">화면 설정</p>
          <div className="flex items-center justify-between px-4 py-3.5 border-t border-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Type size={15} className="text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">큰 글씨 모드</p>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">글자 크기를 키워드립니다</p>
              </div>
            </div>
            <button
              onClick={handleToggleLargeFont}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 flex-shrink-0 ${largeFontMode ? 'bg-indigo-500' : 'bg-gray-200'}`}
            >
              <motion.div
                animate={{ x: largeFontMode ? 24 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
              />
            </button>
          </div>
        </Card>

        {/* 앱 정보 */}
        <Card className="!p-0 overflow-hidden">
          <p className="text-xs font-bold text-gray-400 px-4 pt-4 pb-2 uppercase tracking-widest">앱 정보</p>
          <div className="flex items-center justify-between px-4 py-3.5 border-t border-gray-50">
            <span className="text-sm text-gray-700">버전</span>
            <span className="text-sm text-gray-400">v0.1.0</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5 border-t border-gray-50">
            <span className="text-sm text-gray-700">Newave Flow</span>
            <span className="text-sm text-gray-400">교회 교육부 관리 시스템</span>
          </div>
        </Card>

        {/* 로그아웃 */}
        {!logoutConfirm ? (
          <button
            onClick={() => setLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2.5 bg-white border border-red-200 text-red-500 font-bold py-4 rounded-2xl active:bg-red-50 transition-colors"
          >
            <LogOut size={18} /> 로그아웃
          </button>
        ) : (
          <Card className="flex flex-col gap-3 border border-red-100 bg-red-50">
            <p className="text-center font-semibold text-gray-800 text-sm">정말 로그아웃 하시겠어요?</p>
            <div className="flex gap-2">
              <button onClick={() => setLogoutConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-gray-600 font-semibold text-sm active:bg-gray-50">
                취소
              </button>
              <button onClick={handleLogout} disabled={logoutLoading}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm active:bg-red-600 disabled:opacity-60">
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
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-gray-800 truncate">{value ?? '-'}</p>
      </div>
    </div>
  )
}

function PwInput({ label, value, onChange, show, onToggle, id, autoComplete = 'off' }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-gray-500">{label}</label>
      <div className="relative flex items-center bg-gray-50 border border-gray-100 rounded-xl">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 bg-transparent px-3.5 py-3 pr-10 text-sm text-gray-800 outline-none rounded-xl"
          placeholder="••••••••"
          autoComplete={autoComplete}
        />
        <button type="button" onClick={onToggle} className="absolute right-3 text-gray-400 p-1">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )
}
