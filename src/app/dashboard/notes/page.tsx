'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, Trash2, Share2, Pin, X, Save } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { toast } from 'sonner'

interface Note {
  id: string
  title: string
  content: string
  color: string
  pinned: boolean
  is_shared: boolean
  updated_at: string
}

const COLORS: Record<string, { bg: string; border: string; label: string }> = {
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', label: '노란색' },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   label: '파란색' },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  label: '초록색' },
  pink:   { bg: 'bg-pink-50',   border: 'border-pink-200',   label: '분홍색' },
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Note | null>(null)
  const [isNew, setIsNew] = useState(false)
  const supabase = createClient()

  async function fetchNotes() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('owner_id', user.id)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })
    setNotes(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchNotes() }, [])

  async function createNote() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const newNote: Note = {
      id: '',
      title: '',
      content: '',
      color: 'yellow',
      pinned: false,
      is_shared: false,
      updated_at: new Date().toISOString(),
    }
    setEditing(newNote)
    setIsNew(true)
  }

  async function saveNote() {
    if (!editing) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (isNew) {
      const { data } = await supabase.from('notes').insert({
        owner_id: user.id,
        title: editing.title || '제목 없음',
        content: editing.content,
        color: editing.color,
        pinned: editing.pinned,
        is_shared: editing.is_shared,
      }).select().single()
      if (data) toast.success('메모가 저장되었습니다')
    } else {
      await supabase.from('notes').update({
        title: editing.title || '제목 없음',
        content: editing.content,
        color: editing.color,
        pinned: editing.pinned,
        is_shared: editing.is_shared,
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id)
      toast.success('저장되었습니다')
    }
    setEditing(null)
    setIsNew(false)
    fetchNotes()
  }

  async function deleteNote(id: string) {
    await supabase.from('notes').delete().eq('id', id)
    toast.success('삭제되었습니다')
    fetchNotes()
  }

  async function togglePin(id: string, current: boolean) {
    await supabase.from('notes').update({ pinned: !current }).eq('id', id)
    fetchNotes()
  }

  async function toggleShare(id: string, current: boolean) {
    await supabase.from('notes').update({ is_shared: !current }).eq('id', id)
    toast.success(current ? '공유 해제됨' : '가족과 공유됨')
    fetchNotes()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">메모</h1>
          <p className="text-sm text-gray-500 mt-0.5">{notes.length}개의 메모</p>
        </div>
        <button
          onClick={createNote}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          새 메모
        </button>
      </div>

      {loading ? (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse break-inside-avoid" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-sm text-gray-400">메모를 작성해보세요</p>
        </div>
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
          {notes.map((note) => {
            const c = COLORS[note.color] || COLORS.yellow
            return (
              <div
                key={note.id}
                onClick={() => { setEditing(note); setIsNew(false) }}
                className={`${c.bg} ${c.border} border rounded-2xl p-4 mb-4 break-inside-avoid cursor-pointer hover:shadow-sm transition-shadow relative group`}
              >
                {note.pinned && <Pin className="w-3 h-3 text-gray-500 absolute top-3 right-3" />}
                {note.title && (
                  <p className="font-semibold text-gray-800 text-sm mb-1.5 line-clamp-1">{note.title}</p>
                )}
                <p className="text-sm text-gray-600 line-clamp-5 whitespace-pre-wrap leading-relaxed">
                  {note.content || <span className="text-gray-400">내용 없음</span>}
                </p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/5">
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true, locale: ko })}
                  </span>
                  {note.is_shared && <Share2 className="w-3 h-3 text-brand-500" />}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 메모 편집 모달 */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => { setEditing(null); setIsNew(false) }}
        >
          <div
            className={`${COLORS[editing.color]?.bg || 'bg-yellow-50'} rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 색상 선택 */}
            <div className="flex items-center gap-2 px-4 pt-4">
              {Object.entries(COLORS).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setEditing({ ...editing, color: key })}
                  className={`w-6 h-6 rounded-full ${val.bg} ${val.border} border-2 transition-transform ${editing.color === key ? 'scale-125' : ''}`}
                />
              ))}
              <div className="flex-1" />
              <button
                onClick={() => togglePin(editing.id, editing.pinned)}
                className={`p-1.5 rounded-lg transition-colors ${editing.pinned ? 'text-gray-700 bg-black/10' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Pin className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEditing({ ...editing, is_shared: !editing.is_shared })}
                className={`p-1.5 rounded-lg transition-colors ${editing.is_shared ? 'text-brand-600 bg-brand-100' : 'text-gray-400 hover:text-brand-600'}`}
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-2">
              <input
                type="text"
                placeholder="제목"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="w-full bg-transparent text-lg font-semibold text-gray-800 placeholder-gray-400 outline-none"
              />
              <textarea
                placeholder="메모 내용을 입력하세요..."
                value={editing.content}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                rows={8}
                className="w-full bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none resize-none leading-relaxed"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between px-4 pb-4 gap-2">
              {!isNew && (
                <button
                  onClick={() => { deleteNote(editing.id); setEditing(null) }}
                  className="flex items-center gap-1.5 px-3 py-2 text-red-500 hover:bg-red-100 rounded-xl text-sm transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  삭제
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={() => { setEditing(null); setIsNew(false) }}
                className="flex items-center gap-1.5 px-3 py-2 text-gray-500 hover:bg-black/10 rounded-xl text-sm transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                취소
              </button>
              <button
                onClick={saveNote}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
