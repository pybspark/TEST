'use client'

import { useState } from 'react'
import { Copy, Share2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface AdminInviteCodeProps {
  /** 마지막 생성한 코드 (표시용, 새로 생성하면 이걸로 덮어씀) */
  initialInviteCode?: string | null
}

export default function AdminInviteCode({ initialInviteCode = null }: AdminInviteCodeProps) {
  const [inviteCode, setInviteCode] = useState<string | null>(initialInviteCode ?? null)
  const [loading, setLoading] = useState(false)

  async function generateCode() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/invite-code/generate', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || '코드 생성 실패')
        return
      }
      setInviteCode(data.inviteCode ?? null)
      toast.success('새 초대 코드가 생성되었습니다. 이 코드로 가입한 뒤, 여기서 그룹을 배정하세요.')
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
    const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/login`
    navigator.clipboard.writeText(link)
    toast.success('로그인 페이지 링크가 복사되었습니다. 초대 코드는 별도로 전달하세요.')
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-8">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">초대 코드 (가입용)</h2>
      <p className="text-xs text-gray-500 mb-3">
        랜덤 초대 코드를 발급합니다. 이 코드로 회원가입한 사람은 그룹에 자동으로 들어가지 않습니다. 아래 가입자 목록에서 그룹을 배정해 주세요.
      </p>
      {inviteCode ? (
        <>
          <div className="bg-gray-50 rounded-xl p-4 text-center mb-3">
            <p className="text-xs text-gray-500 mb-1">발급된 초대 코드 (1회 사용)</p>
            <p className="text-3xl font-bold tracking-[0.3em] text-gray-900 font-mono">{inviteCode}</p>
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
              로그인 링크 복사
            </button>
            <button
              type="button"
              onClick={generateCode}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-800 rounded-xl text-sm font-medium hover:bg-amber-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? '생성 중…' : '새 코드 발급'}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={generateCode}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '생성 중…' : '초대 코드 발급'}
        </button>
      )}
    </div>
  )
}
