'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Cloud, Image, FileText, Video, StickyNote, Users, LogOut, HardDrive } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: '전체 보기', icon: HardDrive, exact: true },
  { href: '/dashboard/photos', label: '사진', icon: Image },
  { href: '/dashboard/files', label: '파일', icon: FileText },
  { href: '/dashboard/videos', label: '영상', icon: Video },
  { href: '/dashboard/notes', label: '메모', icon: StickyNote },
  { href: '/dashboard/family', label: '가족 관리', icon: Users },
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

  function formatGB(bytes: number) {
    return (bytes / 1024 / 1024 / 1024).toFixed(1)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-[220px] h-screen bg-white border-r border-gray-100 flex flex-col fixed left-0 top-0 z-30">
      {/* 로고 */}
      <div className="p-4 pb-2">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Cloud className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">우리 클라우드</span>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-brand-50 text-brand-600 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* 저장공간 & 로그아웃 */}
      <div className="p-4 border-t border-gray-100 space-y-3">
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>저장공간</span>
            <span>{formatGB(usedBytes)} / {formatGB(totalBytes)} GB</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 rounded-full transition-all"
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-800">{user.name || '사용자'}</p>
            <p className="text-xs text-gray-400 truncate max-w-[130px]">{user.email}</p>
          </div>
          <button
            onClick={signOut}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
