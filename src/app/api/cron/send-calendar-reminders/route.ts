import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendMail } from '@/lib/email'

type DbEvent = {
  id: string
  owner_id: string
  title: string
  notes: string | null
  start_at: string
  end_at: string | null
  all_day: boolean
  repeat_rule: any | null
  reminders: any | null
  location_text: string | null
  conference_url: string | null
}

function addDays(d: Date, days: number) {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}

function yyyyMmDdHm(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${dd} ${hh}:${mm}`
}

function expandOccurrences(ev: DbEvent, from: Date, to: Date) {
  const rr = ev.repeat_rule as any
  if (!rr || !rr.freq || rr.freq === 'none') {
    const only = new Date(ev.start_at)
    return only >= from && only <= to ? [only] : []
  }

  const baseStart = new Date(ev.start_at)
  const until = rr.until ? new Date(rr.until) : null
  const freq = String(rr.freq)

  const out: Date[] = []
  let cur = new Date(baseStart)

  const maxJump = 2000
  let jumped = 0
  while (cur < from && jumped < maxJump) {
    if (freq === 'daily') cur = addDays(cur, 1)
    else if (freq === 'weekly') cur = addDays(cur, 7)
    else if (freq === 'monthly') cur = new Date(cur.getFullYear(), cur.getMonth() + 1, cur.getDate(), cur.getHours(), cur.getMinutes(), 0, 0)
    else if (freq === 'yearly') cur = new Date(cur.getFullYear() + 1, cur.getMonth(), cur.getDate(), cur.getHours(), cur.getMinutes(), 0, 0)
    else break
    jumped++
  }

  while (cur <= to) {
    if (until && cur > until) break
    if (cur >= from) out.push(new Date(cur))

    if (freq === 'daily') cur = addDays(cur, 1)
    else if (freq === 'weekly') cur = addDays(cur, 7)
    else if (freq === 'monthly') cur = new Date(cur.getFullYear(), cur.getMonth() + 1, cur.getDate(), cur.getHours(), cur.getMinutes(), 0, 0)
    else if (freq === 'yearly') cur = new Date(cur.getFullYear() + 1, cur.getMonth(), cur.getDate(), cur.getHours(), cur.getMinutes(), 0, 0)
    else break
  }

  return out
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') || ''
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'missing supabase env' }, { status: 500 })
  }

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const now = new Date()
  const windowMinutes = Number(process.env.CALENDAR_REMINDER_WINDOW_MINUTES || '5')
  const windowFrom = new Date(now.getTime() - 60_000) // 1분 전부터
  const windowTo = new Date(now.getTime() + windowMinutes * 60_000)

  // 필요한 occurrence 생성 범위: "가장 긴 minutesBefore"까지 고려
  const maxMinutesBefore = 24 * 60 // 1일 전 알림까지
  const occFrom = new Date(windowFrom.getTime() - maxMinutesBefore * 60_000)
  const occTo = addDays(windowTo, 2)

  const { data: events, error: evErr } = await admin
    .from('calendar_events')
    .select('id, owner_id, title, notes, start_at, end_at, all_day, repeat_rule, reminders, location_text, conference_url')
    .or(`reminders.not.is.null`)
    .lte('start_at', occTo.toISOString())
    .limit(500)

  if (evErr) {
    return NextResponse.json({ error: evErr.message }, { status: 500 })
  }

  const rows = (events || []) as DbEvent[]
  const ownerIds = Array.from(new Set(rows.map((e) => e.owner_id).filter(Boolean)))

  const { data: profiles, error: profErr } = ownerIds.length
    ? await admin.from('profiles').select('id, email, name').in('id', ownerIds)
    : { data: [], error: null }

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 })
  }

  const emailByOwner = new Map<string, { email: string | null; name: string | null }>()
  for (const p of (profiles || []) as any[]) {
    emailByOwner.set(p.id, { email: p.email ?? null, name: p.name ?? null })
  }

  let checked = 0
  let due = 0
  let sent = 0
  const errors: any[] = []

  for (const ev of rows) {
    checked++
    const remindersArr = Array.isArray(ev.reminders) ? ev.reminders : []
    const minutesList = remindersArr
      .map((r: any) => Number(r?.minutesBefore))
      .filter((n: any) => Number.isFinite(n) && n >= 0)
      .slice(0, 10)

    if (minutesList.length === 0) continue

    const owner = emailByOwner.get(ev.owner_id)
    const toEmail = owner?.email || null
    if (!toEmail) continue

    const occurrences = expandOccurrences(ev, occFrom, occTo)
    const baseStart = new Date(ev.start_at)
    const baseEnd = ev.end_at ? new Date(ev.end_at) : null
    const durationMs = baseEnd ? Math.max(0, baseEnd.getTime() - baseStart.getTime()) : 0

    for (const occ of occurrences) {
      const occEnd = durationMs ? new Date(occ.getTime() + durationMs) : null

      for (const minutesBefore of minutesList) {
        const sendAt = new Date(occ.getTime() - minutesBefore * 60_000)
        if (sendAt < windowFrom || sendAt > windowTo) continue
        due++

        // 중복 발송 방지: 먼저 로그 insert 시도(성공 시에만 발송)
        const { data: logRow, error: logErr } = await admin
          .from('calendar_event_reminder_logs')
          .insert({
            owner_id: ev.owner_id,
            event_id: ev.id,
            occurrence_at: occ.toISOString(),
            minutes_before: minutesBefore,
            sent_at: null,
          })
          .select('id')
          .maybeSingle()

        if (logErr) {
          // UNIQUE 충돌은 이미 처리된 알림이므로 스킵
          if (logErr.message?.toLowerCase().includes('duplicate') || logErr.message?.includes('23505')) continue
          errors.push({ kind: 'log_insert', eventId: ev.id, message: logErr.message })
          continue
        }

        try {
          const when = ev.all_day ? `${occ.getFullYear()}-${String(occ.getMonth() + 1).padStart(2, '0')}-${String(occ.getDate()).padStart(2, '0')}` : yyyyMmDdHm(occ)
          const whereParts = [ev.location_text ? `장소: ${ev.location_text}` : null, ev.conference_url ? `링크: ${ev.conference_url}` : null].filter(Boolean)
          const where = whereParts.length ? `\n\n${whereParts.join('\n')}` : ''
          const memo = ev.notes ? `\n\n메모:\n${ev.notes}` : ''

          const subject = `일정 알림: ${ev.title}`
          const text =
            `${minutesBefore === 0 ? '곧 시작' : `${minutesBefore}분 후`} 일정이 있어요.\n\n` +
            `제목: ${ev.title}\n` +
            `시간: ${when}` +
            (occEnd && !ev.all_day ? ` ~ ${yyyyMmDdHm(occEnd)}` : '') +
            `${where}${memo}\n`

          await sendMail({ to: toEmail, subject, text })

          await admin.from('calendar_event_reminder_logs').update({ sent_at: new Date().toISOString() }).eq('id', (logRow as any)?.id)
          sent++
        } catch (e: any) {
          errors.push({ kind: 'send', eventId: ev.id, message: e?.message || String(e) })
          // 실패 시 재시도 가능하게 로그 삭제
          if ((logRow as any)?.id) {
            await admin.from('calendar_event_reminder_logs').delete().eq('id', (logRow as any).id)
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true, checked, due, sent, errorsCount: errors.length, errors: errors.slice(0, 20) })
}

