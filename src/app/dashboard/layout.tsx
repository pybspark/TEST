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

  const { data: files } = await supabase
    .from('files')
    .select('size_bytes')
    .eq('owner_id', user.id)
    .eq('is_deleted', false)

  const usedBytes = files?.reduce((sum, f) => sum + (f.size_bytes || 0), 0) || 0

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        user={{ email: profile?.email || user.email || '', name: profile?.name }}
        usedBytes={usedBytes}
      />
      <main className="flex-1 md:ml-[220px] min-h-screen pt-14 md:pt-0 pb-16 md:pb-0">
        {children}
      </main>
    </div>
  )
}