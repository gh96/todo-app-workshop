'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { formatSingaporeDate, formatSingaporeForInput, getSingaporeNow } from '@/lib/timezone'
import type { Priority, RecurrencePattern } from '@/lib/db'
import { filterTodosByPriority, sortTodosByPriority } from '@/lib/priority'
import { formatReminderLabel, REMINDER_MINUTES_OPTIONS } from '@/lib/reminders'
import { useNotifications } from '@/lib/hooks/useNotifications'

type Tag = {
  id: string
  name: string
  color: string
}

type Todo = {
  id: string
  title: string
  due_date: string | null
  priority: Priority
  is_recurring: boolean
  recurrence_pattern: RecurrencePattern | null
  reminder_minutes: number | null
  last_notification_sent: string | null
  completed: boolean
  created_at: string
  updated_at: string
  tags?: Tag[]
}

const priorityLabels: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const priorityClasses: Record<Priority, string> = {
  high: 'badge--high',
  medium: 'badge--medium',
  low: 'badge--low',
}

function isOverdue(todo: Todo): boolean {
  if (todo.completed) return false
  if (!todo.due_date) return false
  const now = getSingaporeNow().getTime()
  const due = Date.parse(todo.due_date)
  return due < now
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
]

function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debouncedValue
}

export default function Page() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState<string>('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('daily')
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null)
  const [selectedPriority, setSelectedPriority] = useState<Priority | 'all'>('all')
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 300)
  const [editing, setEditing] = useState<Todo | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Todo | null>(null)
  const { isSupported, permission, enableNotifications } = useNotifications()
  const [manageTagsOpen, setManageTagsOpen] = useState(false)
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())
  const [tagFormName, setTagFormName] = useState('')
  const [tagFormColor, setTagFormColor] = useState('#6b7280')
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagName, setEditingTagName] = useState('')
  const [editingTagColor, setEditingTagColor] = useState('')
  const [tagError, setTagError] = useState<string | null>(null)

  const fetchTodos = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/todos')
      const body = await res.json()
      if (!res.ok || !body.success) {
        throw new Error(body?.error ?? 'Failed to fetch todos')
      }
      setTodos(sortTodosByPriority(body.data))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags')
      const body = await res.json()
      if (res.ok && body.success) setTags(body.data)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchTodos()
  }, [])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  const filteredByPriority = useMemo(
    () => filterTodosByPriority(todos, selectedPriority),
    [todos, selectedPriority]
  )

  const filteredBySearch = useMemo(() => {
    if (!debouncedSearch.trim()) return filteredByPriority
    const q = debouncedSearch.trim().toLowerCase()
    return filteredByPriority.filter((t) => {
      const titleMatch = t.title.toLowerCase().includes(q)
      const tagMatch = (t.tags ?? []).some((tag) => tag.name.toLowerCase().includes(q))
      return titleMatch || tagMatch
    })
  }, [filteredByPriority, debouncedSearch])

  const filteredTodos = useMemo(() => {
    if (!selectedTagId) return filteredBySearch
    return filteredBySearch.filter((t) => (t.tags ?? []).some((tag) => tag.id === selectedTagId))
  }, [filteredBySearch, selectedTagId])

  const overdueTodos = useMemo(() => filteredTodos.filter((t) => isOverdue(t)), [filteredTodos])
  const activeTodos = useMemo(
    () => filteredTodos.filter((t) => !t.completed && !isOverdue(t)),
    [filteredTodos]
  )
  const completedTodos = useMemo(() => filteredTodos.filter((t) => t.completed), [filteredTodos])

  const resetForm = () => {
    setTitle('')
    setDueDate('')
    setPriority('medium')
    setIsRecurring(false)
    setRecurrencePattern('daily')
    setReminderMinutes(null)
    setSelectedTagIds(new Set())
  }

  const clearAllFilters = () => {
    setSearchInput('')
    setSelectedPriority('all')
    setSelectedTagId(null)
  }

  const hasActiveFilters = selectedPriority !== 'all' || selectedTagId !== null || searchInput.trim() !== ''

  const handleCreate = async () => {
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Title is required')
      return
    }
    if (isRecurring && !dueDate) {
      setError('Recurring todos require a due date')
      return
    }

    const payload: any = {
      title: trimmed,
      priority,
      is_recurring: isRecurring,
      recurrence_pattern: isRecurring ? recurrencePattern : null,
      reminder_minutes: dueDate ? reminderMinutes : null,
    }
    if (dueDate) payload.due_date = dueDate
    if (selectedTagIds.size) payload.tag_ids = Array.from(selectedTagIds)

    const optimisticTodo: Todo = {
      id: `temp-${Date.now()}`,
      title: trimmed,
      due_date: dueDate || null,
      priority,
      is_recurring: isRecurring,
      recurrence_pattern: isRecurring ? recurrencePattern : null,
      reminder_minutes: dueDate ? reminderMinutes : null,
      last_notification_sent: null,
      completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: tags.filter((tag) => selectedTagIds.has(tag.id)),
    }
    setTodos((prev) => sortTodosByPriority([optimisticTodo, ...prev]))
    resetForm()

    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok || !body.success) {
        throw new Error(body?.error ?? 'Failed to create todo')
      }
      setTodos((prev) => {
        return sortTodosByPriority(prev.map((t) => (t.id === optimisticTodo.id ? body.data : t)))
      })
    } catch (err) {
      setError((err as Error).message)
      setTodos((prev) => prev.filter((t) => t.id !== optimisticTodo.id))
    }
  }

  const handleToggleComplete = async (todo: Todo) => {
    const updated: Todo = { ...todo, completed: !todo.completed }
    setTodos((prev) => sortTodosByPriority(prev.map((t) => (t.id === todo.id ? updated : t))))

    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: updated.completed }),
      })
      const body = await res.json()
      if (!res.ok || !body.success) {
        throw new Error(body?.error ?? 'Failed to update todo')
      }
      if (body.created_recurring_todo) {
        await fetchTodos()
      } else {
        setTodos((prev) => sortTodosByPriority(prev.map((t) => (t.id === todo.id ? body.data : t))))
      }
    } catch (err) {
      setError((err as Error).message)
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? todo : t)))
    }
  }

  const openEdit = (todo: Todo) => {
    setEditing(todo)
    setTitle(todo.title)
    setDueDate(todo.due_date ? formatSingaporeForInput(new Date(todo.due_date)) : '')
    setPriority(todo.priority)
    setIsRecurring(todo.is_recurring)
    setRecurrencePattern(todo.recurrence_pattern ?? 'daily')
    setReminderMinutes(todo.reminder_minutes ?? null)
    setSelectedTagIds(new Set((todo.tags ?? []).map((t) => t.id)))
  }

  const closeModal = () => {
    setEditing(null)
    setConfirmDelete(null)
    resetForm()
    setError(null)
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Title is required')
      return
    }
    if (isRecurring && !dueDate) {
      setError('Recurring todos require a due date')
      return
    }

    const payload: any = {
      title: trimmed,
      priority,
      is_recurring: isRecurring,
      recurrence_pattern: isRecurring ? recurrencePattern : null,
      reminder_minutes: dueDate ? reminderMinutes : null,
    }
    if (dueDate) payload.due_date = dueDate
    else payload.due_date = null

    const optimistic: Todo = {
      ...editing,
      title: trimmed,
      due_date: dueDate || null,
      priority,
      is_recurring: isRecurring,
      recurrence_pattern: isRecurring ? recurrencePattern : null,
      reminder_minutes: dueDate ? reminderMinutes : null,
      last_notification_sent: null,
      tags: tags.filter((tag) => selectedTagIds.has(tag.id)),
    }
    setTodos((prev) => sortTodosByPriority(prev.map((t) => (t.id === editing.id ? optimistic : t))))

    try {
      const res = await fetch(`/api/todos/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok || !body.success) {
        throw new Error(body?.error ?? 'Failed to update todo')
      }
      await fetch(
        `/api/todos/${editing.id}/tags`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag_ids: Array.from(selectedTagIds), replace: true }),
        }
      )
      const todoRes = await fetch(`/api/todos/${editing.id}`)
      const todoBody = await todoRes.json()
      const updatedTodo = todoBody.success ? { ...todoBody.data } : optimistic
      setTodos((prev) => sortTodosByPriority(prev.map((t) => (t.id === editing.id ? updatedTodo : t))))
      closeModal()
    } catch (err) {
      setError((err as Error).message)
      setTodos((prev) => prev.map((t) => (t.id === editing.id ? editing : t)))
    }
  }

  const handleDelete = async (todo: Todo) => {
    setConfirmDelete(null)
    const prevTodos = todos
    setTodos((prev) => prev.filter((t) => t.id !== todo.id))

    try {
      const res = await fetch(`/api/todos/${todo.id}`, { method: 'DELETE' })
      const body = await res.json()
      if (!res.ok || !body.success) {
        throw new Error(body?.error ?? 'Failed to delete todo')
      }
    } catch (err) {
      setError((err as Error).message)
      setTodos(prevTodos)
    }
  }

  const renderTodo = (todo: Todo) => {
    const overdue = isOverdue(todo)
    const todoTags = todo.tags ?? []
    return (
      <div key={todo.id} className={`todo-item ${overdue ? 'todo-item--overdue' : ''}`}>
        <label>
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => handleToggleComplete(todo)}
          />
        </label>
        <div>
          <p className="todo-item__title">{todo.title}</p>
          <div className="todo-item__meta">
            <span className={`badge ${priorityClasses[todo.priority]}`}>{priorityLabels[todo.priority]}</span>
            {todoTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="badge"
                style={{
                  marginLeft: 8,
                  backgroundColor: tag.color,
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedTagId((prev) => (prev === tag.id ? null : tag.id))}
                aria-label={`Filter by tag ${tag.name}`}
              >
                {tag.name}
              </button>
            ))}
            {todo.is_recurring && todo.recurrence_pattern ? (
              <span className="badge" style={{ marginLeft: 8 }}>
                🔄 {todo.recurrence_pattern}
              </span>
            ) : null}
            {todo.reminder_minutes !== null ? (
              <span className="badge" style={{ marginLeft: 8 }}>
                🔔 {formatReminderLabel(todo.reminder_minutes)}
              </span>
            ) : null}
            {todo.due_date ? (
              <span style={{ marginLeft: 8 }}>
                Due {formatSingaporeDate(new Date(todo.due_date))}
              </span>
            ) : null}
            {overdue ? <span style={{ marginLeft: 8, color: '#f87171' }}>Overdue</span> : null}
          </div>
        </div>
        <div className="todo-actions">
          <button className="small-btn" onClick={() => openEdit(todo)}>
            Edit
          </button>
          <button className="small-btn" onClick={() => setConfirmDelete(todo)}>
            Delete
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="container">
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem' }}>Todo App</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)' }}>
          Manage your todos (Singapore timezone). Create, edit, complete, and delete.
        </p>
      </header>

      <section className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <input
            className="input"
            type="search"
            placeholder="Search by title or tag…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search todos"
            style={{ flex: '1 1 200px', maxWidth: 320 }}
          />
          {hasActiveFilters ? (
            <button type="button" className="small-btn" onClick={clearAllFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
        {(debouncedSearch.trim() || selectedTagId) && (
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: 'var(--muted)' }}>
            {debouncedSearch.trim() && <>Search: &quot;{debouncedSearch.trim()}&quot;</>}
            {debouncedSearch.trim() && selectedTagId && ' · '}
            {selectedTagId && <>Tag: {tags.find((t) => t.id === selectedTagId)?.name ?? '—'}</>}
          </p>
        )}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Create Todo</h2>
        {error ? (
          <div style={{ color: '#f87171', marginBottom: '0.75rem' }}>{error}</div>
        ) : null}
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          <input
            className="input"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <input
              className="input"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              placeholder="Due date"
            />
            <select className="select" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          {tags.length > 0 ? (
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={{ marginBottom: 4 }}>Tags</legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {tags.map((tag) => (
                  <label key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="checkbox"
                      checked={selectedTagIds.has(tag.id)}
                      onChange={(e) => {
                        setSelectedTagIds((prev) => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(tag.id)
                          else next.delete(tag.id)
                          return next
                        })
                      }}
                    />
                    <span
                      className="badge"
                      style={{ backgroundColor: tag.color, color: '#fff' }}
                    >
                      {tag.name}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <select
            className="select"
            value={reminderMinutes === null ? '' : String(reminderMinutes)}
            onChange={(e) => setReminderMinutes(e.target.value ? Number(e.target.value) : null)}
            disabled={!dueDate}
            aria-label="Reminder"
          >
            <option value="">No reminder</option>
            {REMINDER_MINUTES_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatReminderLabel(minutes)}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="button" onClick={handleCreate} disabled={loading}>
              {loading ? 'Saving…' : 'Create Todo'}
            </button>
            <button type="button" className="small-btn" onClick={() => setManageTagsOpen(true)}>
              Manage Tags
            </button>
          </div>
        </div>
      </section>

      <section className="list-section" aria-label="Todo filters">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
          <select
            className="select"
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value as Priority | 'all')}
            aria-label="Filter by priority"
            style={{ maxWidth: 200 }}
          >
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </section>

      {filteredTodos.length === 0 ? (
        <section className="list-section">
          <p style={{ color: 'var(--muted)' }}>
            {todos.length === 0
              ? 'No todos yet. Create one above.'
              : 'No todos match the current filters. Try clearing filters or changing your search.'}
          </p>
        </section>
      ) : (
        <>
      <section className="list-section">
        <div className="list-header">
          <h2>Overdue</h2>
          <span className="badge">{overdueTodos.length}</span>
        </div>
        {overdueTodos.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No overdue todos</p>
        ) : (
          overdueTodos.map(renderTodo)
        )}
      </section>

      <section className="list-section">
        <div className="list-header">
          <h2>Active</h2>
          <span className="badge">{activeTodos.length}</span>
        </div>
        {activeTodos.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No active todos</p>
        ) : (
          activeTodos.map(renderTodo)
        )}
      </section>

      <section className="list-section">
        <div className="list-header">
          <h2>Completed</h2>
          <span className="badge">{completedTodos.length}</span>
        </div>
        {completedTodos.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No completed todos</p>
        ) : (
          completedTodos.map(renderTodo)
        )}
      </section>
        </>
      )}

      {editing ? (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Todo</h3>
              <button className="close-button" onClick={closeModal} aria-label="Close">
                ×
              </button>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <label>
                <div style={{ marginBottom: 4 }}>Title</div>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                <div style={{ marginBottom: 4 }}>Due date</div>
                <input
                  className="input"
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>
              <label>
                <div style={{ marginBottom: 4 }}>Priority</div>
                <select
                  className="select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                />
                Repeat
              </label>
              {isRecurring ? (
                <label>
                  <div style={{ marginBottom: 4 }}>Recurrence pattern</div>
                  <select
                    className="select"
                    value={recurrencePattern}
                    onChange={(e) => setRecurrencePattern(e.target.value as RecurrencePattern)}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </label>
              ) : null}
              <label>
                <div style={{ marginBottom: 4 }}>Reminder</div>
                <select
                  className="select"
                  value={reminderMinutes === null ? '' : String(reminderMinutes)}
                  onChange={(e) => setReminderMinutes(e.target.value ? Number(e.target.value) : null)}
                  disabled={!dueDate}
                >
                  <option value="">No reminder</option>
                  {REMINDER_MINUTES_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {formatReminderLabel(minutes)}
                    </option>
                  ))}
                </select>
              </label>
              {tags.length > 0 ? (
                <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                  <legend style={{ marginBottom: 4 }}>Tags</legend>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {tags.map((tag) => (
                      <label key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="checkbox"
                          checked={selectedTagIds.has(tag.id)}
                          onChange={(e) => {
                            setSelectedTagIds((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(tag.id)
                              else next.delete(tag.id)
                              return next
                            })
                          }}
                        />
                        <span className="badge" style={{ backgroundColor: tag.color, color: '#fff' }}>{tag.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button className="button" onClick={handleSaveEdit}>
                  Save
                </button>
                <button className="small-btn" onClick={closeModal}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Todo</h3>
              <button className="close-button" onClick={() => setConfirmDelete(null)} aria-label="Close">
                ×
              </button>
            </div>
            <p>
              Are you sure you want to delete <strong>{confirmDelete.title}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="small-btn" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button
                className="button"
                style={{ background: 'rgba(244, 67, 54, 0.9)', borderColor: 'rgba(244, 67, 54, 0.8)' }}
                onClick={() => handleDelete(confirmDelete)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {manageTagsOpen ? (
        <div className="modal-backdrop" onClick={() => { setManageTagsOpen(false); setTagError(null); setEditingTagId(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3 className="modal-title">Manage Tags</h3>
              <button className="close-button" onClick={() => { setManageTagsOpen(false); setTagError(null); setEditingTagId(null); }} aria-label="Close">
                ×
              </button>
            </div>
            {tagError ? <p style={{ color: '#f87171', marginBottom: '0.75rem' }}>{tagError}</p> : null}
            <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
              <label>
                <div style={{ marginBottom: 4 }}>New tag name</div>
                <input
                  className="input"
                  value={tagFormName}
                  onChange={(e) => setTagFormName(e.target.value)}
                  placeholder="Tag name"
                />
              </label>
              <label>
                <div style={{ marginBottom: 4 }}>Color</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 4,
                        backgroundColor: c,
                        border: tagFormColor === c ? '2px solid var(--fg)' : '1px solid var(--border)',
                        cursor: 'pointer',
                      }}
                      onClick={() => setTagFormColor(c)}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
                <input
                  type="text"
                  className="input"
                  value={tagFormColor}
                  onChange={(e) => setTagFormColor(e.target.value)}
                  style={{ marginTop: 6, maxWidth: 100 }}
                />
              </label>
              <button
                className="button"
                onClick={async () => {
                  const name = tagFormName.trim()
                  if (!name) { setTagError('Tag name is required'); return }
                  setTagError(null)
                  try {
                    const res = await fetch('/api/tags', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name, color: /^#[0-9A-Fa-f]{6}$/.test(tagFormColor) ? tagFormColor : undefined }),
                    })
                    const body = await res.json()
                    if (!res.ok) { setTagError(body?.error ?? 'Failed to create tag'); return }
                    setTags((prev) => [...prev, body.data].sort((a, b) => a.name.localeCompare(b.name)))
                    setTagFormName('')
                    setTagFormColor('#6b7280')
                  } catch {
                    setTagError('Failed to create tag')
                  }
                }}
              >
                Create Tag
              </button>
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.5rem' }}>Existing tags</h4>
              {tags.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No tags yet. Create one above.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {tags.map((tag) => (
                    <li key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      {editingTagId === tag.id ? (
                        <>
                          <input
                            className="input"
                            value={editingTagName}
                            onChange={(e) => setEditingTagName(e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <input
                            type="text"
                            className="input"
                            value={editingTagColor}
                            onChange={(e) => setEditingTagColor(e.target.value)}
                            style={{ width: 70 }}
                          />
                          <button
                            className="small-btn"
                            onClick={async () => {
                              const name = editingTagName.trim()
                              if (!name) return
                              try {
                                const res = await fetch(`/api/tags/${tag.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ name, color: /^#[0-9A-Fa-f]{6}$/.test(editingTagColor) ? editingTagColor : undefined }),
                                })
                                const body = await res.json()
                                if (!res.ok) { setTagError(body?.error ?? 'Failed'); return }
                                setTags((prev) => prev.map((t) => (t.id === tag.id ? body.data : t)).sort((a, b) => a.name.localeCompare(b.name)))
                                setTodos((prev) => prev.map((t) => (t.tags ?? []).some(tg => tg.id === tag.id) ? { ...t, tags: (t.tags ?? []).map(tg => tg.id === tag.id ? body.data : tg) } : t))
                                setEditingTagId(null)
                              } catch {
                                setTagError('Failed to update')
                              }
                            }}
                          >
                            Save
                          </button>
                          <button className="small-btn" onClick={() => setEditingTagId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <span className="badge" style={{ backgroundColor: tag.color, color: '#fff' }}>{tag.name}</span>
                          <button className="small-btn" onClick={() => { setEditingTagId(tag.id); setEditingTagName(tag.name); setEditingTagColor(tag.color); setTagError(null); }}>Edit</button>
                          <button
                            className="small-btn"
                            style={{ color: '#f87171' }}
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' })
                                if (!res.ok) return
                                setTags((prev) => prev.filter((t) => t.id !== tag.id))
                                setTodos((prev) => prev.map((t) => ({ ...t, tags: (t.tags ?? []).filter(tg => tg.id !== tag.id) })))
                                setSelectedTagIds((prev) => { const n = new Set(prev); n.delete(tag.id); return n; })
                              } catch {
                                setTagError('Failed to delete')
                              }
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
