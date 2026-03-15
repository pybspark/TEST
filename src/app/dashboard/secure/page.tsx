'use client'

import { useState, useEffect } from 'react'
import { Lock, LockOpen, Shield, FolderLock } from 'lucide-react'
import { toast } from 'sonner'

const SECURE_UNLOCK_KEY = 'secureFolderUnlocked'

export default function SecureFolderPage() {
  const [hasPin, setHasPin] = useState<boolean | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/secure/status')
      .then((r) => r.json())
      .then((data) => {
        setHasPin(data.hasPin === true)
        if (typeof window !== 'undefined' && sessionStorage.getItem(SECURE_UNLOCK_KEY) === 'true') {
          setUnlocked(true)
        }
      })
      .catch(() => setHasPin(false))
  }, [])

  async function handleSetPin(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length < 4 || pin.length > 12) {
      toast.error('비밀번호는 4~12자로 설정해주세요')
      return
    }
    if (pin !== confirmPin) {
      toast.error('두 비밀번호가 일치하지 않아요')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/secure/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || '설정 실패')
        return
      }
      toast.success('2차 비밀번호가 설정되었어요')
      setHasPin(true)
      setPin('')
      setConfirmPin('')
      sessionStorage.setItem(SECURE_UNLOCK_KEY, 'true')
      setUnlocked(true)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!pin.trim()) {
      toast.error('비밀번호를 입력해주세요')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/secure/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        toast.error('비밀번호가 맞지 않아요')
        setPin('')
        return
      }
      sessionStorage.setItem(SECURE_UNLOCK_KEY, 'true')
      setUnlocked(true)
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  function handleLock() {
    sessionStorage.removeItem(SECURE_UNLOCK_KEY)
    setUnlocked(false)
    setPin('')
    setConfirmPin('')
    toast.success('보안 폴더가 잠겼어요')
  }

  if (hasPin === null) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // 잠금 해제된 상태: 보안 폴더 내용
  if (unlocked) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">보안 폴더</h1>
            <p className="text-sm text-gray-500 mt-0.5">2차 비밀번호로 보호되는 공간이에요</p>
          </div>
          <button
            onClick={handleLock}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <Lock className="w-4 h-4" />
            잠그기
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FolderLock className="w-7 h-7 text-brand-600" />
          </div>
          <p className="text-gray-700 font-medium">보안 폴더입니다</p>
          <p className="text-sm text-gray-400 mt-1">여기에 보관한 항목은 2차 비밀번호 입력 후에만 볼 수 있어요</p>
          <p className="text-xs text-gray-400 mt-4">추후 보안 폴더 전용 파일·메모 기능을 추가할 수 있어요</p>
        </div>
      </div>
    )
  }

  // 2차 비밀번호 미설정: 설정 화면
  if (!hasPin) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mb-6">
          <Shield className="w-8 h-8 text-brand-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">보안 폴더</h1>
        <p className="text-sm text-gray-500 mb-8">2차 비밀번호를 설정하면 이 폴더에 들어갈 수 있어요</p>
        <form onSubmit={handleSetPin} className="w-full max-w-xs space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">2차 비밀번호 (4~12자)</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="비밀번호 입력"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              autoComplete="new-password"
              maxLength={12}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">비밀번호 확인</label>
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="다시 입력"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              autoComplete="new-password"
              maxLength={12}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {loading ? '설정 중...' : '2차 비밀번호 설정'}
          </button>
        </form>
      </div>
    )
  }

  // 2차 비밀번호 입력 화면
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[50vh]">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
        <Lock className="w-8 h-8 text-gray-500" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">보안 폴더</h1>
      <p className="text-sm text-gray-500 mb-8">2차 비밀번호를 입력하세요</p>
      <form onSubmit={handleVerify} className="w-full max-w-xs space-y-4">
        <div>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="2차 비밀번호"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-center"
            autoComplete="current-password"
            maxLength={12}
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <LockOpen className="w-4 h-4" />
          {loading ? '확인 중...' : '열기'}
        </button>
      </form>
    </div>
  )
}
