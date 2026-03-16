'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, Plus, X, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type CalEvent = {
  id: string
  title: string
  notes: string | null
  start_at: string
  end_at: string | null
  all_day: boolean
  color: string
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

export default function CalendarPage() {
  const supabase = createClient()
  const [cursorMonth, setCursorMonth] = useState(() => startOfMonth(new Date()))
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<CalEvent[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CalEvent | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formDate, setFormDate] = useState(() => yyyyMmDd(new Date()))
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

  async function fetchEvents() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setEvents([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('calendar_events')
      .select('id, title, notes, start_at, end_at, all_day, color')
      .eq('owner_id', user.id)
      .gte('start_at', range.from.toISOString())
      .lte('start_at', addDays(range.to, 1).toISOString())
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
    fetchEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorMonth])

  function openCreate(date: Date) {
    setEditing(null)
    setFormTitle('')
    setFormNotes('')
    setFormDate(yyyyMmDd(date))
    setModalOpen(true)
  }

  function openEdit(ev: CalEvent) {
    setEditing(ev)
    setFormTitle(ev.title)
    setFormNotes(ev.notes ?? '')
    setFormDate(yyyyMmDd(new Date(ev.start_at)))
    setModalOpen(true)
  }

  async function save() {
    const trimmed = formTitle.trim()
    if (!trimmed) return toast.error('제목을 입력해 주세요')
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return toast.error('로그인이 필요해요')

      const start = new Date(`${formDate}T09:00:00`)
      if (!editing) {
        const { error } = await supabase.from('calendar_events').insert({
          owner_id: user.id,
          title: trimmed,
          notes: formNotes.trim() || null,
          start_at: start.toISOString(),
          all_day: true,
          color: 'blue',
        })
        if (error) throw error
        toast.success('일정이 추가되었어요')
      } else {
        const { error } = await supabase.from('calendar_events').update({
          title: trimmed,
          notes: formNotes.trim() || null,
          start_at: start.toISOString(),
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
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
            const dayEvents = eventsByDay.get(key) || []
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
                      className="px-2 py-1 rounded-lg bg-brand-50 text-brand-700 text-[11px] font-medium truncate"
                      title={ev.title}
                    >
                      {ev.title}
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
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
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

