'use client'

import { useState, useEffect, useCallback } from 'react'
import { Lock, LockOpen, Shield, FolderLock, Upload, FileText, StickyNote, Trash2, Download, Plus, Pin, X, Save, Image, Video, FolderPlus, FolderOpen, ChevronRight, Pencil } from 'lucide-react'
import { createClient, getSignedFileUrl, formatFileSize } from '@/lib/supabase'
import { useSignedFileUrl } from '@/hooks/useSignedFileUrl'
import UploadZone from '@/components/features/UploadZone'
import DocumentThumbnail from '@/components/features/DocumentThumbnail'
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
  folder_id?: string | null
  photo_folder_id?: string | null
  memo?: string | null
  memo_updated_at?: string | null
}

interface SecureFolder {
  id: string
  name: string
  created_at: string
}

interface SecurePhotoFolder {
  id: string
  name: string
  created_at: string
}

interface SecureNote {
  id: string
  title: string
  content: string
  color: string
  pinned: boolean
  updated_at: string
}

/** 서명 URL로 파일 받아서 브라우저 다운로드만 트리거 (새 탭 안 열림) */
async function triggerDownload(path: string, fileName: string) {
  const url = await getSignedFileUrl('family-files', path, 60)
  if (!url) return
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = fileName
    a.click()
    URL.revokeObjectURL(objectUrl)
  } catch {
    // ignore
  }
}

/** 보안 폴더용: 카드 클릭 시 확대 모달, 드래그·드롭다운으로 폴더 이동 */
function SecurePhotoCard({
  f,
  photoFolders,
  onSelect,
  onDownload,
  onDelete,
  onMoveToFolder,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  f: SecureFile
  photoFolders: SecurePhotoFolder[]
  onSelect: (f: SecureFile) => void
  onDownload: (path: string, name: string) => void
  onDelete: (id: string, path: string) => void
  onMoveToFolder: (photoId: string, folderId: string | null) => void
  isDragging?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
}) {
  const { url, loading } = useSignedFileUrl('family-files', f.storage_path, 300)
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col cursor-pointer ${isDragging ? 'opacity-50' : ''}`}
      onClick={() => onSelect(f)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-secure-photo-id', f.id)
        e.dataTransfer.setData('text/plain', f.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.()
      }}
      onDragEnd={() => onDragEnd?.()}
    >
      <div className="aspect-square min-h-[140px] bg-gray-50 flex items-center justify-center relative group">
        {loading ? <div className="w-full h-full bg-gray-100 animate-pulse" /> : url ? <img src={url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" /> : <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">로드 실패</div>}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-end gap-1 p-3 opacity-0 group-hover:opacity-100 pointer-events-none">
          <span className="pointer-events-auto flex gap-1 flex-wrap">
            <select
              className="text-xs rounded-lg border border-gray-200 bg-white/95 px-2 py-1 text-gray-600"
              value=""
              onChange={(e) => { e.stopPropagation(); const v = e.target.value; onMoveToFolder(f.id, v || null); e.target.value = '' }}
              onClick={(e) => e.stopPropagation()}
              title="폴더로 이동"
            >
              <option value="">이동...</option>
              <option value="">📁 폴더 없음</option>
              {photoFolders.map((fd) => <option key={fd.id} value={fd.id}>📁 {fd.name}</option>)}
            </select>
            <button type="button" onClick={(e) => { e.stopPropagation(); onDownload(f.storage_path, f.name) }} className="p-2 rounded-lg bg-white/90 text-gray-700 hover:bg-white shadow"><Download className="w-4 h-4" /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(f.id, f.storage_path) }} className="p-2 rounded-lg bg-white/90 text-red-500 hover:bg-white shadow"><Trash2 className="w-4 h-4" /></button>
          </span>
        </div>
      </div>
      <div className="px-4 py-3 min-w-0 border-t border-gray-50">
        <p className="text-sm text-gray-700 truncate font-normal tracking-tight" title={f.name}>{f.name}</p>
        <p className="text-xs text-gray-400 mt-1">{formatFileSize(f.size_bytes)} · {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ko })}</p>
      </div>
    </div>
  )
}

/** 보안 폴더용: 카드 클릭 시 확대 모달, 다운로드는 항상 파일로 저장 */
function SecureVideoCard({ f, onSelect, onDownload, onDelete }: { f: SecureFile; onSelect: (f: SecureFile) => void; onDownload: (path: string, name: string) => void; onDelete: (id: string, path: string) => void }) {
  const { url, loading } = useSignedFileUrl('family-files', f.storage_path, 300)
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col cursor-pointer"
      onClick={() => onSelect(f)}
    >
      <div className="aspect-video min-h-[120px] bg-gray-900 flex items-center justify-center relative group">
        {loading ? <div className="w-full h-full bg-gray-800 animate-pulse" /> : url ? <video src={url} preload="metadata" className="w-full h-full object-cover" muted playsInline /> : <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-400 text-sm">로드 실패</div>}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-end gap-1 p-3 opacity-0 group-hover:opacity-100 pointer-events-none">
          <span className="pointer-events-auto flex gap-1">
            <button type="button" onClick={(e) => { e.stopPropagation(); onDownload(f.storage_path, f.name) }} className="p-2 rounded-lg bg-white/90 text-gray-700 hover:bg-white shadow"><Download className="w-4 h-4" /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(f.id, f.storage_path) }} className="p-2 rounded-lg bg-white/90 text-red-500 hover:bg-white shadow"><Trash2 className="w-4 h-4" /></button>
          </span>
        </div>
      </div>
      <div className="px-4 py-3 min-w-0 border-t border-gray-50">
        <p className="text-sm text-gray-700 truncate font-normal tracking-tight" title={f.name}>{f.name}</p>
        <p className="text-xs text-gray-400 mt-1">{formatFileSize(f.size_bytes)} · {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ko })}</p>
      </div>
    </div>
  )
}

/** 보안 폴더용: 다운로드만 (항상 파일로 저장, 새 탭 안 열림) */
function SecureDownloadLink({ path, fileName, className, children }: { path: string; fileName: string; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={() => triggerDownload(path, fileName)} className={className}>
      {children}
    </button>
  )
}

/** 보안 폴더 사진 확대 모달 */
function SecurePhotoModal({ file, onClose, onDownload, onDelete, onRename }: { file: SecureFile; onClose: () => void; onDownload: (path: string, name: string) => void; onDelete: (id: string, path: string) => void; onRename: (id: string, name: string) => void }) {
  const { url, loading } = useSignedFileUrl('family-files', file.storage_path, 300)
  const [editingName, setEditingName] = useState(false)
  const [editValue, setEditValue] = useState(file.name)
  useEffect(() => { setEditValue(file.name) }, [file.name])
  const saveRename = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== file.name) onRename(file.id, trimmed)
    setEditingName(false)
  }
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex-1 min-h-[40vh] flex items-center justify-center bg-gray-50 overflow-hidden">
          {loading ? <div className="w-full h-64 bg-gray-100 animate-pulse" /> : url ? <img src={url} alt="" className="max-w-full max-h-[70vh] w-auto h-auto object-contain" /> : <div className="text-gray-400 py-12">로드 실패</div>}
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-2 flex-wrap">
          <div className="w-full flex items-center gap-2">
            {editingName ? (
              <>
                <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveRename()} className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm" autoFocus />
                <button type="button" onClick={saveRename} className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm">저장</button>
                <button type="button" onClick={() => { setEditingName(false); setEditValue(file.name) }} className="px-3 py-1.5 text-gray-500 rounded-lg text-sm">취소</button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-800 truncate flex-1">{file.name}</p>
                <button type="button" onClick={() => { setEditValue(file.name); setEditingName(true) }} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100" title="이름 변경"><Pencil className="w-4 h-4" /></button>
              </>
            )}
          </div>
          <button type="button" onClick={() => onDownload(file.storage_path, file.name)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200">
            <Download className="w-4 h-4" /> 다운로드
          </button>
          <button onClick={() => onDelete(file.id, file.storage_path)} className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-500 rounded-xl text-sm font-medium hover:bg-red-100">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="flex items-center justify-center p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

/** 보안 폴더 동영상 확대 모달 */
function SecureVideoModal({ file, onClose, onDownload, onDelete, onRename }: { file: SecureFile; onClose: () => void; onDownload: (path: string, name: string) => void; onDelete: (id: string, path: string) => void; onRename: (id: string, name: string) => void }) {
  const { url, loading } = useSignedFileUrl('family-files', file.storage_path, 300)
  const [editingName, setEditingName] = useState(false)
  const [editValue, setEditValue] = useState(file.name)
  useEffect(() => { setEditValue(file.name) }, [file.name])
  const saveRename = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== file.name) onRename(file.id, trimmed)
    setEditingName(false)
  }
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-black rounded-2xl overflow-hidden max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
        {loading ? <div className="w-full aspect-video bg-gray-800 animate-pulse" /> : url ? <video src={url} controls autoPlay className="w-full max-h-[70vh]" /> : <div className="aspect-video flex items-center justify-center text-gray-400">로드 실패</div>}
        <div className="p-4 flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {editingName ? (
              <>
                <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveRename()} className="flex-1 px-3 py-1.5 border border-gray-600 bg-gray-800 text-white rounded-lg text-sm" autoFocus />
                <button type="button" onClick={saveRename} className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm">저장</button>
                <button type="button" onClick={() => { setEditingName(false); setEditValue(file.name) }} className="px-3 py-1.5 text-gray-400 rounded-lg text-sm">취소</button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-white truncate flex-1">{file.name}</p>
                <button type="button" onClick={() => { setEditValue(file.name); setEditingName(true) }} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-700" title="이름 변경"><Pencil className="w-4 h-4" /></button>
              </>
            )}
          </div>
          <button type="button" onClick={() => onDownload(file.storage_path, file.name)} className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-xl text-sm hover:bg-gray-600">
            <Download className="w-4 h-4" /> 다운로드
          </button>
          <button onClick={() => onDelete(file.id, file.storage_path)} className="flex items-center justify-center gap-2 px-4 py-2 bg-red-900/50 text-red-400 rounded-xl text-sm hover:bg-red-900">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-2 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

/** Word/Excel 등 변환 미리보기 지원 형식 */
function isOfficePreviewType(mime: string): boolean {
  if (!mime) return false
  const lower = mime.toLowerCase()
  return (
    lower.includes('word') ||
    lower.includes('document') ||
    lower.includes('sheet') ||
    lower.includes('excel') ||
    lower.includes('powerpoint') ||
    lower.includes('presentation') ||
    lower === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    lower === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    lower.includes('msword') ||
    lower.includes('ms-excel') ||
    lower.includes('ms-powerpoint') ||
    lower.includes('opendocument')
  )
}

/** 보안 폴더 문서/일반 파일 모달: 뷰어 + 파일명 + 메모 + 타임라인 */
function SecureFileModal({
  file,
  onClose,
  onDownload,
  onDelete,
  onRename,
  onSaveMemo,
}: {
  file: SecureFile
  onClose: () => void
  onDownload: (path: string, name: string) => void
  onDelete: (id: string, path: string) => void
  onRename: (id: string, name: string) => void
  onSaveMemo: (fileId: string, memo: string) => void
}) {
  const { url, loading } = useSignedFileUrl('family-files', file.storage_path, 300)
  const [editingName, setEditingName] = useState(false)
  const [editValue, setEditValue] = useState(file.name)
  const [memoValue, setMemoValue] = useState(file.memo ?? '')
  const [memoSaving, setMemoSaving] = useState(false)
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<'none' | 'unavailable' | 'failed'>('none')

  useEffect(() => { setEditValue(file.name) }, [file.name])
  useEffect(() => { setMemoValue(file.memo ?? '') }, [file.memo])

  const isPdf = file.mime_type === 'application/pdf'
  const isOffice = isOfficePreviewType(file.mime_type)

  useEffect(() => {
    if (!isOffice || !file.storage_path) {
      setPreviewPdfUrl(null)
      setPreviewError('none')
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError('none')
    setPreviewPdfUrl(null)
    fetch('/api/preview-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath: file.storage_path }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, status: r.status, data: d })))
      .then(({ ok, status, data }) => {
        if (cancelled) return
        setPreviewLoading(false)
        if (ok && data?.url) {
          setPreviewPdfUrl(data.url)
          setPreviewError('none')
        } else if (status === 503 && data?.error === 'CONVERSION_UNAVAILABLE') {
          setPreviewError('unavailable')
        } else {
          setPreviewError('failed')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewLoading(false)
          setPreviewError('failed')
        }
      })
    return () => { cancelled = true }
  }, [file.storage_path, isOffice])

  const saveRename = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== file.name) onRename(file.id, trimmed)
    setEditingName(false)
  }
  const handleSaveMemo = async () => {
    setMemoSaving(true)
    await onSaveMemo(file.id, memoValue)
    setMemoSaving(false)
  }

  const showPdfInIframe = isPdf && url
  const showOfficePdfInIframe = isOffice && previewPdfUrl && !previewLoading
  const showFallback = !showPdfInIframe && !showOfficePdfInIframe && (url || isOffice)

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex-1 min-h-[200px] flex flex-col bg-gray-50 overflow-hidden">
          {loading && !isOffice ? (
            <div className="w-full flex-1 min-h-[40vh] bg-gray-100 animate-pulse" />
          ) : (showPdfInIframe || showOfficePdfInIframe) ? (
            <iframe src={showPdfInIframe ? url! : previewPdfUrl!} title={file.name} className="w-full flex-1 min-h-[50vh] border-0 bg-white" />
          ) : previewLoading && isOffice ? (
            <div className="flex-1 min-h-[40vh] flex flex-col items-center justify-center gap-3 bg-gray-100">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">미리보기 준비 중…</p>
            </div>
          ) : showFallback ? (
            <div className="flex-1 min-h-[40vh] flex flex-col items-center justify-center gap-4 p-6">
              <DocumentThumbnail bucket="family-files" storagePath={file.storage_path} mimeType={file.mime_type} fallback={<FileText className="w-16 h-16 text-gray-400" />} className="max-w-full max-h-[45vh] w-auto h-auto" />
              {previewError === 'unavailable' && <p className="text-xs text-gray-500 text-center">문서 미리보기는 서버 설정 후 이용할 수 있어요</p>}
              {previewError === 'failed' && <p className="text-xs text-amber-600 text-center">미리보기를 불러오지 못했어요</p>}
              <button type="button" onClick={() => url && window.open(url, '_blank')} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
                새 탭에서 열기
              </button>
            </div>
          ) : (
            <div className="flex-1 min-h-[40vh] flex items-center justify-center text-gray-400">로드 실패</div>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {editingName ? (
              <>
                <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveRename()} className="flex-1 min-w-0 px-3 py-1.5 border border-gray-200 rounded-lg text-sm" autoFocus />
                <button type="button" onClick={saveRename} className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm">저장</button>
                <button type="button" onClick={() => { setEditingName(false); setEditValue(file.name) }} className="px-3 py-1.5 text-gray-500 rounded-lg text-sm">취소</button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0">{file.name}</p>
                <button type="button" onClick={() => { setEditValue(file.name); setEditingName(true) }} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100" title="이름 변경"><Pencil className="w-4 h-4" /></button>
              </>
            )}
          </div>
          {/* 타임라인 */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>업로드됨 · {formatDistanceToNow(new Date(file.created_at), { addSuffix: true, locale: ko })}</p>
            {file.memo_updated_at && <p>메모 저장됨 · {formatDistanceToNow(new Date(file.memo_updated_at), { addSuffix: true, locale: ko })}</p>}
          </div>
          {/* 메모 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">메모</label>
            <textarea value={memoValue} onChange={(e) => setMemoValue(e.target.value)} placeholder="이 파일에 대한 메모를 적어보세요" rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent" />
            <button type="button" onClick={handleSaveMemo} disabled={memoSaving} className="mt-2 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50">
              {memoSaving ? '저장 중…' : '메모 저장'}
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => onDownload(file.storage_path, file.name)} className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200">
              <Download className="w-4 h-4" /> 다운로드
            </button>
            <button onClick={() => onDelete(file.id, file.storage_path)} className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-500 rounded-xl text-sm font-medium hover:bg-red-100">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="flex items-center justify-center p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SecureFolderPage() {
  const [hasPin, setHasPin] = useState<boolean | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'files' | 'photos' | 'videos' | 'notes'>('files')
  const [secureFiles, setSecureFiles] = useState<SecureFile[]>([])
  const [secureNotes, setSecureNotes] = useState<SecureNote[]>([])
  const [secureFolders, setSecureFolders] = useState<SecureFolder[]>([])
  const [selectedFileFolderId, setSelectedFileFolderId] = useState<string | null>(null)
  const [securePhotoFolders, setSecurePhotoFolders] = useState<SecurePhotoFolder[]>([])
  const [selectedSecurePhotoFolderId, setSelectedSecurePhotoFolderId] = useState<string | null>(null)
  const [showNewPhotoFolder, setShowNewPhotoFolder] = useState(false)
  const [newPhotoFolderName, setNewPhotoFolderName] = useState('')
  const [editingPhotoFolderId, setEditingPhotoFolderId] = useState<string | null>(null)
  const [editingPhotoFolderName, setEditingPhotoFolderName] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [filesLoading, setFilesLoading] = useState(false)
  const [notesLoading, setNotesLoading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [editingNote, setEditingNote] = useState<SecureNote | null>(null)
  const [isNewNote, setIsNewNote] = useState(false)
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [draggedSecurePhotoId, setDraggedSecurePhotoId] = useState<string | null>(null)
  const [dragOverSecurePhotoFolderId, setDragOverSecurePhotoFolderId] = useState<string | null>(null)
  const [selectedSecurePhoto, setSelectedSecurePhoto] = useState<SecureFile | null>(null)
  const [selectedSecureVideo, setSelectedSecureVideo] = useState<SecureFile | null>(null)
  const [selectedSecureFile, setSelectedSecureFile] = useState<SecureFile | null>(null)
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  const [editingFileName, setEditingFileName] = useState('')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const supabase = createClient()

  const DRAG_FILE_KEY = 'application/x-secure-file-id'

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
    const selectCols = 'id, name, storage_path, size_bytes, mime_type, created_at, file_type, folder_id, photo_folder_id, memo, memo_updated_at'
    const { data, error } = await supabase
      .from('files')
      .select(selectCols)
      .eq('owner_id', user.id)
      .eq('is_secure', true)
      .or('is_deleted.eq.false,is_deleted.is.null')
      .order('created_at', { ascending: false })
    if (error && (error.message?.includes('folder_id') || error.message?.includes('column'))) {
      const { data: dataWithoutFolder } = await supabase
        .from('files')
        .select('id, name, storage_path, size_bytes, mime_type, created_at, file_type')
        .eq('owner_id', user.id)
        .eq('is_secure', true)
        .order('created_at', { ascending: false })
      setSecureFiles((dataWithoutFolder || []).map((f) => ({ ...f, folder_id: null, photo_folder_id: null, memo: null, memo_updated_at: null })))
      if (error.message?.includes('folder_id')) toast.info('폴더 기능을 쓰려면 Supabase에서 add_secure_folders.sql을 실행해주세요.')
    } else if (error) {
      toast.error('파일 목록을 불러오지 못했어요. is_secure 컬럼이 있으면 add_is_secure.sql을 실행해주세요.')
      setSecureFiles([])
    } else {
      setSecureFiles((data || []).map((f) => ({ ...f, photo_folder_id: (f.photo_folder_id ?? null) as string | null })))
    }
    setFilesLoading(false)
  }, [supabase])

  const fetchSecureFolders = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('secure_folders')
      .select('id, name, created_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
    setSecureFolders(data || [])
  }, [supabase])

  const fetchSecurePhotoFolders = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('photo_folders')
      .select('id, name, created_at')
      .eq('owner_id', user.id)
      .eq('is_secure', true)
      .order('created_at', { ascending: true })
    setSecurePhotoFolders(data || [])
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
      fetchSecureFolders()
      fetchSecurePhotoFolders()
    }
  }, [unlocked, fetchSecureFiles, fetchSecureNotes, fetchSecureFolders, fetchSecurePhotoFolders])

  async function deleteSecureFile(id: string, path: string) {
    const now = new Date().toISOString()
    const { error } = await supabase.from('files').update({ is_deleted: true, deleted_at: now }).eq('id', id)
    if (error) {
      if (error.message?.includes('column') || error.message?.includes('is_deleted') || error.message?.includes('deleted_at')) {
        await supabase.storage.from('family-files').remove([path])
        const { error: delErr } = await supabase.from('files').delete().eq('id', id)
        if (delErr) return toast.error('삭제에 실패했어요')
        toast.success('삭제되었습니다')
        fetchSecureFiles()
        return
      }
      return toast.error('삭제에 실패했어요')
    }
    toast.success('휴지통으로 이동했어요')
    fetchSecureFiles()
  }

  async function createSecurePhotoFolder() {
    const name = newPhotoFolderName.trim()
    if (!name) return toast.error('폴더 이름을 입력하세요')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('photo_folders').insert({ owner_id: user.id, name, is_secure: true })
    if (error) return toast.error('폴더를 만들지 못했어요')
    toast.success('폴더가 만들어졌어요')
    setNewPhotoFolderName('')
    setShowNewPhotoFolder(false)
    fetchSecurePhotoFolders()
  }

  async function renameSecurePhotoFolder(folderId: string, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed) return
    const { error } = await supabase.from('photo_folders').update({ name: trimmed }).eq('id', folderId)
    if (error) return toast.error('이름 변경 실패')
    toast.success('이름이 변경되었어요')
    setEditingPhotoFolderId(null)
    fetchSecurePhotoFolders()
  }

  async function deleteSecurePhotoFolder(folderId: string) {
    const res = await fetch('/api/photos/delete-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data?.error || '폴더를 삭제하지 못했어요')
      return
    }
    toast.success('폴더를 삭제했어요. 안의 사진은 폴더 없음으로 옮겨졌어요')
    if (selectedSecurePhotoFolderId === folderId) setSelectedSecurePhotoFolderId(null)
    setSecureFiles((prev) => prev.map((f) => f.photo_folder_id === folderId ? { ...f, photo_folder_id: null } : f))
    fetchSecurePhotoFolders()
  }

  async function moveSecurePhotoToFolder(photoId: string, folderId: string | null) {
    const { error } = await supabase.from('files').update({ photo_folder_id: folderId }).eq('id', photoId)
    if (error) return toast.error('이동 실패')
    toast.success('이동했어요')
    setSecureFiles((prev) => prev.map((f) => (f.id === photoId ? { ...f, photo_folder_id: folderId } : f)))
  }

  async function createFolder() {
    const name = newFolderName.trim()
    if (!name) return toast.error('폴더 이름을 입력하세요')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('secure_folders').insert({ owner_id: user.id, name })
    if (error) {
      toast.error(error.message || '폴더 생성 실패')
      return
    }
    toast.success('폴더가 생성되었어요')
    setNewFolderName('')
    setShowNewFolder(false)
    fetchSecureFolders()
  }

  async function moveFileToFolder(fileId: string, folderId: string | null) {
    const target = secureFiles.find((f) => f.id === fileId)
    if (!target) {
      toast.error('이동 실패: 파일을 찾을 수 없어요')
      return
    }
    const { error } = await supabase.from('files').update({ folder_id: folderId }).eq('storage_path', target.storage_path)
    if (error) {
      toast.error(`이동 실패: ${error.message || '알 수 없는 오류'}`)
      return
    }
    // 로컬 상태도 바로 반영
    setSecureFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, folder_id: folderId } : f)))
    toast.success('이동했어요')
  }

  async function deleteFolder(folderId: string) {
    const res = await fetch('/api/secure/delete-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data?.error || '폴더를 삭제하지 못했어요')
      return
    }
    toast.success('폴더를 삭제했어요. 안의 파일은 폴더 없음으로 옮겨졌어요')
    if (selectedFileFolderId === folderId) setSelectedFileFolderId(null)
    setSecureFiles((prev) => prev.map((f) => (f.folder_id === folderId ? { ...f, folder_id: null } : f)))
    fetchSecureFolders()
    // refetch 하지 않음: 위 setSecureFiles 로 이미 반영됨. fetchSecureFiles() 실패 시 fallback 이 전체를 folder_id null 로 덮어써서 깜빡임·전체 밖으로 나오는 현상 방지
  }

  async function renameSecureFile(fileId: string, newName: string) {
    const { error } = await supabase.from('files').update({ name: newName }).eq('id', fileId)
    if (error) return toast.error('이름 변경 실패')
    toast.success('이름이 변경되었어요')
    fetchSecureFiles()
    setSelectedSecurePhoto((p) => (p?.id === fileId ? { ...p, name: newName } : p))
    setSelectedSecureVideo((v) => (v?.id === fileId ? { ...v, name: newName } : v))
  }

  async function renameSecureFolder(folderId: string, newName: string) {
    const { error } = await supabase.from('secure_folders').update({ name: newName }).eq('id', folderId)
    if (error) return toast.error('이름 변경 실패')
    toast.success('폴더 이름이 변경되었어요')
    fetchSecureFolders()
  }

  async function openSecureFile(path: string) {
    const url = await getSignedFileUrl('family-files', path, 300)
    if (url) window.open(url, '_blank')
    else toast.error('파일을 열 수 없어요')
  }

  async function updateSecureFileMemo(fileId: string, memo: string) {
    const now = new Date().toISOString()
    const { error } = await supabase.from('files').update({ memo: memo || null, memo_updated_at: memo ? now : null }).eq('id', fileId)
    if (error) return toast.error('메모 저장 실패')
    setSecureFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, memo: memo || null, memo_updated_at: memo ? now : null } : f)))
    if (selectedSecureFile?.id === fileId) setSelectedSecureFile((f) => (f && f.id === fileId ? { ...f, memo: memo || null, memo_updated_at: memo ? now : null } : f))
    toast.success('메모가 저장되었어요')
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

  const secureByType = {
    files: secureFiles.filter((f) => f.file_type === 'file'),
    photos: secureFiles.filter((f) => f.file_type === 'photo'),
    videos: secureFiles.filter((f) => f.file_type === 'video'),
  }

  const currentFolder = selectedFileFolderId ? secureFolders.find((f) => f.id === selectedFileFolderId) : null
  const filesInCurrentFolder = secureByType.files.filter((f) => (f.folder_id ?? null) === selectedFileFolderId)
  const rootFiles = secureByType.files.filter((f) => !f.folder_id)

  const currentSecurePhotoFolder = selectedSecurePhotoFolderId ? securePhotoFolders.find((f) => f.id === selectedSecurePhotoFolderId) : null
  const securePhotosInCurrentFolder = secureByType.photos.filter((f) => (f.photo_folder_id ?? null) === selectedSecurePhotoFolderId)
  const secureRootPhotos = secureByType.photos.filter((f) => !f.photo_folder_id)
  const displaySecurePhotos = selectedSecurePhotoFolderId ? securePhotosInCurrentFolder : secureRootPhotos

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
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">보안 폴더</h1>
                <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-sm" aria-hidden>
                  <Lock className="w-5 h-5" strokeWidth={2.2} />
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">나만의 보안 공간</p>
            </div>
          </div>
          <button
            onClick={handleLock}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <Lock className="w-4 h-4" />
            잠그기
          </button>
        </div>

        {/* 탭: 파일 / 사진 / 동영상 / 메모 */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button onClick={() => setTab('files')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'files' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            <FileText className="w-4 h-4" /> 파일 ({secureByType.files.length})
          </button>
          <button onClick={() => setTab('photos')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'photos' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            <Image className="w-4 h-4" /> 사진 ({secureByType.photos.length})
          </button>
          <button onClick={() => setTab('videos')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'videos' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            <Video className="w-4 h-4" /> 동영상 ({secureByType.videos.length})
          </button>
          <button onClick={() => setTab('notes')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'notes' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            <StickyNote className="w-4 h-4" /> 메모 ({secureNotes.length})
          </button>
        </div>

        {/* 파일 탭: 하위 폴더 + 문서·일반 파일 */}
        {tab === 'files' && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              {selectedFileFolderId ? (
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverFolderId('root') }}
                    onDragLeave={() => setDragOverFolderId(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      const fileId = e.dataTransfer.getData(DRAG_FILE_KEY) || e.dataTransfer.getData('text/plain')
                      if (fileId) { moveFileToFolder(fileId, null) }
                      setDragOverFolderId(null)
                      setDraggedFileId(null)
                    }}
                    className={`inline-flex items-center rounded-lg px-2 py-1 -ml-1 transition-colors ${dragOverFolderId === 'root' ? 'bg-brand-100 text-brand-700' : ''}`}
                  >
                    <button type="button" onClick={() => setSelectedFileFolderId(null)} className="text-gray-500 hover:text-gray-800">전체</button>
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-800">{currentFolder?.name}</span>
                  <button onClick={() => currentFolder && deleteFolder(currentFolder.id)} className="text-red-500 hover:text-red-600 text-xs ml-2">폴더 삭제</button>
                </div>
              ) : (
                <span className="text-sm text-gray-500">폴더를 만들고 파일을 분류해 보관하세요</span>
              )}
              <div className="flex gap-2">
                {!selectedFileFolderId && (
                  <button onClick={() => setShowNewFolder(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
                    <FolderPlus className="w-4 h-4" /> 새 폴더
                  </button>
                )}
                <button onClick={() => setShowUpload(!showUpload)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
                  <Upload className="w-4 h-4" /> 파일 올리기
                </button>
              </div>
            </div>

            {showNewFolder && (
              <div className="mb-4 p-4 bg-white border border-gray-100 rounded-2xl flex gap-2">
                <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="폴더 이름 (예: 계약서, 프로젝트, 업무)" className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm" onKeyDown={(e) => e.key === 'Enter' && createFolder()} />
                <button onClick={createFolder} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium">만들기</button>
                <button onClick={() => { setShowNewFolder(false); setNewFolderName('') }} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl text-sm">취소</button>
              </div>
            )}

            {showUpload && (
              <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-4">
                <UploadZone bucket="family-files" fileType="file" isSecure={true} folderId={selectedFileFolderId} onUploadComplete={() => { fetchSecureFiles(); setShowUpload(false) }} />
              </div>
            )}

            {filesLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{[1,2,3,4].map((i) => <div key={i} className="aspect-square bg-gray-100 rounded-2xl animate-pulse" />)}</div>
            ) : (
              <>
                {!selectedFileFolderId && secureFolders.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">폴더</h3>
                    <div className="grid gap-3 min-w-0" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(20rem, 1fr))' }}>
                      {secureFolders.map((folder) => {
                        const count = secureByType.files.filter((f) => f.folder_id === folder.id).length
                        const isDropTarget = dragOverFolderId === folder.id
                        return (
                          <div
                            key={folder.id}
                            className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all group min-w-0 w-full overflow-hidden ${isDropTarget ? 'border-brand-400 bg-brand-50 shadow-md' : 'border-gray-100 bg-white hover:shadow-md'}`}
                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverFolderId(folder.id) }}
                            onDragLeave={() => setDragOverFolderId(null)}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              const fileId = e.dataTransfer.getData(DRAG_FILE_KEY) || e.dataTransfer.getData('text/plain')
                              if (fileId) { moveFileToFolder(fileId, folder.id) }
                              setDragOverFolderId(null)
                              setDraggedFileId(null)
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedFileFolderId(folder.id)}
                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDragOverFolderId(folder.id) }}
                              onDrop={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                const fileId = e.dataTransfer.getData(DRAG_FILE_KEY) || e.dataTransfer.getData('text/plain')
                                if (fileId) { moveFileToFolder(fileId, folder.id) }
                                setDragOverFolderId(null)
                                setDraggedFileId(null)
                              }}
                              className="flex-1 flex items-center gap-3 text-left min-w-0">
                              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0"><FolderOpen className="w-6 h-6 text-amber-600" /></div>
                              <div className="min-w-0 flex-1">
                                {editingFolderId === folder.id ? (
                                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                    <input type="text" value={editingFolderName} onChange={(e) => setEditingFolderName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { renameSecureFolder(folder.id, editingFolderName.trim()); setEditingFolderId(null) } if (e.key === 'Escape') setEditingFolderId(null) }} className="flex-1 px-2 py-0.5 border border-gray-200 rounded text-sm min-w-0" autoFocus />
                                    <button type="button" onClick={() => { renameSecureFolder(folder.id, editingFolderName.trim()); setEditingFolderId(null) }} className="text-xs text-brand-600 font-medium">저장</button>
                                    <button type="button" onClick={() => setEditingFolderId(null)} className="text-xs text-gray-500">취소</button>
                                  </div>
                                ) : (
                                  <>
                                    <p className="font-medium text-gray-800 whitespace-nowrap truncate" title={folder.name}>{folder.name}</p>
                                    <p className="text-xs text-gray-400 whitespace-nowrap">{count}개 파일</p>
                                  </>
                                )}
                              </div>
                            </button>
                            {editingFolderId !== folder.id && (
                              <button onClick={(e) => { e.stopPropagation(); setEditingFolderId(folder.id); setEditingFolderName(folder.name) }} className="p-2 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 opacity-0 group-hover:opacity-100" title="이름 변경"><Pencil className="w-4 h-4" /></button>
                            )}
                            <button onClick={() => deleteFolder(folder.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100"> <Trash2 className="w-4 h-4" /> </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {!selectedFileFolderId && rootFiles.length > 0 && (
                  <div className="flex items-center gap-2 mb-3 mt-1">
                    <span className="text-xs text-gray-400">폴더에 안 넣은 파일</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">드래그해서 폴더에 넣거나, 카드에 마우스를 올려 이동할 수 있어요</span>
                  </div>
                )}
                {(selectedFileFolderId ? filesInCurrentFolder : rootFiles).length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">{selectedFileFolderId ? '이 폴더에 파일이 없어요' : '문서·일반 파일이 없어요'}</p>
                    <p className="text-xs text-gray-400 mt-1">파일 올리기로 워드, 엑셀, PDF 등을 추가하세요</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {(selectedFileFolderId ? filesInCurrentFolder : rootFiles).map((f) => (
                      <div
                        key={f.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData(DRAG_FILE_KEY, f.id); e.dataTransfer.setData('text/plain', f.id); e.dataTransfer.effectAllowed = 'move'; setDraggedFileId(f.id) }}
                        onDragEnd={() => { setDraggedFileId(null); setDragOverFolderId(null) }}
                        onClick={() => setSelectedSecureFile(f)}
                        className={`bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-all flex flex-col group cursor-pointer ${draggedFileId === f.id ? 'opacity-50' : ''}`}
                      >
                        <div className="aspect-square min-h-[140px] bg-gray-50 flex items-center justify-center relative overflow-hidden">
                          <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
                            <DocumentThumbnail bucket="family-files" storagePath={f.storage_path} mimeType={f.mime_type} fallback={<span className="text-5xl">{getFileIcon(f.mime_type)}</span>} className="w-full h-full" />
                          </div>
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-end gap-1 p-3 opacity-0 group-hover:opacity-100 pointer-events-none">
                            <span className="pointer-events-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setEditingFileId(f.id); setEditingFileName(f.name) }} className="p-2 rounded-lg bg-white/90 text-gray-700 hover:bg-white shadow" title="이름 변경"><Pencil className="w-4 h-4" /></button>
                              <select className="text-xs rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-gray-600" value="" onChange={(e) => { e.stopPropagation(); const v = e.target.value; moveFileToFolder(f.id, v || null); e.target.value = '' }} title="폴더로 이동">
                                <option value="">이동...</option>
                                <option value="">📁 폴더 없음</option>
                                {secureFolders.map((fd) => <option key={fd.id} value={fd.id}>📁 {fd.name}</option>)}
                              </select>
                              <SecureDownloadLink path={f.storage_path} fileName={f.name} className="p-2 rounded-lg bg-white/90 text-gray-700 hover:bg-white shadow"><Download className="w-4 h-4" /></SecureDownloadLink>
                              <button type="button" onClick={(e) => { e.stopPropagation(); deleteSecureFile(f.id, f.storage_path) }} className="p-2 rounded-lg bg-white/90 text-red-500 hover:bg-white shadow"><Trash2 className="w-4 h-4" /></button>
                            </span>
                          </div>
                        </div>
                        <div className="px-4 py-3 min-w-0 border-t border-gray-50" onClick={editingFileId === f.id ? (e) => e.stopPropagation() : undefined}>
                          {editingFileId === f.id ? (
                            <div className="flex gap-1">
                              <input type="text" value={editingFileName} onChange={(e) => setEditingFileName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { renameSecureFile(f.id, editingFileName.trim()); setEditingFileId(null) } if (e.key === 'Escape') setEditingFileId(null) }} className="flex-1 px-2 py-0.5 border border-gray-200 rounded text-sm min-w-0" autoFocus />
                              <button type="button" onClick={() => { renameSecureFile(f.id, editingFileName.trim()); setEditingFileId(null) }} className="text-xs text-brand-600 font-medium shrink-0">저장</button>
                              <button type="button" onClick={() => setEditingFileId(null)} className="text-xs text-gray-500 shrink-0">취소</button>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm text-gray-700 truncate font-normal tracking-tight" title={f.name}>{f.name}</p>
                              <p className="text-xs text-gray-400 mt-1">{formatFileSize(f.size_bytes)} · {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ko })}</p>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* 사진 탭 */}
        {tab === 'photos' && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              {selectedSecurePhotoFolderId ? (
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverSecurePhotoFolderId('root') }}
                    onDragLeave={() => setDragOverSecurePhotoFolderId(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      const photoId = e.dataTransfer.getData('application/x-secure-photo-id') || e.dataTransfer.getData('text/plain')
                      if (photoId) moveSecurePhotoToFolder(photoId, null)
                      setDragOverSecurePhotoFolderId(null)
                      setDraggedSecurePhotoId(null)
                    }}
                    className={`inline-flex items-center rounded-lg px-2 py-1 -ml-1 transition-colors ${dragOverSecurePhotoFolderId === 'root' ? 'bg-brand-100 text-brand-700' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedSecurePhotoFolderId(null)}
                      className="text-gray-500 hover:text-gray-800"
                    >
                      전체
                    </button>
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-800">{currentSecurePhotoFolder?.name}</span>
                  <button
                    onClick={() => currentSecurePhotoFolder && deleteSecurePhotoFolder(currentSecurePhotoFolder.id)}
                    className="text-red-500 hover:text-red-600 text-xs ml-2"
                  >
                    폴더 삭제
                  </button>
                </div>
              ) : (
                <span className="text-sm text-gray-500">폴더를 만들고 사진을 분류해 보관하세요</span>
              )}
              <div className="flex gap-2">
                {!selectedSecurePhotoFolderId && (
                  <button
                    onClick={() => setShowNewPhotoFolder(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50"
                  >
                    <FolderPlus className="w-4 h-4" /> 새 폴더
                  </button>
                )}
                <button
                  onClick={() => setShowUpload(!showUpload)}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700"
                >
                  <Upload className="w-4 h-4" /> 사진 추가
                </button>
              </div>
            </div>

            {showNewPhotoFolder && (
              <div className="mb-4 p-4 bg-white border border-gray-100 rounded-2xl flex gap-2">
                <input
                  type="text"
                  value={newPhotoFolderName}
                  onChange={(e) => setNewPhotoFolderName(e.target.value)}
                  placeholder="폴더 이름"
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && createSecurePhotoFolder()}
                />
                <button
                  onClick={createSecurePhotoFolder}
                  className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium"
                >
                  만들기
                </button>
                <button
                  onClick={() => { setShowNewPhotoFolder(false); setNewPhotoFolderName('') }}
                  className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl text-sm"
                >
                  취소
                </button>
              </div>
            )}

            {showUpload && (
              <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-4">
                <UploadZone
                  bucket="family-files"
                  fileType="photo"
                  isSecure={true}
                  photoFolderId={selectedSecurePhotoFolderId}
                  onUploadComplete={() => { fetchSecureFiles(); setShowUpload(false) }}
                />
              </div>
            )}

            {filesLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="aspect-square bg-gray-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : secureByType.photos.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                <Image className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">사진이 없어요</p>
                <p className="text-xs text-gray-400 mt-1">위의 사진 추가 버튼으로 이미지를 업로드하세요</p>
              </div>
            ) : (
              <>
                {!selectedSecurePhotoFolderId && securePhotoFolders.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">폴더</h3>
                    <div className="grid gap-3 min-w-0" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(20rem, 1fr))' }}>
                      {securePhotoFolders.map((folder) => {
                        const count = secureByType.photos.filter((p) => p.photo_folder_id === folder.id).length
                        const isDropTarget = dragOverSecurePhotoFolderId === folder.id
                        return (
                          <div
                            key={folder.id}
                            className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all group min-w-0 w-full overflow-hidden ${isDropTarget ? 'border-brand-400 bg-brand-50 shadow-md' : 'border-gray-100 bg-white hover:shadow-md'}`}
                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverSecurePhotoFolderId(folder.id) }}
                            onDragLeave={() => setDragOverSecurePhotoFolderId(null)}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              const photoId = e.dataTransfer.getData('application/x-secure-photo-id') || e.dataTransfer.getData('text/plain')
                              if (photoId) moveSecurePhotoToFolder(photoId, folder.id)
                              setDragOverSecurePhotoFolderId(null)
                              setDraggedSecurePhotoId(null)
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedSecurePhotoFolderId(folder.id)}
                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDragOverSecurePhotoFolderId(folder.id) }}
                              onDrop={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                const photoId = e.dataTransfer.getData('application/x-secure-photo-id') || e.dataTransfer.getData('text/plain')
                                if (photoId) moveSecurePhotoToFolder(photoId, folder.id)
                                setDragOverSecurePhotoFolderId(null)
                                setDraggedSecurePhotoId(null)
                              }}
                              className="flex-1 flex items-center gap-3 text-left min-w-0"
                            >
                              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                                <FolderOpen className="w-6 h-6 text-amber-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                {editingPhotoFolderId === folder.id ? (
                                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="text"
                                      value={editingPhotoFolderName}
                                      onChange={(e) => setEditingPhotoFolderName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          renameSecurePhotoFolder(folder.id, editingPhotoFolderName.trim())
                                        }
                                        if (e.key === 'Escape') setEditingPhotoFolderId(null)
                                      }}
                                      className="flex-1 px-2 py-0.5 border border-gray-200 rounded text-sm min-w-0"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => { renameSecurePhotoFolder(folder.id, editingPhotoFolderName.trim()) }}
                                      className="text-xs text-brand-600 font-medium"
                                    >
                                      저장
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingPhotoFolderId(null)}
                                      className="text-xs text-gray-500"
                                    >
                                      취소
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <p className="font-medium text-gray-800 whitespace-nowrap truncate" title={folder.name}>
                                      {folder.name}
                                    </p>
                                    <p className="text-xs text-gray-400 whitespace-nowrap">{count}장</p>
                                  </>
                                )}
                              </div>
                            </button>
                            {editingPhotoFolderId !== folder.id && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingPhotoFolderId(folder.id); setEditingPhotoFolderName(folder.name) }}
                                className="p-2 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 opacity-0 group-hover:opacity-100"
                                title="이름 변경"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteSecurePhotoFolder(folder.id) }}
                              className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {!selectedSecurePhotoFolderId && secureRootPhotos.length > 0 && (
                  <p className="text-xs text-gray-400 mb-3">폴더에 안 넣은 사진 · 드래그해서 폴더에 넣거나, 카드에 마우스를 올려 이동할 수 있어요</p>
                )}

                {displaySecurePhotos.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Upload className="w-5 h-5 text-brand-600" />
                    </div>
                    <p className="text-sm text-gray-500">
                      {selectedSecurePhotoFolderId ? '이 폴더에 사진이 없어요' : '사진을 업로드해보세요'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {displaySecurePhotos.map((f) => (
                      <SecurePhotoCard
                        key={f.id}
                        f={f}
                        photoFolders={securePhotoFolders}
                        onSelect={(file) => setSelectedSecurePhoto(file)}
                        onDownload={async (path, name) => { await triggerDownload(path, name); toast.success('다운로드됨'); }}
                        onDelete={deleteSecureFile}
                        onMoveToFolder={moveSecurePhotoToFolder}
                        isDragging={draggedSecurePhotoId === f.id}
                        onDragStart={() => setDraggedSecurePhotoId(f.id)}
                        onDragEnd={() => { setDraggedSecurePhotoId(null); setDragOverSecurePhotoFolderId(null) }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* 동영상 탭 */}
        {tab === 'videos' && (
          <>
            <div className="flex justify-end mb-3">
              <button onClick={() => setShowUpload(!showUpload)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
                <Upload className="w-4 h-4" /> 파일 올리기
              </button>
            </div>
            {showUpload && (
              <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-4">
                <UploadZone bucket="family-files" fileType="file" isSecure={true} onUploadComplete={() => { fetchSecureFiles(); setShowUpload(false) }} />
              </div>
            )}
            {filesLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{[1,2,3,4].map((i) => <div key={i} className="aspect-video bg-gray-100 rounded-2xl animate-pulse" />)}</div>
            ) : secureByType.videos.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                <Video className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">동영상이 없어요</p>
                <p className="text-xs text-gray-400 mt-1">파일 올리기로 영상을 추가하세요</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {secureByType.videos.map((f) => (
                  <SecureVideoCard key={f.id} f={f} onSelect={(file) => setSelectedSecureVideo(file)} onDownload={async (path, name) => { await triggerDownload(path, name); toast.success('다운로드됨'); }} onDelete={deleteSecureFile} />
                ))}
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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                {secureNotes.map((note) => {
                  const c = NOTE_COLORS[note.color] || NOTE_COLORS.yellow
                  return (
                    <div
                      key={note.id}
                      onClick={() => { setEditingNote(note); setIsNewNote(false) }}
                      className={`${c.bg} ${c.border} border-2 rounded-2xl p-5 min-h-[180px] cursor-pointer hover:shadow-md transition-all relative flex flex-col`}
                    >
                      {note.pinned && <Pin className="w-4 h-4 text-gray-500 absolute top-4 right-4" />}
                      <p className="font-semibold text-gray-800 mb-2 line-clamp-1 text-base">{note.title || '제목 없음'}</p>
                      <p className="text-sm text-gray-600 line-clamp-5 whitespace-pre-wrap flex-1">{note.content || <span className="text-gray-400">내용 없음</span>}</p>
                      <p className="text-xs text-gray-400 mt-3">{formatDistanceToNow(new Date(note.updated_at), { addSuffix: true, locale: ko })}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* 보안 폴더 사진 확대 모달 */}
        {selectedSecurePhoto && (
          <SecurePhotoModal
            file={selectedSecurePhoto}
            onClose={() => setSelectedSecurePhoto(null)}
            onDownload={async (path, name) => { await triggerDownload(path, name); toast.success('다운로드됨'); }}
            onDelete={(id, path) => { deleteSecureFile(id, path); setSelectedSecurePhoto(null); }}
            onRename={renameSecureFile}
          />
        )}
        {/* 보안 폴더 동영상 확대 모달 */}
        {selectedSecureVideo && (
          <SecureVideoModal
            file={selectedSecureVideo}
            onClose={() => setSelectedSecureVideo(null)}
            onDownload={async (path, name) => { await triggerDownload(path, name); toast.success('다운로드됨'); }}
            onDelete={(id, path) => { deleteSecureFile(id, path); setSelectedSecureVideo(null); }}
            onRename={renameSecureFile}
          />
        )}
        {/* 보안 폴더 문서/일반 파일 모달 */}
        {selectedSecureFile && (
          <SecureFileModal
            file={selectedSecureFile}
            onClose={() => setSelectedSecureFile(null)}
            onDownload={async (path, name) => { await triggerDownload(path, name); toast.success('다운로드됨'); }}
            onDelete={(id, path) => { deleteSecureFile(id, path); setSelectedSecureFile(null); }}
            onRename={renameSecureFile}
            onSaveMemo={updateSecureFileMemo}
          />
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
