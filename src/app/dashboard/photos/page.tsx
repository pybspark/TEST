'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient, getFileUrl } from '@/lib/supabase'
import UploadZone from '@/components/features/UploadZone'
import { Upload, X, Download, Trash2, Share2, ZoomIn, Pencil, FolderPlus, FolderOpen, ChevronRight } from 'lucide-react'
import { useMyGroups } from '@/hooks/useMyGroups'
import ShareGroupDropdown from '@/components/ui/ShareGroupDropdown'
import { toast } from 'sonner'

const DRAG_PHOTO_KEY = 'application/x-photo-id'

interface PhotoFolder {
  id: string
  name: string
  created_at: string
}

interface FileRecord {
  id: string
  name: string
  storage_path: string
  size_bytes: number
  created_at: string
  is_shared: boolean
  group_id: string | null
  photo_folder_id?: string | null
  profiles?: { name: string | null }
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<FileRecord[]>([])
  const [photoFolders, setPhotoFolders] = useState<PhotoFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const supabase = createClient()
  const { groups } = useMyGroups()
  const photoFolderToastShown = useRef(false)

  const fetchPhotos = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setLoading(true)
    const selectCols = 'id, name, storage_path, size_bytes, created_at, is_shared, group_id, photo_folder_id, profiles(name)'
    const { data, error } = await supabase
      .from('files')
      .select(selectCols)
      .eq('owner_id', user.id)
      .eq('file_type', 'photo')
      .or('is_secure.eq.false,is_secure.is.null')
      .order('created_at', { ascending: false })
    if (error && (error.message?.includes('photo_folder_id') || error.message?.includes('column'))) {
      const { data: dataWithoutFolder } = await supabase
        .from('files')
        .select('id, name, storage_path, size_bytes, created_at, is_shared, group_id, profiles(name)')
        .eq('owner_id', user.id)
        .eq('file_type', 'photo')
        .or('is_secure.eq.false,is_secure.is.null')
        .order('created_at', { ascending: false })
      setPhotos((dataWithoutFolder || []).map((f) => ({ ...f, photo_folder_id: null })))
      if (error.message?.includes('photo_folder_id') && !photoFolderToastShown.current) {
        photoFolderToastShown.current = true
        toast.info('폴더 기능을 쓰려면 Supabase에서 add_photo_folders.sql을 실행해주세요.')
      }
    } else if (error) {
      setPhotos([])
    } else {
      setPhotos(data || [])
    }
    setLoading(false)
  }, [supabase])

  const fetchPhotoFolders = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('photo_folders')
      .select('id, name, created_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
    setPhotoFolders(data || [])
  }, [supabase])

  useEffect(() => {
    fetchPhotos()
    fetchPhotoFolders()
  }, [fetchPhotos, fetchPhotoFolders])

  async function movePhotoToFolder(photoId: string, folderId: string | null) {
    const { error } = await supabase.from('files').update({ photo_folder_id: folderId }).eq('id', photoId)
    if (error) return toast.error('이동 실패')
    toast.success('이동했어요')
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, photo_folder_id: folderId } : p)))
  }

  async function deletePhotoFolder(folderId: string) {
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
    if (selectedFolderId === folderId) setSelectedFolderId(null)
    setPhotos((prev) => prev.map((p) => (p.photo_folder_id === folderId ? { ...p, photo_folder_id: null } : p)))
    fetchPhotoFolders()
  }

  async function createPhotoFolder() {
    const trimmed = newFolderName.trim()
    if (!trimmed) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('photo_folders').insert({ owner_id: user.id, name: trimmed })
    if (error) return toast.error('폴더를 만들지 못했어요')
    toast.success('폴더가 만들어졌어요')
    setNewFolderName('')
    setShowNewFolder(false)
    fetchPhotoFolders()
  }

  async function renamePhotoFolder(folderId: string, newName: string) {
    const { error } = await supabase.from('photo_folders').update({ name: newName }).eq('id', folderId)
    if (error) return toast.error('이름 변경 실패')
    toast.success('이름이 변경되었어요')
    setEditingFolderId(null)
    fetchPhotoFolders()
  }

  async function deletePhoto(id: string, path: string) {
    await supabase.storage.from('family-files').remove([path])
    await supabase.from('files').delete().eq('id', id)
    toast.success('삭제되었습니다')
    setSelected(null)
    fetchPhotos()
  }

  async function setShareGroup(id: string, groupId: string | null) {
    await supabase.from('files').update({ is_shared: !!groupId, group_id: groupId }).eq('id', id)
    toast.success(groupId ? '해당 그룹에 공유됨' : '공유 해제됨')
    fetchPhotos()
  }

  async function renamePhoto(id: string, newName: string) {
    const { error } = await supabase.from('files').update({ name: newName }).eq('id', id)
    if (error) return toast.error('이름 변경 실패')
    toast.success('이름이 변경되었습니다')
    setEditingName(false)
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, name: newName } : p)))
  }

  const currentFolder = selectedFolderId ? photoFolders.find((f) => f.id === selectedFolderId) : null
  const photosInCurrentFolder = photos.filter((p) => (p.photo_folder_id ?? null) === selectedFolderId)
  const rootPhotos = photos.filter((p) => !p.photo_folder_id)
  const displayPhotos = selectedFolderId ? photosInCurrentFolder : rootPhotos

  const selectedPhoto = photos.find((p) => p.id === selected)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">사진</h1>
          <p className="text-sm text-gray-500 mt-0.5">{photos.length}장의 사진</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-800 transition-colors"
        >
          <Upload className="w-4 h-4" />
          사진 추가
        </button>
      </div>

      {showUpload && (
        <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-4">
          <UploadZone
            bucket="family-files"
            fileType="photo"
            accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'] }}
            photoFolderId={selectedFolderId}
            onUploadComplete={() => { fetchPhotos(); setShowUpload(false) }}
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            {selectedFolderId ? (
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverFolderId('root') }}
                  onDragLeave={() => setDragOverFolderId(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    const photoId = e.dataTransfer.getData(DRAG_PHOTO_KEY) || e.dataTransfer.getData('text/plain')
                    if (photoId) movePhotoToFolder(photoId, null)
                    setDragOverFolderId(null)
                    setDraggedPhotoId(null)
                  }}
                  className={`inline-flex items-center rounded-lg px-2 py-1 -ml-1 transition-colors ${dragOverFolderId === 'root' ? 'bg-brand-100 text-brand-700' : ''}`}
                >
                  <button type="button" onClick={() => setSelectedFolderId(null)} className="text-gray-500 hover:text-gray-800">전체</button>
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-gray-800">{currentFolder?.name}</span>
                <button onClick={() => currentFolder && deletePhotoFolder(currentFolder.id)} className="text-red-500 hover:text-red-600 text-xs ml-2">폴더 삭제</button>
              </div>
            ) : (
              <span className="text-sm text-gray-500">폴더를 만들고 사진을 분류해 보관하세요</span>
            )}
            <div className="flex gap-2">
              {!selectedFolderId && (
                <button onClick={() => setShowNewFolder(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
                  <FolderPlus className="w-4 h-4" /> 새 폴더
                </button>
              )}
            </div>
          </div>

          {showNewFolder && (
            <div className="mb-4 p-4 bg-white border border-gray-100 rounded-2xl flex gap-2">
              <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="폴더 이름" className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm" onKeyDown={(e) => e.key === 'Enter' && createPhotoFolder()} />
              <button onClick={createPhotoFolder} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium">만들기</button>
              <button onClick={() => { setShowNewFolder(false); setNewFolderName('') }} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl text-sm">취소</button>
            </div>
          )}

          {!selectedFolderId && photoFolders.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">폴더</h3>
              <div className="grid gap-3 min-w-0" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(20rem, 1fr))' }}>
                {photoFolders.map((folder) => {
                  const count = photos.filter((p) => p.photo_folder_id === folder.id).length
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
                        const photoId = e.dataTransfer.getData(DRAG_PHOTO_KEY) || e.dataTransfer.getData('text/plain')
                        if (photoId) movePhotoToFolder(photoId, folder.id)
                        setDragOverFolderId(null)
                        setDraggedPhotoId(null)
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedFolderId(folder.id)}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDragOverFolderId(folder.id) }}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          const photoId = e.dataTransfer.getData(DRAG_PHOTO_KEY) || e.dataTransfer.getData('text/plain')
                          if (photoId) movePhotoToFolder(photoId, folder.id)
                          setDragOverFolderId(null)
                          setDraggedPhotoId(null)
                        }}
                        className="flex-1 flex items-center gap-3 text-left min-w-0"
                      >
                        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0"><FolderOpen className="w-6 h-6 text-amber-600" /></div>
                        <div className="min-w-0 flex-1">
                          {editingFolderId === folder.id ? (
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <input type="text" value={editingFolderName} onChange={(e) => setEditingFolderName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { renamePhotoFolder(folder.id, editingFolderName.trim()); setEditingFolderId(null) } if (e.key === 'Escape') setEditingFolderId(null) }} className="flex-1 px-2 py-0.5 border border-gray-200 rounded text-sm min-w-0" autoFocus />
                              <button type="button" onClick={() => { renamePhotoFolder(folder.id, editingFolderName.trim()); setEditingFolderId(null) }} className="text-xs text-brand-600 font-medium">저장</button>
                              <button type="button" onClick={() => setEditingFolderId(null)} className="text-xs text-gray-500">취소</button>
                            </div>
                          ) : (
                            <>
                              <p className="font-medium text-gray-800 whitespace-nowrap truncate" title={folder.name}>{folder.name}</p>
                              <p className="text-xs text-gray-400 whitespace-nowrap">{count}장</p>
                            </>
                          )}
                        </div>
                      </button>
                      {editingFolderId !== folder.id && (
                        <button onClick={(e) => { e.stopPropagation(); setEditingFolderId(folder.id); setEditingFolderName(folder.name) }} className="p-2 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 opacity-0 group-hover:opacity-100" title="이름 변경"><Pencil className="w-4 h-4" /></button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); deletePhotoFolder(folder.id) }} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!selectedFolderId && rootPhotos.length > 0 && (
            <p className="text-xs text-gray-400 mb-3">폴더에 안 넣은 사진 · 드래그해서 폴더에 넣거나, 카드에 마우스를 올려 이동할 수 있어요</p>
          )}

          {displayPhotos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Upload className="w-5 h-5 text-brand-600" />
              </div>
              <p className="text-sm text-gray-500">{selectedFolderId ? '이 폴더에 사진이 없어요' : '사진을 업로드해보세요'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {displayPhotos.map((photo) => {
                const url = getFileUrl('family-files', photo.storage_path)
                return (
                  <div
                    key={photo.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData(DRAG_PHOTO_KEY, photo.id); e.dataTransfer.setData('text/plain', photo.id); e.dataTransfer.effectAllowed = 'move'; setDraggedPhotoId(photo.id) }}
                    onDragEnd={() => { setDraggedPhotoId(null); setDragOverFolderId(null) }}
                    onClick={() => setSelected(photo.id)}
                    className={`aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer relative group ${draggedPhotoId === photo.id ? 'opacity-50' : ''}`}
                  >
                    <img
                      src={url}
                      alt={photo.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-end p-2 gap-1 opacity-0 group-hover:opacity-100">
                      <select
                        className="text-xs rounded-lg border border-gray-200 bg-white/95 px-2 py-1 text-gray-600"
                        value=""
                        onChange={(e) => { e.stopPropagation(); const v = e.target.value; movePhotoToFolder(photo.id, v || null); e.target.value = '' }}
                        onClick={(e) => e.stopPropagation()}
                        title="폴더로 이동"
                      >
                        <option value="">이동...</option>
                        <option value="">📁 폴더 없음</option>
                        {photoFolders.map((fd) => <option key={fd.id} value={fd.id}>📁 {fd.name}</option>)}
                      </select>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {photo.is_shared && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center">
                        <Share2 className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* 사진 상세 모달 */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-visible max-w-2xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex-1 min-h-[40vh] flex items-center justify-center bg-gray-50 overflow-hidden">
              <img
                src={getFileUrl('family-files', selectedPhoto.storage_path)}
                alt="사진"
                className="max-w-full max-h-[70vh] w-auto h-auto object-contain"
              />
            </div>
            <div className="p-4 border-t border-gray-100 flex-shrink-0 relative">
              <p className="text-xs mb-3 flex items-center gap-1.5">
                <Share2 className={`w-3.5 h-3.5 flex-shrink-0 ${selectedPhoto.is_shared ? 'text-brand-500' : 'text-gray-400'}`} />
                {selectedPhoto.is_shared && selectedPhoto.group_id ? (
                  <span className="font-medium text-brand-600">
                    {groups.find((g) => g.id === selectedPhoto.group_id)?.name || '그룹'}에 공유됨
                  </span>
                ) : (
                  <span className="text-gray-400">공유 안 함</span>
                )}
              </p>
              <div className="flex items-center gap-2 mb-3">
                {editingName ? (
                  <>
                    <input type="text" value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && renamePhoto(selectedPhoto.id, editNameValue.trim())} className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm" autoFocus />
                    <button type="button" onClick={() => renamePhoto(selectedPhoto.id, editNameValue.trim())} className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm">저장</button>
                    <button type="button" onClick={() => { setEditingName(false); setEditNameValue(selectedPhoto.name) }} className="px-3 py-1.5 text-gray-500 rounded-lg text-sm">취소</button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-800 truncate flex-1">{selectedPhoto.name}</p>
                    <button type="button" onClick={() => { setEditNameValue(selectedPhoto.name); setEditingName(true) }} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100" title="이름 변경"><Pencil className="w-4 h-4" /></button>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center justify-center relative">
                  <ShareGroupDropdown
                    isShared={selectedPhoto.is_shared}
                    sharedGroupId={selectedPhoto.group_id}
                    groupName={selectedPhoto.group_id ? groups.find((g) => g.id === selectedPhoto.group_id)?.name : null}
                    groups={groups}
                    onSelect={(groupId) => setShareGroup(selectedPhoto.id, groupId)}
                    openUpward
                    className={`flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                      selectedPhoto.is_shared ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  />
                </div>
                <select
                  className="text-xs rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-gray-600"
                  value={selectedPhoto.photo_folder_id ?? ''}
                  onChange={(e) => movePhotoToFolder(selectedPhoto.id, e.target.value || null)}
                  title="폴더로 이동"
                >
                  <option value="">폴더 없음</option>
                  {photoFolders.map((fd) => <option key={fd.id} value={fd.id}>{fd.name}</option>)}
                </select>
                <a
                  href={getFileUrl('family-files', selectedPhoto.storage_path)}
                  download={`사진-${selectedPhoto.id.slice(0, 8)}.jpg`}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  다운로드
                </a>
                <button
                  onClick={() => deletePhoto(selectedPhoto.id, selectedPhoto.storage_path)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-500 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="flex items-center justify-center p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
