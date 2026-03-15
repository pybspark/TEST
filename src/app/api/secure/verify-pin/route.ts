import { createServerSupabase } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

function hashPin(pin: string, userId: string): string {
  const salt = process.env.SECURE_PIN_SALT || 'bin-cloud-secure'
  return createHash('sha256').update(salt + userId + pin).digest('hex')
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pin } = await req.json()
  if (!pin || typeof pin !== 'string') {
    return NextResponse.json({ ok: false, error: '비밀번호를 입력해주세요' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('secure_pin_hash')
    .eq('id', user.id)
    .single()

  if (!profile?.secure_pin_hash) {
    return NextResponse.json({ ok: false, error: '2차 비밀번호가 설정되지 않았습니다' }, { status: 400 })
  }

  const hash = hashPin(pin.trim(), user.id)
  const ok = hash === profile.secure_pin_hash
  return NextResponse.json({ ok })
}
