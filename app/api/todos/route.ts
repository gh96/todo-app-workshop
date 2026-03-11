import { NextResponse } from 'next/server'
import { getAllTodos, createTodo, getTagsForTodo, setTodoTags, getTagById } from '@/lib/db'
import { createTodoSchema } from '@/lib/validation'
import { parseSingaporeLocalIso } from '@/lib/timezone'

export async function GET() {
  const todos = getAllTodos()
  const todosWithTags = todos.map((todo) => ({
    ...todo,
    tags: getTagsForTodo(todo.id),
  }))
  return NextResponse.json({ success: true, data: todosWithTags })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const parseResult = createTodoSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json({ success: false, error: parseResult.error.flatten().formErrors.join('; ') }, { status: 400 })
  }

  const { title, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes, tag_ids } = parseResult.data
  const dueDateIso = due_date ? parseSingaporeLocalIso(due_date).toISOString() : null
  const todo = createTodo({
    title,
    due_date: dueDateIso,
    priority,
    is_recurring: is_recurring ?? false,
    recurrence_pattern: is_recurring ? (recurrence_pattern ?? null) : null,
    reminder_minutes: dueDateIso ? (reminder_minutes ?? null) : null,
    last_notification_sent: null,
  })
  if (tag_ids?.length) {
    const validIds = tag_ids.filter((id) => getTagById(id))
    setTodoTags(todo.id, validIds)
  }
  const tags = getTagsForTodo(todo.id)
  return NextResponse.json({ success: true, data: { ...todo, tags } }, { status: 201 })
}
