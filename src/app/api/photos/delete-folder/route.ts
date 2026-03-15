import { createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  let body: { folderId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청이에요' }, { status: 400 })
  }
  const folderId = body.folderId
  if (!folderId || typeof folderId !== 'string') {
    return NextResponse.json({ error: 'folderId가 필요해요' }, { status: 400 })
  }

  const { data: folder, error: folderError } = await supabase
    .from('photo_folders')
    .select('id')
    .eq('id', folderId)
    .eq('owner_id', user.id)
    .single()

  if (folderError || !folder) {
    return NextResponse.json({ error: '폴더를 찾을 수 없거나 권한이 없어요' }, { status: 404 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error: updateError } = await admin
    .from('files')
    .update({ photo_folder_id: null })
    .eq('photo_folder_id', folderId)

  if (updateError) {
    console.error('photos delete-folder: files update failed', updateError)
    return NextResponse.json({ error: '폴더 안 사진을 밖으로 옮기지 못했어요' }, { status: 500 })
  }

  const { error: deleteError } = await admin
    .from('photo_folders')
    .delete()
    .eq('id', folderId)

  if (deleteError) {
    console.error('photos delete-folder: folder delete failed', deleteError)
    return NextResponse.json({ error: '폴더를 삭제하지 못했어요' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
