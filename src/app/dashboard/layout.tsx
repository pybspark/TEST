import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, email')
    .eq('id', user.id)
    .single()

  // 사용 용량 계산
  const { data: files } = await supabase
    .from('files')
    .select('size_bytes')
    .eq('owner_id', user.id)

  const usedBytes = files?.reduce((sum, f) => sum + (f.size_bytes || 0), 0) || 0

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        user={{ email: profile?.email || user.email || '', name: profile?.name }}
        usedBytes={usedBytes}
      />
      <main className="flex-1 ml-[220px] min-h-screen">
        {children}
      </main>
    </div>
  )
}
