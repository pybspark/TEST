'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Users, UserPlus, Crown, CheckCircle, Share2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const ADMIN_EMAIL = 'pybspark@gmail.com'

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
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [sharedItems, setSharedItems] = useState<SharedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [groupName, setGroupName] = useState('')
  const [deleteConfirmGroupId, setDeleteConfirmGroupId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function fetchData(overrideGroupId?: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (user.email !== ADMIN_EMAIL) {
      router.replace('/dashboard')
      return
    }
    setCurrentUserId(user.id)

    // 내가 속한 모든 그룹 찾기
    const { data: memberRows } = await supabase
      .from('family_members')
      .select('group_id')
      .eq('user_id', user.id)

    const groupIds = [...new Set((memberRows || []).map((r) => r.group_id).filter(Boolean))]
    if (groupIds.length === 0) {
      setGroups([])
      setSelectedGroupId(null)
      setGroup(null)
      setMembers([])
      setSharedItems([])
      setLoading(false)
      return
    }

    const { data: grpList } = await supabase
      .from('family_groups')
      .select('*')
      .in('id', groupIds)
      .order('created_at', { ascending: false })
    setGroups(grpList || [])

    const currentId = overrideGroupId && groupIds.includes(overrideGroupId)
      ? overrideGroupId
      : selectedGroupId && groupIds.includes(selectedGroupId)
        ? selectedGroupId
        : groupIds[0]
    setSelectedGroupId(currentId)

    const { data: grp } = await supabase.from('family_groups').select('*').eq('id', currentId).single()
    setGroup(grp)
    setGroupName(grp?.name || '')

    const { data: mems } = await supabase
      .from('family_members')
      .select('*, profiles(name, email, avatar_url)')
      .eq('group_id', currentId)
    setMembers((mems as Member[]) || [])

    const { data: sFiles } = await supabase
      .from('files')
      .select('id, name, file_type, created_at')
      .eq('is_shared', true)
      .or(`group_id.eq.${currentId},group_id.is.null`)
      .limit(10)
    const { data: sNotes } = await supabase
      .from('notes')
      .select('id, title, created_at')
      .eq('is_shared', true)
      .or(`group_id.eq.${currentId},group_id.is.null`)
      .limit(10)
    setSharedItems([
      ...(sFiles || []).map((f) => ({ ...f, type: 'file' as const })),
      ...(sNotes || []).map((n) => ({ ...n, type: 'note' as const })),
    ])
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
      setSelectedGroupId(grp.id)
      fetchData()
    }
  }

  async function updateGroupName() {
    if (!group) return
    await supabase.from('family_groups').update({ name: groupName }).eq('id', group.id)
    toast.success('그룹 이름이 변경되었습니다')
    fetchData()
  }

  async function deleteGroup(groupId: string) {
    setDeleteLoading(true)
    try {
      const res = await fetch('/api/group/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || '삭제 실패')
        return
      }
      toast.success('그룹이 삭제되었습니다')
      setDeleteConfirmGroupId(null)
      setSelectedGroupId(null)
      fetchData()
    } finally {
      setDeleteLoading(false)
    }
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

  if (groups.length === 0) {
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">그룹 관리</h1>
        <div className="flex items-center gap-2">
          <select
            value={selectedGroupId || ''}
            onChange={(e) => {
              const id = e.target.value || null
              setSelectedGroupId(id)
              if (id) fetchData(id)
            }}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <button
            onClick={createGroup}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-600 bg-brand-50 rounded-xl hover:bg-brand-100 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            새 그룹
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 -mt-2">그룹을 선택하거나 새로 만드세요</p>

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
        {group?.owner_id === currentUserId && (
          <button
            type="button"
            onClick={() => setDeleteConfirmGroupId(group.id)}
            className="mt-3 flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-3.5 h-3.5" />
            이 그룹 삭제
          </button>
        )}
      </div>

      {/* 그룹 삭제 확인 모달 */}
      {deleteConfirmGroupId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !deleteLoading && setDeleteConfirmGroupId(null)}>
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-red-600">그룹 삭제</h3>
            <p className="text-xs text-gray-500">
              이 그룹을 삭제하면 모든 구성원이 그룹에서 나가며, 그룹만 삭제됩니다. 파일·메모는 그대로 있고, 해당 그룹 공유만 해제됩니다. 삭제 후에는 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => !deleteLoading && setDeleteConfirmGroupId(null)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => deleteGroup(deleteConfirmGroupId)}
                disabled={deleteLoading}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? '처리 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

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
