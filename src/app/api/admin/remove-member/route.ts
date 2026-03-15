import { createServerSupabase } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  const body = await req.json()
  const { userId: targetUserId } = body

  if (!targetUserId) {
    return NextResponse.json({ error: 'userId가 필요합니다' }, { status: 400 })
  }

  // 요청자가 그룹 소유자인지 확인
  const { data: myMember } = await supabase
    .from('family_members')
    .select('group_id')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .maybeSingle()

  if (!myMember?.group_id) {
    return NextResponse.json({ error: '그룹 관리자만 멤버를 제거할 수 있습니다' }, { status: 403 })
  }

  // 대상이 같은 그룹의 멤버인지, 그리고 owner가 아닌지 확인
  const { data: targetMember } = await supabase
    .from('family_members')
    .select('id, role')
    .eq('group_id', myMember.group_id)
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (!targetMember) {
    return NextResponse.json({ error: '해당 사용자는 이 그룹의 멤버가 아닙니다' }, { status: 403 })
  }

  if (targetMember.role === 'owner') {
    return NextResponse.json({ error: '관리자는 그룹에서 제거할 수 없습니다' }, { status: 403 })
  }

  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('id', targetMember.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}
