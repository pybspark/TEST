'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Cloud, Mail, Lock, Eye, EyeOff, KeyRound } from 'lucide-react'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/dashboard')
        router.refresh()
      } else {
        // 전역 초대 코드 확인 (관리자 발급 코드, 그룹 배정은 나중에 관리자가 함)
        const validateRes = await fetch('/api/validate-invite-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: inviteCode.trim() }),
        })
        const validateData = await validateRes.json().catch(() => ({}))
        if (!validateData.valid) {
          toast.error('올바르지 않거나 이미 사용된 초대 코드예요')
          setLoading(false)
          return
        }

        const codeToUse = inviteCode.trim()

        // 가입 진행 (그룹에는 넣지 않음)
        const { data: signUpData, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name } }
        })
        if (error) throw error

        // 발급된 초대 코드 사용 처리 (1회 사용, 가입 직후라 세션 없을 수 있어 이메일 전달)
        if (signUpData.user) {
          const useRes = await fetch('/api/use-invite-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: codeToUse, email: signUpData.user.email }),
          })
          if (!useRes.ok) {
            const useData = await useRes.json().catch(() => ({}))
            toast.error(useData.error || '초대 코드 사용 처리에 실패했어요')
            setLoading(false)
            return
          }
        }

        toast.success('가입되었어요! 로그인해 주세요. 그룹은 관리자가 배정해 드릴 거예요 🎉')
        setMode('login')
      }
    } catch (err: any) {
      toast.error(err.message || '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600 rounded-2xl mb-4 shadow-lg">
            <Cloud className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">BIN CLOUD</h1>
          <p className="text-gray-500 text-sm mt-1">클라우드 저장소</p>
        </div>

        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {m === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <>
              <input
                type="text"
                placeholder="이름 (예: 아빠, 엄마)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <div className="relative">
                <KeyRound className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="초대 코드 입력 (필수)"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
            </>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
            <input
              type="email"
              placeholder="이메일 주소"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3.5">
              {showPw ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-800 transition-colors disabled:opacity-60"
          >
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
          </button>
        </form>

        {mode === 'signup' && (
          <p className="text-center text-xs text-gray-400 mt-4">
            초대 코드는 관리자가 발급합니다. 가입 후 그룹은 관리자가 배정해 드려요
          </p>
        )}
      </div>
    </div>
  )
}