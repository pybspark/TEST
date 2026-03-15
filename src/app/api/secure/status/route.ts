import { createServerSupabase } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ hasPin: false }, { status: 200 })

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('secure_pin_hash')
      .eq('id', user.id)
      .maybeSingle()

    if (error) return NextResponse.json({ hasPin: false }, { status: 200 })
    return NextResponse.json({ hasPin: Boolean(profile?.secure_pin_hash) })
  } catch {
    return NextResponse.json({ hasPin: false }, { status: 200 })
  }
}
