import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const code = typeof body.code === 'string' ? body.code.trim() : ''

  if (!code) {
    return NextResponse.json({ valid: false })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data } = await admin
    .from('invite_codes')
    .select('id')
    .eq('code', code)
    .is('used_by', null)
    .maybeSingle()

  return NextResponse.json({ valid: !!data })
}
