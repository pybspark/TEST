import { createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_EMAIL = 'pybspark@gmail.com'

/** 관리자가 멤버를 그룹에서만 제거. 계정은 삭제하지 않아 같은 아이디로 초대 코드 재가입 가능 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }

    const body = await req.json()
    const userId = body?.userId
    if (!userId) {
      return NextResponse.json({ error: 'userId가 필요합니다' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: '서버 설정 오류: SUPABASE_SERVICE_ROLE_KEY가 없습니다.' }, { status: 500 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error } = await adminClient.from('family_members').delete().eq('user_id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : '그룹 제거 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
