import { NextResponse } from 'next/server'
import { claimReminderNotification, getAllTodos } from '@/lib/db'
import { isReminderDue } from '@/lib/reminders'

export async function GET(_request: Request) {
  const nowIso = new Date().toISOString()
  const todos = getAllTodos()

  const dueReminders = todos.filter((todo) => {
    if (todo.completed) return false
    if (!todo.due_date) return false
    if (todo.reminder_minutes === null || todo.reminder_minutes === undefined) return false

    return isReminderDue({
      dueDateIso: todo.due_date,
      reminderMinutes: todo.reminder_minutes,
      nowIso,
      lastNotificationSentIso: todo.last_notification_sent,
    })
  })

  const stamped = dueReminders
    .map((todo) => claimReminderNotification(todo.id, nowIso))
    .filter((todo): todo is NonNullable<typeof todo> => Boolean(todo))

  return NextResponse.json({ success: true, data: stamped }, { status: 200 })
}
