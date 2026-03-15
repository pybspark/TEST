import { createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

const ADMIN_EMAIL = 'pybspark@gmail.com'

function randomCode(length = 8): string {
  const charset = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = randomBytes(length)
  return Array.from(bytes, (b) => charset[b % charset.length]).join('')
}

export async function POST() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  let code = randomCode(8)
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await adminClient
      .from('invite_codes')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    if (!existing) break
    code = randomCode(8)
  }

  const { data: row, error } = await adminClient
    .from('invite_codes')
    .insert({ code, created_by: user.id })
    .select('code')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ inviteCode: row?.code ?? code })
}
