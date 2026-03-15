'use client'

import { useState } from 'react'
import { Copy, Share2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface AdminInviteCodeProps {
  initialInviteCode: string | null
}

export default function AdminInviteCode({ initialInviteCode }: AdminInviteCodeProps) {
  const [inviteCode, setInviteCode] = useState<string | null>(initialInviteCode)
  const [loading, setLoading] = useState(false)

  async function regenerateCode() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/regenerate-invite-code', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || '코드 생성 실패')
        return
      }
      setInviteCode(data.inviteCode ?? null)
      toast.success('새 초대 코드가 생성되었습니다')
    } catch {
      toast.error('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  function copyCode() {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode)
    toast.success('초대 코드가 복사되었습니다!')
  }

  function copyLink() {
    if (!inviteCode) return
    const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/invite?code=${inviteCode}`
    navigator.clipboard.writeText(link)
    toast.success('초대 링크가 복사되었습니다!')
  }

  if (inviteCode === null && !loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">초대 코드</h2>
        <p className="text-xs text-gray-500 mb-3">그룹이 있지만 아직 초대 코드가 없습니다. 아래 버튼으로 생성하세요.</p>
        <button
          type="button"
          onClick={regenerateCode}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '생성 중…' : '초대 코드 생성'}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-8">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">초대 코드</h2>
      <p className="text-xs text-gray-500 mb-3">버튼을 누르기 전까지 이 코드가 유효합니다. 새 코드 생성 시 이전 코드는 사용할 수 없습니다.</p>
      <div className="bg-gray-50 rounded-xl p-4 text-center mb-3">
        <p className="text-xs text-gray-500 mb-1">현재 초대 코드</p>
        <p className="text-3xl font-bold tracking-[0.3em] text-gray-900 font-mono">{inviteCode || '…'}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyCode}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200"
        >
          <Copy className="w-4 h-4" />
          코드 복사
        </button>
        <button
          type="button"
          onClick={copyLink}
          className="flex items-center gap-2 px-3 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-800"
        >
          <Share2 className="w-4 h-4" />
          링크 공유
        </button>
        <button
          type="button"
          onClick={regenerateCode}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-800 rounded-xl text-sm font-medium hover:bg-amber-200 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '생성 중…' : '새 코드 생성'}
        </button>
      </div>
    </div>
  )
}
