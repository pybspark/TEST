import { createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

const BUCKET = 'family-files'
const PREVIEW_PREFIX = 'previews/'
const SIGNED_EXPIRES = 3600 // 1시간

function previewKey(storagePath: string): string {
  const hash = createHash('sha256').update(storagePath).digest('hex')
  return `${PREVIEW_PREFIX}${hash}.pdf`
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  let body: { storagePath?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청이에요' }, { status: 400 })
  }
  const storagePath = body.storagePath
  if (!storagePath || typeof storagePath !== 'string') {
    return NextResponse.json({ error: 'storagePath가 필요해요' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: fileRow, error: fileError } = await admin
    .from('files')
    .select('owner_id, is_secure')
    .eq('storage_path', storagePath)
    .single()

  if (fileError || !fileRow || fileRow.owner_id !== user.id) {
    return NextResponse.json({ error: '파일에 접근할 수 없어요' }, { status: 403 })
  }

  const key = previewKey(storagePath)

  const { data: list } = await admin.storage.from(BUCKET).list(PREVIEW_PREFIX)
  const fileName = key.replace(PREVIEW_PREFIX, '')
  const exists = list?.some((f) => f.name === fileName) ?? false

  if (exists) {
    const { data: signed, error: signedError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(key, SIGNED_EXPIRES)
    if (signedError || !signed?.signedUrl) {
      return NextResponse.json({ error: '미리보기 URL을 만들 수 없어요' }, { status: 500 })
    }
    return NextResponse.json({ url: signed.signedUrl })
  }

  const gotenbergUrl = process.env.GOTENBERG_URL?.trim()
  if (!gotenbergUrl) {
    return NextResponse.json(
      { error: 'CONVERSION_UNAVAILABLE', message: '문서 미리보기 서비스가 설정되지 않았어요' },
      { status: 503 }
    )
  }

  const { data: fileBlob, error: downloadError } = await admin.storage
    .from(BUCKET)
    .download(storagePath)

  if (downloadError || !fileBlob) {
    return NextResponse.json({ error: '원본 파일을 불러올 수 없어요' }, { status: 500 })
  }

  const form = new FormData()
  form.append('files', fileBlob as Blob)

  let res: Response
  try {
    res = await fetch(`${gotenbergUrl.replace(/\/$/, '')}/forms/libreoffice/convert`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(60000),
    })
  } catch (e) {
    console.error('Gotenberg request failed:', e)
    return NextResponse.json(
      { error: '변환 서비스에 연결할 수 없어요' },
      { status: 502 }
    )
  }

  if (!res.ok) {
    const text = await res.text()
    console.error('Gotenberg error:', res.status, text)
    return NextResponse.json({ error: '문서 변환에 실패했어요' }, { status: 502 })
  }

  const pdfBlob = await res.blob()
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(key, pdfBlob, { contentType: 'application/pdf', upsert: true })

  if (uploadError) {
    console.error('Preview upload failed:', uploadError)
    return NextResponse.json({ error: '미리보기 저장에 실패했어요' }, { status: 500 })
  }

  const { data: signed, error: signedError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(key, SIGNED_EXPIRES)

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: '미리보기 URL을 만들 수 없어요' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl })
}
