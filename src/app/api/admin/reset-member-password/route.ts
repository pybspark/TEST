import { createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  const body = await req.json()
  const { userId: targetUserId, newPassword } = body

  if (!targetUserId || !newPassword || typeof newPassword !== 'string') {
    return NextResponse.json({ error: 'userId와 newPassword가 필요합니다' }, { status: 400 })
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: '비밀번호는 6자 이상이어야 합니다' }, { status: 400 })
  }

  // 요청자가 그룹 소유자인지, 대상이 같은 그룹 멤버인지 확인
  const { data: myMember } = await supabase
    .from('family_members')
    .select('group_id')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .maybeSingle()

  if (!myMember?.group_id) {
    return NextResponse.json({ error: '그룹 관리자만 멤버 비밀번호를 재설정할 수 있습니다' }, { status: 403 })
  }

  const { data: targetMember } = await supabase
    .from('family_members')
    .select('user_id')
    .eq('group_id', myMember.group_id)
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (!targetMember) {
    return NextResponse.json({ error: '해당 사용자는 이 그룹의 멤버가 아닙니다' }, { status: 403 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await adminClient.auth.admin.updateUserById(targetUserId, { password: newPassword })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}
