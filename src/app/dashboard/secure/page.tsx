'use client'

import { useState, useEffect, useCallback } from 'react'
import { Lock, LockOpen, Shield, FolderLock, Upload, FileText, StickyNote, Trash2, Download, Plus, Pin, X, Save } from 'lucide-react'
import { createClient, getFileUrl, formatFileSize } from '@/lib/supabase'
import UploadZone from '@/components/features/UploadZone'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { toast } from 'sonner'

const SECURE_UNLOCK_KEY = 'secureFolderUnlocked'

const NOTE_COLORS: Record<string, { bg: string; border: string }> = {
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200' },
  green: { bg: 'bg-green-50', border: 'border-green-200' },
  pink: { bg: 'bg-pink-50', border: 'border-pink-200' },
}

interface SecureFile {
  id: string
  name: string
  storage_path: string
  size_bytes: number
  mime_type: string
  created_at: string
  file_type?: string
}

interface SecureNote {
  id: string
  title: string
  content: string
  color: string
  pinned: boolean
  updated_at: string
}

export default function SecureFolderPage() {
  const [hasPin, setHasPin] = useState<boolean | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'files' | 'notes'>('files')
  const [secureFiles, setSecureFiles] = useState<SecureFile[]>([])
  const [secureNotes, setSecureNotes] = useState<SecureNote[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [notesLoading, setNotesLoading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadType, setUploadType] = useState<'file' | 'video'>('file')
  const [editingNote, setEditingNote] = useState<SecureNote | null>(null)
  const [isNewNote, setIsNewNote] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetch('/api/secure/status')
      .then((r) => r.ok ? r.json() : { hasPin: false })
      .then((data) => setHasPin(Boolean(data?.hasPin)))
      .catch(() => setHasPin(false))
  }, [])

  // 다른 메뉴로 갔다 오면 자동 잠금: 페이지를 떠날 때 잠금 해제 상태 제거
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') sessionStorage.removeItem(SECURE_UNLOCK_KEY)
    }
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
      setUnlocked(true)
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  function handleLock() {
    setUnlocked(false)
    setPin('')
    setConfirmPin('')
    toast.success('보안 폴더가 잠겼어요')
  }

  const fetchSecureFiles = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setFilesLoading(true)
    const { data } = await supabase
      .from('files')
      .select('id, name, storage_path, size_bytes, mime_type, created_at, file_type')
      .eq('owner_id', user.id)
      .eq('is_secure', true)
      .order('created_at', { ascending: false })
    setSecureFiles(data || [])
    setFilesLoading(false)
  }, [supabase])

  const fetchSecureNotes = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setNotesLoading(true)
    const { data } = await supabase
      .from('notes')
      .select('id, title, content, color, pinned, updated_at')
      .eq('owner_id', user.id)
      .eq('is_secure', true)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })
    setSecureNotes(data || [])
    setNotesLoading(false)
  }, [supabase])

  useEffect(() => {
    if (unlocked) {
      fetchSecureFiles()
      fetchSecureNotes()
    }
  }, [unlocked, fetchSecureFiles, fetchSecureNotes])

  async function deleteSecureFile(id: string, path: string) {
    await supabase.storage.from('family-files').remove([path])
    await supabase.from('files').delete().eq('id', id)
    toast.success('삭제되었습니다')
    fetchSecureFiles()
  }

  async function saveSecureNote() {
    if (!editingNote) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (isNewNote) {
      await supabase.from('notes').insert({
        owner_id: user.id,
        title: editingNote.title || '제목 없음',
        content: editingNote.content,
        color: editingNote.color,
        pinned: editingNote.pinned,
        is_shared: false,
        group_id: null,
        is_secure: true,
      })
      toast.success('메모가 저장되었습니다')
    } else {
      await supabase.from('notes').update({
        title: editingNote.title || '제목 없음',
        content: editingNote.content,
        color: editingNote.color,
        pinned: editingNote.pinned,
        updated_at: new Date().toISOString(),
      }).eq('id', editingNote.id)
      toast.success('저장되었습니다')
    }
    setEditingNote(null)
    setIsNewNote(false)
    fetchSecureNotes()
  }

  async function deleteSecureNote(id: string) {
    await supabase.from('notes').delete().eq('id', id)
    toast.success('삭제되었습니다')
    setEditingNote(null)
    fetchSecureNotes()
  }

  function getFileIcon(mime: string) {
    if (mime?.includes('pdf')) return '📄'
    if (mime?.includes('word') || mime?.includes('document')) return '📝'
    if (mime?.includes('sheet') || mime?.includes('excel')) return '📊'
    return '📁'
  }

  if (hasPin === null) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // 잠금 해제된 상태: 보안 폴더 내용 (파일 + 메모)
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

        {/* 탭: 파일 / 메모 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('files')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'files' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            <FileText className="w-4 h-4" />
            파일 ({secureFiles.length})
          </button>
          <button
            onClick={() => setTab('notes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'notes' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            <StickyNote className="w-4 h-4" />
            메모 ({secureNotes.length})
          </button>
        </div>

        {tab === 'files' && (
          <>
            <div className="flex justify-end gap-2 mb-3">
              <button
                onClick={() => { setUploadType('file'); setShowUpload(!showUpload) }}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700"
              >
                <Upload className="w-4 h-4" />
                파일 올리기
              </button>
              <button
                onClick={() => { setUploadType('video'); setShowUpload(!showUpload) }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700"
              >
                <Upload className="w-4 h-4" />
                영상 올리기
              </button>
            </div>
            {showUpload && (
              <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-4">
                <UploadZone
                  bucket="family-files"
                  fileType={uploadType}
                  isSecure={true}
                  accept={uploadType === 'video' ? { 'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm'] } : undefined}
                  onUploadComplete={() => { fetchSecureFiles(); setShowUpload(false) }}
                />
              </div>
            )}
            {filesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : secureFiles.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">보안 폴더에 올린 파일이 없어요</p>
                <p className="text-xs text-gray-400 mt-1">위에서 파일 올리기로 추가하세요</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {secureFiles.map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-base flex-shrink-0">
                          {f.file_type === 'video' ? '🎬' : f.file_type === 'photo' ? '🖼️' : getFileIcon(f.mime_type)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 truncate">{f.name}</p>
                          <p className="text-xs text-gray-400">{formatFileSize(f.size_bytes)} · {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ko })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a href={getFileUrl('family-files', f.storage_path)} download={f.name} className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50">
                          <Download className="w-4 h-4" />
                        </a>
                        <button onClick={() => deleteSecureFile(f.id, f.storage_path)} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'notes' && (
          <>
            <div className="flex justify-end mb-3">
              <button
                onClick={() => { setEditingNote({ id: '', title: '', content: '', color: 'yellow', pinned: false, updated_at: '' }); setIsNewNote(true) }}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700"
              >
                <Plus className="w-4 h-4" />
                새 메모
              </button>
            </div>
            {notesLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
              </div>
            ) : secureNotes.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                <StickyNote className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">보안 폴더 메모가 없어요</p>
                <p className="text-xs text-gray-400 mt-1">위에서 새 메모로 추가하세요</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {secureNotes.map((note) => {
                  const c = NOTE_COLORS[note.color] || NOTE_COLORS.yellow
                  return (
                    <div
                      key={note.id}
                      onClick={() => { setEditingNote(note); setIsNewNote(false) }}
                      className={`${c.bg} ${c.border} border rounded-2xl p-4 cursor-pointer hover:shadow-sm transition-shadow relative`}
                    >
                      {note.pinned && <Pin className="w-3 h-3 text-gray-500 absolute top-3 right-3" />}
                      <p className="font-semibold text-gray-800 text-sm mb-1.5 line-clamp-1">{note.title || '제목 없음'}</p>
                      <p className="text-sm text-gray-600 line-clamp-4 whitespace-pre-wrap">{note.content || <span className="text-gray-400">내용 없음</span>}</p>
                      <p className="text-xs text-gray-400 mt-2">{formatDistanceToNow(new Date(note.updated_at), { addSuffix: true, locale: ko })}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* 메모 편집 모달 */}
        {editingNote && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setEditingNote(null); setIsNewNote(false) }}>
            <div className={`${NOTE_COLORS[editingNote.color]?.bg || 'bg-yellow-50'} rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden`} onClick={(e) => e.stopPropagation()}>
              <div className="flex gap-2 px-4 pt-4">
                {Object.entries(NOTE_COLORS).map(([key, val]) => (
                  <button key={key} onClick={() => setEditingNote({ ...editingNote, color: key })} className={`w-6 h-6 rounded-full ${val.bg} ${val.border} border-2 ${editingNote.color === key ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`} />
                ))}
                <div className="flex-1" />
                {!isNewNote && (
                  <button onClick={() => setEditingNote({ ...editingNote, pinned: !editingNote.pinned })} className="p-1.5 rounded-lg hover:bg-black/10">
                    <Pin className={`w-4 h-4 ${editingNote.pinned ? 'text-gray-700' : 'text-gray-400'}`} />
                  </button>
                )}
              </div>
              <div className="p-4 space-y-2">
                <input type="text" placeholder="제목" value={editingNote.title} onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })} className="w-full bg-transparent text-lg font-semibold text-gray-800 placeholder-gray-400 outline-none" />
                <textarea placeholder="메모 내용..." value={editingNote.content} onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })} rows={8} className="w-full bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none resize-none" autoFocus />
              </div>
              <div className="flex items-center justify-between px-4 pb-4 gap-2">
                {!isNewNote && (
                  <button onClick={() => deleteSecureNote(editingNote.id)} className="flex items-center gap-1.5 px-3 py-2 text-red-500 hover:bg-red-100 rounded-xl text-sm">
                    <Trash2 className="w-3.5 h-3.5" /> 삭제
                  </button>
                )}
                <div className="flex-1" />
                <button onClick={() => { setEditingNote(null); setIsNewNote(false) }} className="flex items-center gap-1.5 px-3 py-2 text-gray-500 hover:bg-black/10 rounded-xl text-sm">
                  <X className="w-3.5 h-3.5" /> 취소
                </button>
                <button onClick={saveSecureNote} className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-900">
                  <Save className="w-3.5 h-3.5" /> 저장
                </button>
              </div>
            </div>
          </div>
        )}
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
