'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Users, UserPlus, Crown, CheckCircle, Share2 } from 'lucide-react'
import { toast } from 'sonner'

interface Member {
  id: string
  user_id: string
  role: string
  joined_at: string
  profiles: { name: string; email: string; avatar_url: string | null }
}

interface Group {
  id: string
  name: string
  invite_code: string
  owner_id: string
}

interface SharedItem {
  id: string
  name?: string
  title?: string
  file_type?: string
  created_at: string
  type: 'file' | 'note'
}

export default function FamilyPage() {
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [sharedItems, setSharedItems] = useState<SharedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [groupName, setGroupName] = useState('')
  const supabase = createClient()

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    // 내가 속한 그룹 찾기
    const { data: memberRow } = await supabase
      .from('family_members')
      .select('group_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (memberRow?.group_id) {
      // 그룹 정보
      const { data: grp } = await supabase
        .from('family_groups')
        .select('*')
        .eq('id', memberRow.group_id)
        .single()
      setGroup(grp)
      setGroupName(grp?.name || '')

      // 멤버 목록
      const { data: mems } = await supabase
        .from('family_members')
        .select('*, profiles(name, email, avatar_url)')
        .eq('group_id', memberRow.group_id)
      setMembers((mems as Member[]) || [])

      // 공유된 파일
      const { data: sFiles } = await supabase
        .from('files')
        .select('id, name, file_type, created_at')
        .eq('is_shared', true)
        .limit(10)
      const { data: sNotes } = await supabase
        .from('notes')
        .select('id, title, created_at')
        .eq('is_shared', true)
        .limit(10)
      setSharedItems([
        ...(sFiles || []).map((f) => ({ ...f, type: 'file' as const })),
        ...(sNotes || []).map((n) => ({ ...n, type: 'note' as const })),
      ])
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function createGroup() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: grp } = await supabase
      .from('family_groups')
      .insert({ name: '우리 그룹', owner_id: user.id })
      .select()
      .single()
    if (grp) {
      await supabase.from('family_members').insert({
        group_id: grp.id,
        user_id: user.id,
        role: 'owner',
      })
      toast.success('그룹이 생성되었습니다!')
      fetchData()
    }
  }

  async function updateGroupName() {
    if (!group) return
    await supabase.from('family_groups').update({ name: groupName }).eq('id', group.id)
    toast.success('그룹 이름이 변경되었습니다')
    fetchData()
  }

  function getInitials(name: string) {
    return name?.slice(0, 1) || '?'
  }

  const avatarColors = ['bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-pink-100 text-pink-700', 'bg-purple-100 text-purple-700']

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-32 bg-gray-100 rounded-2xl animate-pulse mb-4" />
        <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-brand-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">그룹 없음</h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          그룹을 만들고 초대 코드로 멤버를 초대하세요
        </p>
        <button
          onClick={createGroup}
          className="flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-800 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          멤버 그룹 만들기
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">그룹 관리</h1>
        <p className="text-sm text-gray-500 mt-0.5">그룹을 초대하고 함께 공유하세요</p>
      </div>

      {/* 그룹 이름 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">그룹 이름</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button
            onClick={updateGroupName}
            className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-800 transition-colors"
          >
            저장
          </button>
        </div>
      </div>

      {/* 구성원 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          구성원 ({members.length}명)
        </h2>
        <div className="space-y-2">
          {members.map((member, idx) => (
            <div key={member.id} className="flex items-center gap-3 py-2 flex-wrap">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarColors[idx % avatarColors.length]}`}>
                {getInitials(member.profiles?.name || member.profiles?.email || '?')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">
                  {member.profiles?.name || '이름 없음'}
                  {member.user_id === currentUserId && (
                    <span className="ml-1.5 text-xs text-gray-400">(나)</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 truncate">{member.profiles?.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {member.role === 'owner' ? (
                  <div className="flex items-center gap-1 px-2 py-1 bg-yellow-50 rounded-lg">
                    <Crown className="w-3 h-3 text-yellow-600" />
                    <span className="text-xs text-yellow-700 font-medium">관리자</span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">구성원</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 공유된 항목 */}
      {sharedItems.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            그룹 공유 항목 ({sharedItems.length}개)
          </h2>
          <div className="space-y-2">
            {sharedItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-7 h-7 bg-brand-50 rounded-lg flex items-center justify-center text-xs">
                  {item.type === 'note' ? '📝' : item.file_type === 'photo' ? '🖼️' : item.file_type === 'video' ? '🎬' : '📁'}
                </div>
                <p className="text-sm text-gray-700 flex-1 truncate">
                  {item.name || item.title || '제목 없음'}
                </p>
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
