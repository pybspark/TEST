'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Cloud, Image, FileText, Video, StickyNote, Users, LogOut, HardDrive, Share2, Crown, Menu, X, Lock, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const ADMIN_EMAIL = 'pybspark@gmail.com'

const baseNavItems = [
  { href: '/dashboard', label: '홈', icon: HardDrive, exact: true },
  { href: '/dashboard/secure', label: '보안 폴더', icon: Lock },
  { href: '/dashboard/shared', label: '공유 폴더', icon: Share2 },
  { href: '/dashboard/photos', label: '사진', icon: Image },
  { href: '/dashboard/files', label: '파일', icon: FileText },
  { href: '/dashboard/videos', label: '영상', icon: Video },
  { href: '/dashboard/notes', label: '메모', icon: StickyNote },
  { href: '/dashboard/trash', label: '휴지통', icon: Trash2 },
]

const adminOnlyNavItems = [
  { href: '/dashboard/family', label: '그룹', icon: Users },
  { href: '/dashboard/admin', label: '관리자', icon: Crown, exact: false },
]

interface SidebarProps {
  user: { email?: string; name?: string }
  usedBytes?: number
  totalBytes?: number
}

export default function Sidebar({ user, usedBytes = 0, totalBytes = 10 * 1024 * 1024 * 1024 }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const usedPct = Math.round((usedBytes / totalBytes) * 100)
  const [menuOpen, setMenuOpen] = useState(false)
  const [secureLeaveConfirmOpen, setSecureLeaveConfirmOpen] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  const navItems = user.email === ADMIN_EMAIL
    ? [...baseNavItems, ...adminOnlyNavItems]
    : baseNavItems

  function handleNavClick(e: React.MouseEvent, href: string) {
    e.preventDefault()
    e.stopPropagation()
    const isInSecure = pathname.startsWith('/dashboard/secure')
    const isLeavingSecure = isInSecure && !href.startsWith('/dashboard/secure')
    if (isLeavingSecure) {
      setPendingHref(href)
      setSecureLeaveConfirmOpen(true)
      return
    }
    setMenuOpen(false)
    router.push(href)
  }

  function formatGB(bytes: number) {
    return (bytes / 1024 / 1024 / 1024).toFixed(1)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* ===== 데스크탑 사이드바 ===== */}
      <aside className="hidden md:flex w-[220px] h-screen bg-white border-r border-gray-100 flex-col fixed left-0 top-0 z-30">
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Cloud className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm">BIN CLOUD</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={(e) => handleNavClick(e, href)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active ? 'bg-brand-50 text-brand-600 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-yellow-200 flex items-center justify-center shadow-sm">
                <span className="text-lg animate-cat-walk">🐈‍⬛</span>
              </div>
              <div className="text-[10px] text-gray-500 leading-tight">
                <p>오늘도 조용히</p>
                <p>파일 지켜보는 중...</p>
              </div>
            </div>
            <span className="text-[10px] text-yellow-600 h-4 flex items-center animate-cat-zz">
              Zz
            </span>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>저장공간</span>
              <span>{formatGB(usedBytes)} / {formatGB(totalBytes)} GB</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${usedPct}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-800">{user.name || '사용자'}</p>
              <p className="text-xs text-gray-400 truncate max-w-[130px]">{user.email}</p>
            </div>
            <button onClick={signOut} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ===== 모바일 상단바 ===== */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-brand-600 rounded-lg flex items-center justify-center">
            <Cloud className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">BIN CLOUD</span>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* 모바일 드로어 메뉴 */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/40" onClick={() => setMenuOpen(false)}>
          <div className="absolute top-14 left-0 right-0 bg-white border-b border-gray-100 p-3 space-y-1"
            onClick={(e) => e.stopPropagation()}>
            {navItems.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={(e) => handleNavClick(e, href)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${
                    active ? 'bg-brand-50 text-brand-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </Link>
              )
            })}
            <div className="border-t border-gray-100 mt-2 pt-2 px-4 pb-1 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">{user.name || '사용자'}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
              <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-xl text-xs">
                <LogOut className="w-3.5 h-3.5" />
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 모바일 하단 탭바 ===== */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 px-2 pb-safe">
        <div className="flex items-center justify-around">
          {baseNavItems.slice(0, 5).map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={(e) => handleNavClick(e, href)}
                className={`flex flex-col items-center gap-0.5 py-2.5 px-3 transition-colors ${
                  active ? 'text-brand-600' : 'text-gray-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs">{label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* 보안 폴더 이탈 확인 모달 */}
      {secureLeaveConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setSecureLeaveConfirmOpen(false)}
        >
          <div
            className="w-full max-w-xs bg-white rounded-2xl shadow-xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-gray-900">보안 폴더에서 나가시겠습니까?</p>
            <p className="text-xs text-gray-500">
              나가면 다시 들어올 때 2차 비밀번호를 재입력 하셔야 합니다.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSecureLeaveConfirmOpen(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingHref) {
                    setSecureLeaveConfirmOpen(false)
                    setMenuOpen(false)
                    router.push(pendingHref)
                    setPendingHref(null)
                  }
                }}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-800"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}