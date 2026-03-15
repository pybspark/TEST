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

  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const groupId = typeof body.groupId === 'string' ? body.groupId : ''

  if (!userId || !groupId) {
    return NextResponse.json({ error: 'userId, groupId 필요' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: group } = await admin
    .from('family_groups')
    .select('id')
    .eq('id', groupId)
    .eq('owner_id', user.id)
    .single()

  if (!group) {
    return NextResponse.json({ error: '해당 그룹을 찾을 수 없거나 권한이 없어요' }, { status: 400 })
  }

  const { error } = await admin.from('family_members').insert({
    group_id: groupId,
    user_id: userId,
    role: 'member',
  })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '이미 해당 그룹에 속해 있어요' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
