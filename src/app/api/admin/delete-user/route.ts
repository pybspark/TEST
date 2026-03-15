import { createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_EMAIL = 'pybspark@gmail.com'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { userId } = await req.json()

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 1. 해당 사용자가 올린 파일 목록 조회 (스토리지 삭제용)
  const { data: userFiles } = await adminClient
    .from('files')
    .select('storage_path')
    .eq('owner_id', userId)

  // 2. 스토리지에서 파일/사진/동영상 실제 삭제
  if (userFiles?.length) {
    const paths = userFiles.map((f) => f.storage_path).filter(Boolean)
    if (paths.length) {
      await adminClient.storage.from('family-files').remove(paths)
    }
  }

  // 3. DB: 파일, 메모, 그룹 멤버십 삭제
  await adminClient.from('files').delete().eq('owner_id', userId)
  await adminClient.from('notes').delete().eq('owner_id', userId)
  await adminClient.from('family_members').delete().eq('user_id', userId)
  await adminClient.from('profiles').delete().eq('id', userId)

  // 4. Auth 계정 삭제
  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
