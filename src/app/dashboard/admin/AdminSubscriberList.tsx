'use client'

import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'

type Profile = { id: string; name: string | null; email: string | null }
type FileRow = { owner_id: string }
type NoteRow = { owner_id: string }

interface AdminSubscriberListProps {
  profiles: Profile[]
  allFiles: FileRow[]
  allNotes: NoteRow[]
}

export default function AdminSubscriberList({ profiles, allFiles, allNotes }: AdminSubscriberListProps) {
  const [resetTarget, setResetTarget] = useState<Profile | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const avatarColors = ['bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-pink-100 text-pink-700', 'bg-purple-100 text-purple-700']
  const ADMIN_EMAIL = 'pybspark@gmail.com'

  async function submitReset() {
    if (!resetTarget) return
    if (newPassword.length < 6) {
      toast.error('비밀번호는 6자 이상 입력해 주세요')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('비밀번호가 일치하지 않습니다')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/reset-member-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resetTarget.id, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '재설정 실패')
        return
      }
      toast.success('비밀번호가 재설정되었습니다')
      setResetTarget(null)
      setNewPassword('')
      setConfirmPassword('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-8">
        {profiles.map((profile, idx) => {
          const userFiles = allFiles.filter(f => f.owner_id === profile.id)
          const userNotes = allNotes.filter(n => n.owner_id === profile.id)
          return (
            <div key={profile.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarColors[idx % 4]}`}>
                {(profile.name || profile.email || '?').slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">
                  {profile.name || '이름 없음'}
                  {profile.email === ADMIN_EMAIL && (
                    <span className="ml-1.5 text-xs bg-red-50 text-red-500 px-1.5 py-0.5 rounded-md">관리자</span>
                  )}
                </p>
                <p className="text-xs text-gray-400">{profile.email}</p>
              </div>
              <div className="flex gap-3 text-xs text-gray-400 items-center">
                <span>📁 {userFiles.length}개</span>
                <span>📝 {userNotes.length}개</span>
                <button
                  type="button"
                  onClick={() => setResetTarget(profile)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-brand-700 bg-brand-50 rounded-lg hover:bg-brand-100 border border-brand-200"
                  title="비밀번호 재설정"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  비밀번호 재설정
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !loading && setResetTarget(null)}>
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-800">비밀번호 재설정</h3>
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">{resetTarget.name || resetTarget.email}</span> 님의 새 비밀번호를 입력하세요.
            </p>
            <input
              type="password"
              placeholder="새 비밀번호 (6자 이상)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              autoComplete="new-password"
            />
            <input
              type="password"
              placeholder="비밀번호 확인"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              autoComplete="new-password"
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => !loading && setResetTarget(null)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitReset}
                disabled={loading}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-800 disabled:opacity-50"
              >
                {loading ? '처리 중…' : '재설정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
