import { NextResponse } from 'next/server'
import { getTagById, updateTag, deleteTag, getTagByName } from '@/lib/db'
import { updateTagSchema } from '@/lib/validation'

export async function GET(
  _request: Request,
  context: { params: any }
) {
  const { id } = await context.params
  const tag = getTagById(id)
  if (!tag) {
    return NextResponse.json({ success: false, error: 'Tag not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true, data: tag })
}

export async function PUT(
  request: Request,
  context: { params: any }
) {
  const { id } = await context.params
  const existing = getTagById(id)
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Tag not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const parseResult = updateTagSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      { success: false, error: parseResult.error.flatten().formErrors.join('; ') },
      { status: 400 }
    )
  }

  if (parseResult.data.name !== undefined) {
    const duplicate = getTagByName(parseResult.data.name)
    if (duplicate && duplicate.id !== id) {
      return NextResponse.json(
        { success: false, error: 'A tag with this name already exists' },
        { status: 409 }
      )
    }
  }

  const updated = updateTag(id, parseResult.data)
  return NextResponse.json({ success: true, data: updated })
}

export async function DELETE(
  _request: Request,
  context: { params: any }
) {
  const { id } = await context.params
  const success = deleteTag(id)
  if (!success) {
    return NextResponse.json({ success: false, error: 'Tag not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
