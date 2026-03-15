'use client'

import { useState } from 'react'
import { KeyRound, UserMinus } from 'lucide-react'
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
  const [removeTarget, setRemoveTarget] = useState<Profile | null>(null)
  const [removeLoading, setRemoveLoading] = useState(false)

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

  async function submitRemoveFromGroups() {
    if (!removeTarget) return
    const userIdToRemove = removeTarget.id
    setRemoveLoading(true)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      const res = await fetch('/api/admin/remove-from-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userIdToRemove }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || '제거 실패')
        setRemoveTarget(null)
        return
      }
      toast.success('그룹에서 제거되었습니다. 같은 아이디로 초대 코드로 재가입할 수 있습니다.')
      setRemoveTarget(null)
      window.location.reload()
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError'
      toast.error(isAbort ? '요청 시간이 초과되었습니다. 다시 시도해 주세요.' : '네트워크 오류가 발생했습니다. 다시 시도해 주세요.')
      setRemoveTarget(null)
    } finally {
      setRemoveLoading(false)
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
              <div className="flex gap-2 text-xs text-gray-400 items-center flex-wrap">
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
                {profile.email !== ADMIN_EMAIL && (
                  <button
                    type="button"
                    onClick={() => setRemoveTarget(profile)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 border border-red-200"
                    title="그룹에서만 제거 (계정 유지, 초대로 재가입 가능)"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                    그룹에서 제거
                  </button>
                )}
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

      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !removeLoading && setRemoveTarget(null)}>
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-800">그룹에서 제거</h3>
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">{removeTarget.name || removeTarget.email}</span> 님을 그룹에서만 제거합니다. 계정은 삭제되지 않으며, 같은 아이디로 초대 코드를 통해 언제든 다시 참여할 수 있습니다.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => !removeLoading && setRemoveTarget(null)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitRemoveFromGroups}
                disabled={removeLoading}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50"
              >
                {removeLoading ? '처리 중…' : '제거'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
