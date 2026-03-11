import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { normalizePriority } from './priority'

export type Priority = 'high' | 'medium' | 'low'
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Todo {
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

const db = new Database('todos.db')

// Ensure schema exists
// Due date is stored as ISO string UTC (e.g. 2026-03-11T10:00:00.000Z)
// completed is 0/1
// priority is one of 'high', 'medium', 'low'

db.exec(`
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  due_date TEXT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern TEXT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS todos_due_date_idx ON todos(due_date);
CREATE INDEX IF NOT EXISTS todos_completed_idx ON todos(completed);

CREATE TABLE IF NOT EXISTS holidays (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  observed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS holidays_date_idx ON holidays(date);
`)

// Migration for existing databases that predate recurring fields.
try {
  db.exec(`ALTER TABLE todos ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0;`)
} catch {
  // Column already exists.
}

try {
  db.exec(`ALTER TABLE todos ADD COLUMN recurrence_pattern TEXT NULL;`)
} catch {
  // Column already exists.
}

export function getAllTodos(): Todo[] {
  const stmt = db.prepare(`
    SELECT * FROM todos
    ORDER BY
      completed ASC,
      CASE priority
        WHEN 'high' THEN 3
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 1
        ELSE 0
      END DESC,
      due_date ASC,
      created_at ASC
  `)
  const rows = stmt.all() as Array<Record<string, unknown>>
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    due_date: row.due_date === null ? null : String(row.due_date),
    priority: normalizePriority(row.priority),
    is_recurring: Boolean(row.is_recurring),
    recurrence_pattern: row.recurrence_pattern === null ? null : String(row.recurrence_pattern) as RecurrencePattern,
    completed: Boolean(row.completed),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }))
}

export function getTodoById(id: string): Todo | null {
  const stmt = db.prepare(`SELECT * FROM todos WHERE id = ?`)
  const row = stmt.get(id) as Record<string, unknown> | undefined
  if (!row) return null
  return {
    id: String(row.id),
    title: String(row.title),
    due_date: row.due_date === null ? null : String(row.due_date),
    priority: normalizePriority(row.priority),
    is_recurring: Boolean(row.is_recurring),
    recurrence_pattern: row.recurrence_pattern === null ? null : String(row.recurrence_pattern) as RecurrencePattern,
    completed: Boolean(row.completed),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export function createTodo(data: {
  title: string
  due_date: string | null
  priority?: Priority
  is_recurring?: boolean
  recurrence_pattern?: RecurrencePattern | null
}): Todo {
  const now = new Date().toISOString()
  const isRecurring = Boolean(data.is_recurring)
  const recurrencePattern = isRecurring ? (data.recurrence_pattern ?? null) : null
  const todo: Todo = {
    id: uuidv4(),
    title: data.title.trim(),
    due_date: data.due_date,
    priority: normalizePriority(data.priority),
    is_recurring: isRecurring,
    recurrence_pattern: recurrencePattern,
    completed: false,
    created_at: now,
    updated_at: now,
  }
  const stmt = db.prepare(
    `INSERT INTO todos (id, title, due_date, priority, is_recurring, recurrence_pattern, completed, created_at, updated_at)
      VALUES (@id, @title, @due_date, @priority, @is_recurring, @recurrence_pattern, @completed, @created_at, @updated_at)`
  )
  stmt.run({
    id: todo.id,
    title: todo.title,
    due_date: todo.due_date,
    priority: todo.priority,
    is_recurring: todo.is_recurring ? 1 : 0,
    recurrence_pattern: todo.recurrence_pattern,
    completed: 0,
    created_at: todo.created_at,
    updated_at: todo.updated_at,
  })
  return todo
}

export function updateTodo(id: string, updates: Partial<Omit<Todo, 'id' | 'created_at'>>): Todo | null {
  const existing = getTodoById(id)
  if (!existing) return null
  const now = new Date().toISOString()
  const nextRecurringValue = updates.is_recurring ?? existing.is_recurring
  const nextPatternValue = nextRecurringValue
    ? (updates.recurrence_pattern ?? existing.recurrence_pattern)
    : null
  const updated: Todo = {
    ...existing,
    ...updates,
    priority: normalizePriority(updates.priority ?? existing.priority),
    is_recurring: nextRecurringValue,
    recurrence_pattern: nextPatternValue,
    updated_at: now,
  }
  const stmt = db.prepare(
    `UPDATE todos
      SET title = @title,
          due_date = @due_date,
          priority = @priority,
          is_recurring = @is_recurring,
          recurrence_pattern = @recurrence_pattern,
          completed = @completed,
          updated_at = @updated_at
      WHERE id = @id`
  )
  stmt.run({
    id,
    title: updated.title,
    due_date: updated.due_date,
    priority: updated.priority,
    is_recurring: updated.is_recurring ? 1 : 0,
    recurrence_pattern: updated.recurrence_pattern,
    completed: updated.completed ? 1 : 0,
    updated_at: updated.updated_at,
  })
  return updated
}

export function deleteTodo(id: string): boolean {
  const stmt = db.prepare(`DELETE FROM todos WHERE id = ?`)
  const result = stmt.run(id)
  return result.changes > 0
}

// ---------- Holidays ----------

export interface Holiday {
  id: string
  date: string      // YYYY-MM-DD
  name: string
  observed: boolean
}

export function getAllHolidays(): Holiday[] {
  const stmt = db.prepare(`SELECT * FROM holidays ORDER BY date ASC`)
  const rows = stmt.all() as Array<Record<string, unknown>>
  return rows.map((row) => ({
    id: String(row.id),
    date: String(row.date),
    name: String(row.name),
    observed: Boolean(row.observed),
  }))
}

export function getHolidaysByMonth(year: number, month: number): Holiday[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const stmt = db.prepare(`SELECT * FROM holidays WHERE date LIKE ? ORDER BY date ASC`)
  const rows = stmt.all(`${prefix}%`) as Array<Record<string, unknown>>
  return rows.map((row) => ({
    id: String(row.id),
    date: String(row.date),
    name: String(row.name),
    observed: Boolean(row.observed),
  }))
}

export function insertHoliday(data: { id: string; date: string; name: string; observed?: boolean }): void {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO holidays (id, date, name, observed) VALUES (@id, @date, @name, @observed)`
  )
  stmt.run({
    id: data.id,
    date: data.date,
    name: data.name,
    observed: data.observed ? 1 : 0,
  })
}
