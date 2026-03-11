'use client'

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatSingaporeDate } from '@/lib/timezone'
import type { Priority, RecurrencePattern } from '@/lib/db'

type Todo = {
  id: string
  title: string
  due_date: string | null
  priority: Priority
  is_recurring: boolean
  recurrence_pattern: RecurrencePattern | null
  completed: boolean
  created_at: string
  updated_at: string
}

type Holiday = {
  id: string
  date: string
  name: string
  observed: boolean
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const priorityColors: Record<Priority, string> = {
  high: '#f87171',
  medium: '#facc15',
  low: '#60a5fa',
}

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) {
    cells.push(null)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d)
  }
  while (cells.length % 7 !== 0) {
    cells.push(null)
  }
  return cells
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function todosForDate(todos: Todo[], dateKey: string): Todo[] {
  return todos.filter((t) => {
    if (!t.due_date) return false
    return t.due_date.startsWith(dateKey)
  })
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<main className="container"><p style={{ color: 'var(--muted)' }}>Loading calendar…</p></main>}>
      <CalendarContent />
    </Suspense>
  )
}

function CalendarContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const now = new Date()
  const sgNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }))

  const initialYear = parseInt(searchParams.get('month')?.split('-')[0] ?? '', 10) || sgNow.getFullYear()
  const initialMonth = parseInt(searchParams.get('month')?.split('-')[1] ?? '', 10) || (sgNow.getMonth() + 1)

  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [todos, setTodos] = useState<Todo[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const todayKey = formatDateKey(sgNow.getFullYear(), sgNow.getMonth() + 1, sgNow.getDate())
  const currentMonthStr = `${year}-${String(month).padStart(2, '0')}`

  const navigate = useCallback(
    (y: number, m: number) => {
      setYear(y)
      setMonth(m)
      setSelectedDay(null)
      const monthStr = `${y}-${String(m).padStart(2, '0')}`
      router.replace(`/calendar?month=${monthStr}`, { scroll: false })
    },
    [router]
  )

  const goToPrev = () => {
    const newMonth = month === 1 ? 12 : month - 1
    const newYear = month === 1 ? year - 1 : year
    navigate(newYear, newMonth)
  }

  const goToNext = () => {
    const newMonth = month === 12 ? 1 : month + 1
    const newYear = month === 12 ? year + 1 : year
    navigate(newYear, newMonth)
  }

  const goToToday = () => {
    navigate(sgNow.getFullYear(), sgNow.getMonth() + 1)
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/todos').then((r) => r.json()),
      fetch(`/api/holidays?year=${year}&month=${month}`).then((r) => r.json()),
    ])
      .then(([todosRes, holidaysRes]) => {
        if (todosRes.success) setTodos(todosRes.data)
        if (holidaysRes.success) setHolidays(holidaysRes.data)
      })
      .finally(() => setLoading(false))
  }, [year, month])

  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month])

  const holidayMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const h of holidays) {
      const arr = map[h.date] ?? []
      arr.push(h.name)
      map[h.date] = arr
    }
    return map
  }, [holidays])

  const selectedDateKey = selectedDay ? formatDateKey(year, month, selectedDay) : null
  const selectedTodos = selectedDateKey ? todosForDate(todos, selectedDateKey) : []
  const selectedHolidayNames = selectedDateKey ? (holidayMap[selectedDateKey] ?? []) : []

  return (
    <main className="container">
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>Calendar</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)' }}>
            Monthly view with todos and Singapore holidays.
          </p>
        </div>
        <a href="/" className="small-btn" style={{ textDecoration: 'none', padding: '0.5rem 1rem' }}>
          ← Todos
        </a>
      </header>

      <section className="card">
        <div className="cal-nav">
          <button className="small-btn" onClick={goToPrev} aria-label="Previous month">◀</button>
          <h2 className="cal-nav__title">{MONTH_NAMES[month - 1]} {year}</h2>
          <button className="small-btn" onClick={goToToday} aria-label="Today">Today</button>
          <button className="small-btn" onClick={goToNext} aria-label="Next month">▶</button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem 0' }}>Loading…</p>
        ) : (
          <div className="cal-grid" role="grid" aria-label={`${MONTH_NAMES[month - 1]} ${year}`}>
            {DAY_NAMES.map((d) => (
              <div key={d} className="cal-grid__header" role="columnheader">{d}</div>
            ))}
            {calendarDays.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="cal-cell cal-cell--empty" />
              }

              const dateKey = formatDateKey(year, month, day)
              const dayTodos = todosForDate(todos, dateKey)
              const dayHolidays = holidayMap[dateKey] ?? []
              const isToday = dateKey === todayKey
              const dayOfWeek = new Date(year, month - 1, day).getDay()
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
              const isSelected = selectedDay === day

              return (
                <button
                  key={day}
                  className={[
                    'cal-cell',
                    isToday ? 'cal-cell--today' : '',
                    isWeekend ? 'cal-cell--weekend' : '',
                    dayHolidays.length > 0 ? 'cal-cell--holiday' : '',
                    isSelected ? 'cal-cell--selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setSelectedDay(day)}
                  aria-label={`${MONTH_NAMES[month - 1]} ${day}, ${year}${dayTodos.length > 0 ? `, ${dayTodos.length} todo${dayTodos.length > 1 ? 's' : ''}` : ''}${dayHolidays.length > 0 ? `, ${dayHolidays.join(', ')}` : ''}`}
                  role="gridcell"
                >
                  <span className={`cal-cell__day ${isToday ? 'cal-cell__day--today' : ''}`}>{day}</span>
                  {dayHolidays.length > 0 ? (
                    <span className="cal-cell__holiday" title={dayHolidays.join(', ')}>
                      {dayHolidays[0].length > 10 ? dayHolidays[0].slice(0, 10) + '…' : dayHolidays[0]}
                    </span>
                  ) : null}
                  {dayTodos.length > 0 ? (
                    <span className="cal-cell__count">{dayTodos.length}</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {selectedDay !== null ? (
        <div className="modal-backdrop" onClick={() => setSelectedDay(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {MONTH_NAMES[month - 1]} {selectedDay}, {year}
              </h3>
              <button className="close-button" onClick={() => setSelectedDay(null)} aria-label="Close">
                ×
              </button>
            </div>

            {selectedHolidayNames.length > 0 ? (
              <div style={{ marginBottom: '0.75rem' }}>
                {selectedHolidayNames.map((name) => (
                  <span key={name} className="badge" style={{ marginRight: 6, background: 'rgba(250, 204, 21, 0.2)', color: '#fef3c7' }}>
                    🇸🇬 {name}
                  </span>
                ))}
              </div>
            ) : null}

            {selectedTodos.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>No todos on this date.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {selectedTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="todo-item"
                    style={{ gridTemplateColumns: 'min-content 1fr' }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: priorityColors[todo.priority],
                        marginTop: 5,
                      }}
                    />
                    <div>
                      <p className="todo-item__title" style={{ textDecoration: todo.completed ? 'line-through' : 'none', opacity: todo.completed ? 0.6 : 1 }}>
                        {todo.title}
                      </p>
                      <div className="todo-item__meta">
                        <span className={`badge badge--${todo.priority}`}>
                          {todo.priority.charAt(0).toUpperCase() + todo.priority.slice(1)}
                        </span>
                        {todo.is_recurring && todo.recurrence_pattern ? (
                          <span className="badge" style={{ marginLeft: 8 }}>
                            🔄 {todo.recurrence_pattern}
                          </span>
                        ) : null}
                        {todo.due_date ? (
                          <span style={{ marginLeft: 8 }}>
                            {formatSingaporeDate(new Date(todo.due_date))}
                          </span>
                        ) : null}
                        {todo.completed ? (
                          <span style={{ marginLeft: 8, color: 'var(--success)' }}>✓ Completed</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  )
}
