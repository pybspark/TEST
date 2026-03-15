import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// 파일 공개 URL (버킷이 Public일 때만 동작)
export function getFileUrl(bucket: string, path: string) {
  const supabase = createClient()
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

// 서명된 URL (버킷이 Private이어도 로그인 사용자 권한으로 일정 시간만 접근 가능, 보안 권장)
export async function getSignedFileUrl(bucket: string, path: string, expiresIn = 60): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

// 파일 크기 포맷
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
