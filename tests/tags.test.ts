import { describe, it, expect } from 'vitest'
import {
  createTag,
  getTagById,
  getTagByName,
  getAllTags,
  updateTag,
  deleteTag,
  getTagsForTodo,
  setTodoTags,
  createTodo,
  deleteTodo,
} from '../lib/db'
import { createTagSchema, tagNameSchema, updateTagSchema } from '../lib/validation'

describe('Feature 06 Tag System', () => {
  it('validates tag name (required, max length)', () => {
    expect(tagNameSchema.safeParse('').success).toBe(false)
    expect(tagNameSchema.safeParse('   ').success).toBe(false)
    expect(tagNameSchema.safeParse('ok').success).toBe(true)
    expect(tagNameSchema.safeParse('a'.repeat(50)).success).toBe(true)
    expect(tagNameSchema.safeParse('a'.repeat(51)).success).toBe(false)
  })

  it('creates and retrieves a tag', () => {
    const tag = createTag({ name: 'work', color: '#3b82f6' })
    expect(tag.id).toBeDefined()
    expect(tag.name).toBe('work')
    expect(tag.color).toBe('#3b82f6')

    const fetched = getTagById(tag.id)
    expect(fetched).toEqual(tag)

    const byName = getTagByName('work')
    expect(byName?.id).toBe(tag.id)

    deleteTag(tag.id)
  })

  it('lists all tags sorted by name', () => {
    const a = createTag({ name: 'zeta' })
    const b = createTag({ name: 'alpha' })
    const list = getAllTags().filter((t) => [a.id, b.id].includes(t.id))
    expect(list.map((t) => t.name)).toEqual(['alpha', 'zeta'])
    deleteTag(a.id)
    deleteTag(b.id)
  })

  it('updates tag name and color', () => {
    const tag = createTag({ name: 'old', color: '#ef4444' })
    const updated = updateTag(tag.id, { name: 'new', color: '#22c55e' })
    expect(updated?.name).toBe('new')
    expect(updated?.color).toBe('#22c55e')
    expect(getTagById(tag.id)?.name).toBe('new')
    deleteTag(tag.id)
  })

  it('deletes tag and removes from todos', () => {
    const tag = createTag({ name: 'temp', color: '#6b7280' })
    const todo = createTodo({ title: 'With tag', due_date: null })
    setTodoTags(todo.id, [tag.id])
    expect(getTagsForTodo(todo.id)).toHaveLength(1)
    deleteTag(tag.id)
    expect(getTagsForTodo(todo.id)).toHaveLength(0)
    expect(getTagById(tag.id)).toBeNull()
    deleteTodo(todo.id)
  })

  it('assigns multiple tags to a todo', () => {
    const t1 = createTag({ name: 'a', color: '#111' })
    const t2 = createTag({ name: 'b', color: '#222' })
    const todo = createTodo({ title: 'Multi', due_date: null })
    setTodoTags(todo.id, [t1.id, t2.id])
    const assigned = getTagsForTodo(todo.id)
    expect(assigned.map((x) => x.id).sort()).toEqual([t1.id, t2.id].sort())
    setTodoTags(todo.id, [])
    expect(getTagsForTodo(todo.id)).toHaveLength(0)
    deleteTodo(todo.id)
    deleteTag(t1.id)
    deleteTag(t2.id)
  })

  it('createTagSchema accepts name and optional color', () => {
    expect(createTagSchema.safeParse({ name: 'x' }).success).toBe(true)
    expect(createTagSchema.safeParse({ name: 'x', color: '#3b82f6' }).success).toBe(true)
    expect(createTagSchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('updateTagSchema allows partial updates', () => {
    expect(updateTagSchema.safeParse({ name: 'y' }).success).toBe(true)
    expect(updateTagSchema.safeParse({ color: '#ef4444' }).success).toBe(true)
  })
})
