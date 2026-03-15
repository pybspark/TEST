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
  if (!pin || typeof pin !== 'string' || pin.length < 4 || pin.length > 12) {
    return NextResponse.json({ error: '비밀번호는 4~12자로 설정해주세요' }, { status: 400 })
  }

  const securePinHash = hashPin(pin.trim(), user.id)

  const { error } = await supabase
    .from('profiles')
    .update({ secure_pin_hash: securePinHash })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: '설정에 실패했습니다. profiles 테이블에 secure_pin_hash 컬럼이 있는지 확인해주세요.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
