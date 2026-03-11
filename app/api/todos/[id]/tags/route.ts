import { NextResponse } from 'next/server'
import { getTodoById, getTagById, setTodoTags, addTodoTag, removeTodoTag } from '@/lib/db'

export async function POST(
  request: Request,
  context: { params: any }
) {
  const { id: todoId } = await context.params
  const todo = getTodoById(todoId)
  if (!todo) {
    return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const tagIds = Array.isArray(body.tag_ids)
    ? body.tag_ids.filter((x: unknown) => typeof x === 'string')
    : typeof body.tag_id === 'string'
      ? [body.tag_id]
      : []

  for (const tagId of tagIds) {
    if (!getTagById(tagId)) {
      return NextResponse.json({ success: false, error: `Tag not found: ${tagId}` }, { status: 404 })
    }
  }

  if (body.replace === true || (body.tag_ids && !body.tag_id)) {
    setTodoTags(todoId, tagIds)
  } else {
    for (const tagId of tagIds) {
      addTodoTag(todoId, tagId)
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: Request,
  context: { params: any }
) {
  const { id: todoId } = await context.params
  const todo = getTodoById(todoId)
  if (!todo) {
    return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const tagId = body.tag_id
  if (typeof tagId !== 'string') {
    return NextResponse.json({ success: false, error: 'tag_id is required' }, { status: 400 })
  }

  removeTodoTag(todoId, tagId)
  return NextResponse.json({ success: true })
}
