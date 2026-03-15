import { createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/** 그룹 소유자만 해당 그룹 삭제 가능. 구성원은 자동 제거, 파일·메모의 group_id는 null로 변경됨 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  const { groupId } = await req.json().catch(() => ({}))
  if (!groupId) {
    return NextResponse.json({ error: 'groupId가 필요합니다' }, { status: 400 })
  }

  const { data: myMember } = await supabase
    .from('family_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myMember || myMember.role !== 'owner') {
    return NextResponse.json({ error: '그룹 관리자만 삭제할 수 있습니다' }, { status: 403 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await adminClient.from('family_groups').delete().eq('id', groupId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
