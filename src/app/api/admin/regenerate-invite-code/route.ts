import { createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

const ADMIN_EMAIL = 'pybspark@gmail.com'

function randomInviteCode(length = 8): string {
  const charset = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = randomBytes(length)
  return Array.from(bytes, (b) => charset[b % charset.length]).join('')
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  // 관리자가 owner인 그룹 찾기
  const { data: myMember } = await supabase
    .from('family_members')
    .select('group_id')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .maybeSingle()

  if (!myMember?.group_id) {
    return NextResponse.json({ error: '관리자 그룹을 찾을 수 없습니다' }, { status: 400 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  let newCode = randomInviteCode(8)
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await adminClient
      .from('family_groups')
      .select('id')
      .eq('invite_code', newCode)
      .maybeSingle()
    if (!existing) break
    newCode = randomInviteCode(8)
  }

  const { error } = await adminClient
    .from('family_groups')
    .update({ invite_code: newCode })
    .eq('id', myMember.group_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ inviteCode: newCode })
}
