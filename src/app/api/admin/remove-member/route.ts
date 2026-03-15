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

  // RLS를 거치지 않고 삭제하기 위해 서비스 역할 클라이언트 사용 (권한 검증은 위에서 완료)
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: deleted, error } = await adminClient
    .from('family_members')
    .delete()
    .eq('id', targetMember.id)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (!deleted?.length) {
    return NextResponse.json({ error: '멤버 제거에 실패했습니다. 다시 시도해 주세요.' }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}
