import { createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  const body = await req.json().catch(() => ({}))
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!code) {
    return NextResponse.json({ error: '초대 코드가 없어요' }, { status: 400 })
  }

  let userId: string | null = user?.id ?? null
  if (!userId && email) {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .limit(1)
      .maybeSingle()
    userId = profile?.id ?? null
  }

  if (!userId) {
    return NextResponse.json({ error: '로그인해 주시거나, 가입 직후에는 이메일을 함께 보내 주세요' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: row, error: updateError } = await admin
    .from('invite_codes')
    .update({ used_by: userId, used_at: new Date().toISOString() })
    .eq('code', code)
    .is('used_by', null)
    .select('id')
    .maybeSingle()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }
  if (!row) {
    return NextResponse.json({ error: '이미 사용된 코드이거나 올바르지 않은 코드예요' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
