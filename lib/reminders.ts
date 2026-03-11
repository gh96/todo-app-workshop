export const REMINDER_MINUTES_OPTIONS = [15, 30, 60, 120, 1440, 2880, 10080] as const

export type ReminderMinutes = (typeof REMINDER_MINUTES_OPTIONS)[number]

export function calculateReminderTimeIso(dueDateIso: string, reminderMinutes: number): string {
  const dueMs = Date.parse(dueDateIso)
  if (Number.isNaN(dueMs)) {
    throw new Error('Invalid due date ISO value')
  }
  const reminderMs = dueMs - reminderMinutes * 60_000
  return new Date(reminderMs).toISOString()
}

export function isReminderDue(input: {
  dueDateIso: string
  reminderMinutes: number
  nowIso: string
  lastNotificationSentIso: string | null
}): boolean {
  if (input.lastNotificationSentIso) {
    return false
  }

  if (input.reminderMinutes <= 0) {
    return false
  }

  const dueMs = Date.parse(input.dueDateIso)
  const nowTime = Date.parse(input.nowIso)
  if (Number.isNaN(dueMs) || Number.isNaN(nowTime)) {
    return false
  }

  const reminderTime = dueMs - input.reminderMinutes * 60_000
  return nowTime >= reminderTime
}

export function formatReminderLabel(reminderMinutes: number): string {
  const labels: Record<number, string> = {
    15: '15m',
    30: '30m',
    60: '1h',
    120: '2h',
    1440: '1d',
    2880: '2d',
    10080: '1w',
  }
  return labels[reminderMinutes] ?? `${reminderMinutes}m`
}
