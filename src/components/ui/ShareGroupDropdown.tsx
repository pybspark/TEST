'use client'

import { useState, useRef, useEffect } from 'react'
import { Share2 } from 'lucide-react'
import type { GroupOption } from '@/hooks/useMyGroups'

interface ShareGroupDropdownProps {
  isShared: boolean
  sharedGroupId: string | null
  groupName?: string | null
  groups: GroupOption[]
  onSelect: (groupId: string | null) => void
  loading?: boolean
  className?: string
  title?: string
  /** 모달 하단 등에서 드롭다운이 잘릴 때 true 로 위쪽으로 열기 */
  openUpward?: boolean
}

export default function ShareGroupDropdown({
  isShared,
  sharedGroupId,
  groupName,
  groups,
  onSelect,
  loading,
  className = '',
  title,
  openUpward = false,
}: ShareGroupDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const label = isShared ? (groupName ? `${groupName}에 공유 중` : '공유 중') : '그룹에 공유'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => groups.length > 0 && setOpen((v) => !v)}
        disabled={loading || groups.length === 0}
        title={title || (isShared ? '공유 그룹 변경' : '특정 그룹에만 공유')}
        className={className}
      >
        <Share2 className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          className={`absolute right-0 py-1 bg-white border border-gray-200 rounded-xl shadow-lg z-[100] min-w-[160px] ${
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          <p className="px-3 py-1.5 text-xs text-gray-500 border-b border-gray-100">공유할 그룹 선택</p>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                onSelect(g.id)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${sharedGroupId === g.id ? 'text-brand-600 font-medium bg-brand-50' : 'text-gray-700'}`}
            >
              {g.name}
            </button>
          ))}
          {isShared && (
            <button
              type="button"
              onClick={() => {
                onSelect(null)
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 border-t border-gray-100"
            >
              공유 해제
            </button>
          )}
        </div>
      )}
    </div>
  )
}
