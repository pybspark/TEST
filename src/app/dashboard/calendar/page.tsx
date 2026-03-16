'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Trash2,
  Link as LinkIcon,
  Calendar as CalendarIcon,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'

type CalEvent = {
  id: string
  title: string
  notes: string | null
  attachment_url?: string | null
  attachment_memo?: string | null
  calendar_id?: string | null
  location_text?: string | null
  conference_url?: string | null
  repeat_rule?: any | null
  reminders?: any | null
  start_at: string
  end_at: string | null
  all_day: boolean
  color: string
}

type CalendarRow = {
  id: string
  name: string
  color: string
  is_visible: boolean
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}
function startOfWeek(d: Date) {
  const copy = new Date(d)
  const day = copy.getDay() // 0 Sun
  copy.setDate(copy.getDate() - day)
  copy.setHours(0, 0, 0, 0)
  return copy
}
function addDays(d: Date, days: number) {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function yyyyMmDd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function toLocalDateInputValue(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function toLocalTimeInputValue(d: Date) {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function parseLocalDateTime(dateStr: string, timeStr: string) {
  // dateStr: YYYY-MM-DD, timeStr: HH:mm
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0)
}

export default function CalendarPage() {
  const supabase = createClient()
  const [cursorMonth, setCursorMonth] = useState(() => startOfMonth(new Date()))
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<CalEvent[]>([])
  const [calendars, setCalendars] = useState<CalendarRow[]>([])
  const [calLoading, setCalLoading] = useState(true)
  const [newCalName, setNewCalName] = useState('')
  const [newCalColor, setNewCalColor] = useState('blue')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CalEvent | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formAttachmentUrl, setFormAttachmentUrl] = useState('')
  const [formAttachmentMemo, setFormAttachmentMemo] = useState('')
  const [formAllDay, setFormAllDay] = useState(true)
  const [formStartDate, setFormStartDate] = useState(() => toLocalDateInputValue(new Date()))
  const [formStartTime, setFormStartTime] = useState(() => '09:00')
  const [formEndDate, setFormEndDate] = useState(() => toLocalDateInputValue(new Date()))
  const [formEndTime, setFormEndTime] = useState(() => '10:00')
  const [formCalendarId, setFormCalendarId] = useState<string | null>(null)
  const [formLocation, setFormLocation] = useState('')
  const [formConferenceUrl, setFormConferenceUrl] = useState('')
  const [formRepeatFreq, setFormRepeatFreq] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('none')
  const [formRepeatUntil, setFormRepeatUntil] = useState<string>('') // YYYY-MM-DD
  const [formReminders, setFormReminders] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const range = useMemo(() => {
    const from = startOfWeek(startOfMonth(cursorMonth))
    const to = addDays(startOfWeek(endOfMonth(cursorMonth)), 6)
    return { from, to }
  }, [cursorMonth])

  const days = useMemo(() => {
    const out: Date[] = []
    let d = new Date(range.from)
    while (d <= range.to) {
      out.push(new Date(d))
      d = addDays(d, 1)
    }
    return out
  }, [range])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const ev of events) {
      const key = yyyyMmDd(new Date(ev.start_at))
      const arr = map.get(key) || []
      arr.push(ev)
      map.set(key, arr)
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      map.set(k, arr)
    }
    return map
  }, [events])

  const visibleCalendarIds = useMemo(() => {
    return new Set(calendars.filter((c) => c.is_visible).map((c) => c.id))
  }, [calendars])

  function expandRepeatsForRange(source: CalEvent[]) {
    const out: any[] = []
    for (const ev of source) {
      const rr = ev.repeat_rule as any
      if (!rr || !rr.freq || rr.freq === 'none') {
        out.push(ev)
        continue
      }

      const baseStart = new Date(ev.start_at)
      const baseEnd = ev.end_at ? new Date(ev.end_at) : null
      const durationMs = baseEnd ? Math.max(0, baseEnd.getTime() - baseStart.getTime()) : 0
      const until = rr.until ? new Date(rr.until) : null
      const freq = String(rr.freq)

      let cur = new Date(baseStart)

      // cur를 range.from 근처로 이동(성능/무한루프 방지용)
      const maxJump = 800
      let jumped = 0
      while (cur < range.from && jumped < maxJump) {
        if (freq === 'daily') cur = addDays(cur, 1)
        else if (freq === 'weekly') cur = addDays(cur, 7)
        else if (freq === 'monthly') cur = new Date(cur.getFullYear(), cur.getMonth() + 1, cur.getDate(), cur.getHours(), cur.getMinutes(), 0, 0)
        else if (freq === 'yearly') cur = new Date(cur.getFullYear() + 1, cur.getMonth(), cur.getDate(), cur.getHours(), cur.getMinutes(), 0, 0)
        else break
        jumped++
      }

      while (cur <= range.to) {
        if (until && cur > until) break
        if (cur >= range.from) {
          const occStart = new Date(cur)
          const occEnd = durationMs ? new Date(occStart.getTime() + durationMs) : null
          out.push({
            ...ev,
            id: `${ev.id}::${yyyyMmDd(occStart)}`,
            start_at: occStart.toISOString(),
            end_at: occEnd ? occEnd.toISOString() : null,
            _base_id: ev.id,
            _occurrence_start: occStart.toISOString(),
          })
        }
        if (freq === 'daily') cur = addDays(cur, 1)
        else if (freq === 'weekly') cur = addDays(cur, 7)
        else if (freq === 'monthly') cur = new Date(cur.getFullYear(), cur.getMonth() + 1, cur.getDate(), cur.getHours(), cur.getMinutes(), 0, 0)
        else if (freq === 'yearly') cur = new Date(cur.getFullYear() + 1, cur.getMonth(), cur.getDate(), cur.getHours(), cur.getMinutes(), 0, 0)
        else break
      }
    }
    return out as CalEvent[]
  }

  const expandedEvents = useMemo(() => expandRepeatsForRange(events), [events, range.from.getTime(), range.to.getTime()])

  const filteredEvents = useMemo(() => {
    const source = expandedEvents
    if (calendars.length === 0) return source
    return source.filter((e) => !e.calendar_id || visibleCalendarIds.has(e.calendar_id))
  }, [expandedEvents, calendars, visibleCalendarIds])

  const filteredEventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const ev of filteredEvents) {
      const key = yyyyMmDd(new Date(ev.start_at))
      const arr = map.get(key) || []
      arr.push(ev)
      map.set(key, arr)
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      map.set(k, arr)
    }
    return map
  }, [filteredEvents])

  function calendarDotColor(color: string) {
    switch ((color || '').toLowerCase()) {
      case 'red': return 'bg-red-500'
      case 'orange': return 'bg-orange-500'
      case 'yellow': return 'bg-yellow-500'
      case 'green': return 'bg-emerald-500'
      case 'blue': return 'bg-blue-500'
      case 'purple': return 'bg-violet-500'
      case 'pink': return 'bg-pink-500'
      case 'gray': return 'bg-gray-500'
      default: return 'bg-blue-500'
    }
  }

  async function fetchCalendars() {
    setCalLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setCalendars([])
      setCalLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('calendars')
      .select('id, name, color, is_visible')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
    if (error) {
      if (error.message?.includes('calendars') || error.message?.includes('relation') || error.message?.includes('schema cache')) {
        toast.info('캘린더 목록 기능을 쓰려면 Supabase에서 add_calendars_and_event_fields.sql을 실행해주세요.')
      } else {
        toast.error('캘린더 목록을 불러오지 못했어요')
      }
      setCalendars([])
      setCalLoading(false)
      return
    }
    const rows = (data || []) as CalendarRow[]
    setCalendars(rows)
    if (!formCalendarId && rows.length > 0) setFormCalendarId(rows[0].id)
    setCalLoading(false)
  }

  async function createCalendar() {
    const name = newCalName.trim()
    if (!name) return toast.error('캘린더 이름을 입력해 주세요')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return toast.error('로그인이 필요해요')
    const { error } = await supabase.from('calendars').insert({
      owner_id: user.id,
      name,
      color: newCalColor,
      is_visible: true,
    })
    if (error) return toast.error(error.message || '생성 실패')
    toast.success('캘린더가 추가되었어요')
    setNewCalName('')
    fetchCalendars()
  }

  async function toggleCalendarVisible(cal: CalendarRow) {
    const { error } = await supabase.from('calendars').update({ is_visible: !cal.is_visible }).eq('id', cal.id)
    if (error) return toast.error('표시 설정 실패')
    setCalendars((prev) => prev.map((c) => (c.id === cal.id ? { ...c, is_visible: !c.is_visible } : c)))
  }

  async function fetchEvents() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setEvents([])
      setLoading(false)
      return
    }

    const fromIso = range.from.toISOString()
    const toPlus = addDays(range.to, 1).toISOString()
    const { data, error } = await supabase
      .from('calendar_events')
      .select('id, title, notes, attachment_url, attachment_memo, calendar_id, location_text, conference_url, repeat_rule, reminders, start_at, end_at, all_day, color')
      .eq('owner_id', user.id)
      // 반복 일정은 시작일이 과거여도 이번 달에 표시해야 함
      .or(`and(repeat_rule.is.null,start_at.gte.${fromIso},start_at.lte.${toPlus}),and(repeat_rule.not.is.null,start_at.lte.${toPlus})`)
      .order('start_at', { ascending: true })

    if (error) {
      if (error.message?.includes('calendar_events') || error.message?.includes('relation') || error.message?.includes('schema cache')) {
        toast.info('캘린더 기능을 쓰려면 Supabase에서 add_calendar_events.sql을 실행해주세요.')
      } else {
        toast.error('일정을 불러오지 못했어요')
      }
      setEvents([])
      setLoading(false)
      return
    }
    setEvents((data || []) as CalEvent[])
    setLoading(false)
  }

  useEffect(() => {
    fetchCalendars()
    fetchEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorMonth])

  function openCreate(date: Date) {
    setEditing(null)
    setFormTitle('')
    setFormNotes('')
    setFormAttachmentUrl('')
    setFormAttachmentMemo('')
    setFormAllDay(true)
    setFormStartDate(toLocalDateInputValue(date))
    setFormStartTime('09:00')
    setFormEndDate(toLocalDateInputValue(date))
    setFormEndTime('10:00')
    setFormLocation('')
    setFormConferenceUrl('')
    setFormRepeatFreq('none')
    setFormRepeatUntil('')
    setFormReminders([])
    setModalOpen(true)
  }

  function openEdit(ev: CalEvent) {
    const baseId = (ev as any)?._base_id as string | undefined
    const target = baseId ? (events.find((e) => e.id === baseId) || ev) : ev

    setEditing(target)
    setFormTitle(target.title)
    setFormNotes(target.notes ?? '')
    setFormAttachmentUrl(target.attachment_url ?? '')
    setFormAttachmentMemo(target.attachment_memo ?? '')
    setFormAllDay(!!target.all_day)
    const start = new Date(target.start_at)
    const end = target.end_at ? new Date(target.end_at) : new Date(target.start_at)
    setFormStartDate(toLocalDateInputValue(start))
    setFormStartTime(toLocalTimeInputValue(start))
    setFormEndDate(toLocalDateInputValue(end))
    setFormEndTime(toLocalTimeInputValue(end))
    setFormCalendarId(target.calendar_id ?? null)
    setFormLocation(target.location_text ?? '')
    setFormConferenceUrl(target.conference_url ?? '')
    const rr = target.repeat_rule as any
    setFormRepeatFreq((rr?.freq as any) || 'none')
    setFormRepeatUntil(rr?.until ? toLocalDateInputValue(new Date(rr.until)) : '')
    const rem = Array.isArray(target.reminders) ? target.reminders : []
    setFormReminders(rem.map((r: any) => Number(r?.minutesBefore)).filter((n: any) => Number.isFinite(n)))
    setModalOpen(true)
  }

  async function save() {
    const trimmed = formTitle.trim()
    if (!trimmed) return toast.error('제목을 입력해 주세요')
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return toast.error('로그인이 필요해요')

      const start = formAllDay
        ? parseLocalDateTime(formStartDate, '00:00')
        : parseLocalDateTime(formStartDate, formStartTime)
      const end = formAllDay
        ? null
        : parseLocalDateTime(formEndDate, formEndTime)

      if (end && end.getTime() < start.getTime()) {
        toast.error('종료 시간이 시작 시간보다 빠를 수 없어요')
        setSaving(false)
        return
      }

      const selectedCal = formCalendarId ? calendars.find((c) => c.id === formCalendarId) : null
      const eventColor = selectedCal?.color || 'blue'

      const repeat_rule = formRepeatFreq === 'none'
        ? null
        : {
            freq: formRepeatFreq,
            interval: 1,
            until: formRepeatUntil ? parseLocalDateTime(formRepeatUntil, '23:59').toISOString() : null,
          }

      const reminders = (formReminders || [])
        .filter((n) => Number.isFinite(n) && n >= 0)
        .sort((a, b) => a - b)
        .map((minutesBefore) => ({ minutesBefore }))

      if (!editing) {
        const { error } = await supabase.from('calendar_events').insert({
          owner_id: user.id,
          calendar_id: formCalendarId,
          title: trimmed,
          notes: formNotes.trim() || null,
          attachment_url: formAttachmentUrl.trim() || null,
          attachment_memo: formAttachmentMemo.trim() || null,
          location_text: formLocation.trim() || null,
          conference_url: formConferenceUrl.trim() || null,
          repeat_rule,
          reminders,
          start_at: start.toISOString(),
          end_at: end ? end.toISOString() : null,
          all_day: !!formAllDay,
          color: eventColor,
        })
        if (error) throw error
        toast.success('일정이 추가되었어요')
      } else {
        const { error } = await supabase.from('calendar_events').update({
          calendar_id: formCalendarId,
          title: trimmed,
          notes: formNotes.trim() || null,
          attachment_url: formAttachmentUrl.trim() || null,
          attachment_memo: formAttachmentMemo.trim() || null,
          location_text: formLocation.trim() || null,
          conference_url: formConferenceUrl.trim() || null,
          repeat_rule,
          reminders,
          start_at: start.toISOString(),
          end_at: end ? end.toISOString() : null,
          all_day: !!formAllDay,
          color: eventColor,
          updated_at: new Date().toISOString(),
        }).eq('id', editing.id)
        if (error) throw error
        toast.success('일정이 수정되었어요')
      }
      setModalOpen(false)
      fetchEvents()
    } catch (e: any) {
      toast.error(e?.message || '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!editing) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('calendar_events').delete().eq('id', editing.id)
      if (error) throw error
      toast.success('삭제되었어요')
      setModalOpen(false)
      fetchEvents()
    } catch (e: any) {
      toast.error(e?.message || '삭제 실패')
    } finally {
      setDeleting(false)
    }
  }

  const monthTitle = `${cursorMonth.getFullYear()}년 ${cursorMonth.getMonth() + 1}월`
  const today = new Date()
  const weekLabels = ['일', '월', '화', '수', '목', '금', '토']

  function chipClass(color: string) {
    switch ((color || '').toLowerCase()) {
      case 'red': return 'bg-red-50 text-red-700'
      case 'orange': return 'bg-orange-50 text-orange-700'
      case 'yellow': return 'bg-yellow-50 text-yellow-800'
      case 'green': return 'bg-emerald-50 text-emerald-700'
      case 'blue': return 'bg-brand-50 text-brand-700'
      case 'purple': return 'bg-violet-50 text-violet-700'
      case 'pink': return 'bg-pink-50 text-pink-700'
      case 'gray': return 'bg-gray-100 text-gray-700'
      default: return 'bg-brand-50 text-brand-700'
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">캘린더</h1>
          <p className="text-sm text-gray-500 mt-0.5">내 일정을 한 눈에 관리하세요</p>
        </div>
        <button
          type="button"
          onClick={() => openCreate(new Date())}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" />
          일정 추가
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[260px_1fr] items-start">
        {/* 캘린더 목록 */}
        <aside className="hidden md:block">
          <div className="bg-white/80 backdrop-blur border border-white/60 rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-gray-600" />
                캘린더
              </p>
            </div>

            <div className="space-y-1.5 mb-4">
              {calLoading ? (
                <p className="text-xs text-gray-400">불러오는 중…</p>
              ) : calendars.length === 0 ? (
                <p className="text-xs text-gray-400">캘린더가 없어요</p>
              ) : (
                calendars.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCalendarVisible(c)}
                    className="w-full flex items-center justify-between px-2 py-2 rounded-xl hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full ${calendarDotColor(c.color)}`} />
                      <span className="text-sm text-gray-800 truncate">{c.name}</span>
                    </span>
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center ${c.is_visible ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {c.is_visible ? <Check className="w-3.5 h-3.5" /> : null}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700">새 캘린더</p>
              <input
                type="text"
                value={newCalName}
                onChange={(e) => setNewCalName(e.target.value)}
                placeholder="예: 개인, 직장"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <div className="flex gap-2">
                <select
                  value={newCalColor}
                  onChange={(e) => setNewCalColor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                >
                  <option value="blue">파랑</option>
                  <option value="green">초록</option>
                  <option value="red">빨강</option>
                  <option value="orange">주황</option>
                  <option value="yellow">노랑</option>
                  <option value="purple">보라</option>
                  <option value="pink">핑크</option>
                  <option value="gray">회색</option>
                </select>
                <button
                  type="button"
                  onClick={createCalendar}
                  className="px-3 py-2 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-800"
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* 월간 그리드 */}
        <div className="bg-white/80 backdrop-blur border border-white/60 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <button
              type="button"
              onClick={() => setCursorMonth(startOfMonth(new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() - 1, 1)))}
              className="p-2 rounded-lg hover:bg-gray-50 text-gray-600"
              aria-label="이전 달"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <p className="text-sm font-semibold text-gray-900">{monthTitle}</p>
            <button
              type="button"
              onClick={() => setCursorMonth(startOfMonth(new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() + 1, 1)))}
              className="p-2 rounded-lg hover:bg-gray-50 text-gray-600"
              aria-label="다음 달"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 bg-white">
            {weekLabels.map((w) => (
              <div key={w} className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100">
                {w}
              </div>
            ))}
            {days.map((d) => {
              const inMonth = d.getMonth() === cursorMonth.getMonth()
              const key = yyyyMmDd(d)
              const dayEvents = filteredEventsByDay.get(key) || []
              const isToday = isSameDay(d, today)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => openCreate(d)}
                  className={`text-left min-h-[92px] px-3 py-2 border-b border-gray-100 border-r border-gray-100 hover:bg-gray-50 transition-colors ${
                    !inMonth ? 'bg-gray-50/50 text-gray-400' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${isToday ? 'text-brand-600' : 'text-gray-700'}`}>
                      {d.getDate()}
                    </span>
                    {isToday && <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />}
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(ev) }}
                        className={`px-2 py-1 rounded-lg text-[11px] font-medium truncate ${chipClass(ev.color)}`}
                        title={ev.title}
                      >
                        <span className="inline-flex items-center gap-1">
                          {ev.attachment_url && <LinkIcon className="w-3 h-3" />}
                          {ev.title}
                        </span>
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <p className="text-[10px] text-gray-400">+{dayEvents.length - 2}개 더</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {loading && (
        <p className="text-xs text-gray-400 mt-3">불러오는 중…</p>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">{editing ? '일정 수정' : '일정 추가'}</p>
              <button type="button" onClick={() => setModalOpen(false)} className="p-2 rounded-lg hover:bg-gray-50 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">날짜</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2 flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                    <span className="text-sm text-gray-700">하루 종일</span>
                    <button
                      type="button"
                      onClick={() => setFormAllDay((v) => !v)}
                      className={`w-12 h-7 rounded-full transition-colors relative ${formAllDay ? 'bg-gray-900' : 'bg-gray-300'}`}
                      aria-pressed={formAllDay}
                    >
                      <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform ${formAllDay ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">시작</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={formStartDate}
                        onChange={(e) => setFormStartDate(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      />
                      {!formAllDay && (
                        <input
                          type="time"
                          value={formStartTime}
                          onChange={(e) => setFormStartTime(e.target.value)}
                          className="w-[120px] px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">종료</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={formEndDate}
                        onChange={(e) => setFormEndDate(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      />
                      {!formAllDay && (
                        <input
                          type="time"
                          value={formEndTime}
                          onChange={(e) => setFormEndTime(e.target.value)}
                          className="w-[120px] px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {calendars.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">캘린더</label>
                  <select
                    value={formCalendarId ?? ''}
                    onChange={(e) => setFormCalendarId(e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                  >
                    {calendars.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">제목</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="예: 가족 모임"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">메모 (선택)</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">위치 (선택)</label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="예: 강남역"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">영상통화 링크 (선택)</label>
                  <input
                    type="url"
                    value={formConferenceUrl}
                    onChange={(e) => setFormConferenceUrl(e.target.value)}
                    placeholder="예: https://meet.google.com/..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">반복</label>
                  <select
                    value={formRepeatFreq}
                    onChange={(e) => setFormRepeatFreq(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                  >
                    <option value="none">안 함</option>
                    <option value="daily">매일</option>
                    <option value="weekly">매주</option>
                    <option value="monthly">매월</option>
                    <option value="yearly">매년</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">반복 종료 (선택)</label>
                  <input
                    type="date"
                    value={formRepeatUntil}
                    onChange={(e) => setFormRepeatUntil(e.target.value)}
                    disabled={formRepeatFreq === 'none'}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">알림</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '없음', v: -1 },
                    { label: '정시', v: 0 },
                    { label: '10분 전', v: 10 },
                    { label: '30분 전', v: 30 },
                    { label: '1시간 전', v: 60 },
                    { label: '하루 전', v: 1440 },
                  ].map((opt) => {
                    const active = opt.v === -1 ? formReminders.length === 0 : formReminders.includes(opt.v)
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => {
                          if (opt.v === -1) return setFormReminders([])
                          setFormReminders((prev) => prev.includes(opt.v) ? prev.filter((x) => x !== opt.v) : [...prev, opt.v])
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                          active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="pt-1">
                <label className="block text-xs font-semibold text-gray-700 mb-2">첨부 파일</label>
                <div className="space-y-2">
                  <input
                    type="url"
                    value={formAttachmentUrl}
                    onChange={(e) => setFormAttachmentUrl(e.target.value)}
                    placeholder="URL"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <input
                    type="text"
                    value={formAttachmentMemo}
                    onChange={(e) => setFormAttachmentMemo(e.target.value)}
                    placeholder="메모"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
              {editing ? (
                <button
                  type="button"
                  onClick={remove}
                  disabled={deleting}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-60"
                >
                  {saving ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

