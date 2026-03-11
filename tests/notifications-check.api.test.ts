import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET } from '../app/api/notifications/check/route'
import { createTodo, deleteTodo, getTodoById, updateTodo } from '../lib/db'
import { parseSingaporeLocalIso } from '../lib/timezone'

describe('Feature 04 notifications API duplicate prevention', () => {
  const cleanupIds: string[] = []

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(parseSingaporeLocalIso('2026-03-20T09:30').toISOString())
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanupIds.splice(0).forEach((id) => deleteTodo(id))
  })

  it('returns due reminders and stamps last_notification_sent on first poll', async () => {
    const dueIso = parseSingaporeLocalIso('2026-03-20T10:00').toISOString()

    const todo = createTodo({
      title: 'Feature04 first poll reminder',
      due_date: dueIso,
      reminder_minutes: 30,
      priority: 'medium',
    } as any)

    cleanupIds.push(todo.id)

    const response = await GET(new Request('http://localhost/api/notifications/check'))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe(todo.id)

    const persisted = getTodoById(todo.id) as any
    expect(persisted.last_notification_sent).toBeTruthy()
  })

  it('does not return duplicate reminder on second poll for same todo', async () => {
    const dueIso = parseSingaporeLocalIso('2026-03-20T10:00').toISOString()

    const todo = createTodo({
      title: 'Feature04 duplicate prevention',
      due_date: dueIso,
      reminder_minutes: 30,
      priority: 'high',
    } as any)

    cleanupIds.push(todo.id)

    const first = await GET(new Request('http://localhost/api/notifications/check'))
    expect(first.status).toBe(200)
    const firstBody = await first.json()
    expect(firstBody.data).toHaveLength(1)
    expect(firstBody.data[0].id).toBe(todo.id)

    const second = await GET(new Request('http://localhost/api/notifications/check'))
    expect(second.status).toBe(200)
    const secondBody = await second.json()
    expect(secondBody.success).toBe(true)
    expect(secondBody.data).toHaveLength(0)
  })

  it('does not return todo when current time is before reminder window', async () => {
    const dueIso = parseSingaporeLocalIso('2026-03-20T10:00').toISOString()
    vi.setSystemTime(parseSingaporeLocalIso('2026-03-20T09:29').toISOString())

    const todo = createTodo({
      title: 'Feature04 too early',
      due_date: dueIso,
      reminder_minutes: 30,
      priority: 'low',
    } as any)

    cleanupIds.push(todo.id)

    const response = await GET(new Request('http://localhost/api/notifications/check'))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(0)

    const persisted = getTodoById(todo.id) as any
    expect(persisted.last_notification_sent ?? null).toBeNull()

    // Sanity: once we move into reminder window, it should become eligible.
    vi.setSystemTime(parseSingaporeLocalIso('2026-03-20T09:30').toISOString())
    const inWindow = await GET(new Request('http://localhost/api/notifications/check'))
    const inWindowBody = await inWindow.json()
    expect(inWindowBody.data).toHaveLength(1)
    expect(inWindowBody.data[0].id).toBe(todo.id)
  })

  it('skips completed todos even if reminder window is reached', async () => {
    const dueIso = parseSingaporeLocalIso('2026-03-20T10:00').toISOString()

    const todo = createTodo({
      title: 'Feature04 completed todo should skip reminder',
      due_date: dueIso,
      reminder_minutes: 30,
      priority: 'medium',
    } as any)

    cleanupIds.push(todo.id)
    updateTodo(todo.id, { completed: true })

    const response = await GET(new Request('http://localhost/api/notifications/check'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(0)
  })
})
