import { describe, it, expect } from 'vitest'
import { parseSingaporeLocalIso } from '../lib/timezone'
import { calculateReminderTimeIso, isReminderDue, REMINDER_MINUTES_OPTIONS } from '../lib/reminders'

describe('Feature 04 reminder time calculation', () => {
  it('supports exactly 7 reminder timing options', () => {
    expect(REMINDER_MINUTES_OPTIONS).toEqual([15, 30, 60, 120, 1440, 2880, 10080])
  })

  it('calculates reminder time at 30 minutes before due date', () => {
    const dueIso = parseSingaporeLocalIso('2026-03-20T10:00').toISOString()

    const reminderIso = calculateReminderTimeIso(dueIso, 30)

    expect(reminderIso).toBe(parseSingaporeLocalIso('2026-03-20T09:30').toISOString())
  })

  it('calculates reminder time at 1 week before due date', () => {
    const dueIso = parseSingaporeLocalIso('2026-03-20T10:00').toISOString()

    const reminderIso = calculateReminderTimeIso(dueIso, 10080)

    expect(reminderIso).toBe(parseSingaporeLocalIso('2026-03-13T10:00').toISOString())
  })

  it('returns true only when now is on or after reminder time and no previous send exists', () => {
    const dueIso = parseSingaporeLocalIso('2026-03-20T10:00').toISOString()
    const nowBeforeReminder = parseSingaporeLocalIso('2026-03-20T09:29').toISOString()
    const nowAtReminder = parseSingaporeLocalIso('2026-03-20T09:30').toISOString()

    expect(isReminderDue({ dueDateIso: dueIso, reminderMinutes: 30, nowIso: nowBeforeReminder, lastNotificationSentIso: null })).toBe(false)
    expect(isReminderDue({ dueDateIso: dueIso, reminderMinutes: 30, nowIso: nowAtReminder, lastNotificationSentIso: null })).toBe(true)
  })

  it('returns false when notification was already sent', () => {
    const dueIso = parseSingaporeLocalIso('2026-03-20T10:00').toISOString()
    const nowAtReminder = parseSingaporeLocalIso('2026-03-20T09:30').toISOString()

    expect(
      isReminderDue({
        dueDateIso: dueIso,
        reminderMinutes: 30,
        nowIso: nowAtReminder,
        lastNotificationSentIso: parseSingaporeLocalIso('2026-03-20T09:30').toISOString(),
      })
    ).toBe(false)
  })
})
