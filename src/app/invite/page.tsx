'use client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Cloud, Users } from 'lucide-react'
import { toast } from 'sonner'

function InviteForm() {
  const searchParams = useSearchParams()
  const initialCode = searchParams.get('code') || ''
  const [code, setCode] = useState(initialCode)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function joinGroup() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // 로그인 후 돌아오기
        router.push(`/login?redirect=/invite?code=${code}`)
        return
      }

      const { data: group } = await supabase
        .from('family_groups')
        .select('id, name')
        .eq('invite_code', code.trim())
        .single()

      if (!group) {
        toast.error('올바르지 않은 초대 코드입니다')
        return
      }

      // 이미 구성원인지 확인
      const { data: existing } = await supabase
        .from('family_members')
        .select('id')
        .eq('group_id', group.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existing) {
        toast.info('이미 구성원입니다')
        router.push('/dashboard/family')
        return
      }

      await supabase.from('family_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'member',
      })

      toast.success(`"${group.name}"에 참여했습니다! 🎉`)
      router.push('/dashboard/family')
    } catch (err) {
      toast.error('오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600 rounded-2xl mb-4 shadow-lg">
          <Users className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">가족 초대</h1>
        <p className="text-gray-500 text-sm mb-8">초대 코드를 입력해서 가족에 참여하세요</p>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="초대 코드 입력 (예: a1b2c3d4)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-center text-lg tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button
            onClick={joinGroup}
            disabled={!code.trim() || loading}
            className="w-full py-3 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-800 transition-colors disabled:opacity-60"
          >
            {loading ? '참여 중...' : '가족 그룹 참여하기'}
          </button>
          <button
            onClick={() => router.push('/login')}
            className="w-full py-3 text-gray-500 text-sm hover:text-gray-700 transition-colors"
          >
            로그인 / 회원가입
          </button>
        </div>
      </div>
    </div>
  )
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <InviteForm />
    </Suspense>
  )
}
