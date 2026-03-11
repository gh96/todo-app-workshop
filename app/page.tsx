'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { formatSingaporeDate, formatSingaporeForInput, getSingaporeNow } from '@/lib/timezone'
import type { Priority, RecurrencePattern } from '@/lib/db'
import { filterTodosByPriority, sortTodosByPriority } from '@/lib/priority'

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

export default function Page() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState<string>('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('daily')
  const [selectedPriority, setSelectedPriority] = useState<Priority | 'all'>('all')
  const [editing, setEditing] = useState<Todo | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Todo | null>(null)

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

  useEffect(() => {
    fetchTodos()
  }, [])

  const filteredTodos = useMemo(
    () => filterTodosByPriority(todos, selectedPriority),
    [todos, selectedPriority]
  )

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
  }

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
    }
    if (dueDate) payload.due_date = dueDate

    const optimisticTodo: Todo = {
      id: `temp-${Date.now()}`,
      title: trimmed,
      due_date: dueDate || null,
      priority,
      is_recurring: isRecurring,
      recurrence_pattern: isRecurring ? recurrencePattern : null,
      completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
      setTodos((prev) => sortTodosByPriority(prev.map((t) => (t.id === editing.id ? body.data : t))))
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
            {todo.is_recurring && todo.recurrence_pattern ? (
              <span className="badge" style={{ marginLeft: 8 }}>
                🔄 {todo.recurrence_pattern}
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
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>Todo App</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)' }}>
            Manage your todos (Singapore timezone). Create, edit, complete, and delete.
          </p>
        </div>
        <a
          href="/calendar"
          className="button"
          style={{ textDecoration: 'none', background: 'rgba(139, 92, 246, 0.9)', borderColor: 'rgba(139, 92, 246, 0.8)' }}
        >
          Calendar
        </a>
      </header>

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
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            Repeat
          </label>
          {isRecurring ? (
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
          ) : null}
          <button className="button" onClick={handleCreate} disabled={loading}>
            {loading ? 'Saving…' : 'Create Todo'}
          </button>
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
    </main>
  )
}
