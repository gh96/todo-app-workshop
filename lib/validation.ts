import { z } from 'zod'
import { isFutureSingaporeIso } from './timezone'
import { REMINDER_MINUTES_OPTIONS } from './reminders'

export const prioritySchema = z.enum(['high', 'medium', 'low'])
export const recurrencePatternSchema = z.enum(['daily', 'weekly', 'monthly', 'yearly'])
export const reminderMinutesSchema = z.enum(REMINDER_MINUTES_OPTIONS.map((v) => String(v)) as [string, ...string[]])
  .transform((v) => Number(v))

export const createTodoSchema = z.object({
  title: z.string().trim().min(1, { message: 'Title is required' }),
  due_date: z
    .string()
    .optional()
    .refine((val) => (val ? isFutureSingaporeIso(val) : true), {
      message: 'Due date must be at least 1 minute in the future (Singapore time)',
    }),
  priority: prioritySchema.optional(),
  is_recurring: z.boolean().optional(),
  recurrence_pattern: recurrencePatternSchema.nullable().optional(),
  reminder_minutes: z.union([reminderMinutesSchema, z.null()]).optional(),
  tag_ids: z.array(z.string().uuid()).optional(),
}).superRefine((data, ctx) => {
  if (data.is_recurring) {
    if (!data.due_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['due_date'],
        message: 'Recurring todos require a due date',
      })
    }
    if (!data.recurrence_pattern) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recurrence_pattern'],
        message: 'Recurring todos require a recurrence pattern',
      })
    }
  }

  if (data.reminder_minutes !== undefined && data.reminder_minutes !== null && !data.due_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reminder_minutes'],
      message: 'Reminder requires a due date',
    })
  }
})

export const updateTodoSchema = z.object({
  title: z.string().trim().min(1).optional(),
  due_date: z
    .string()
    .nullable()
    .optional()
    .refine((val) => {
      if (val === null || val === undefined || val === '') return true
      return isFutureSingaporeIso(val)
    }, {
      message: 'Due date must be at least 1 minute in the future (Singapore time)',
    }),
  priority: prioritySchema.optional(),
  completed: z.boolean().optional(),
  is_recurring: z.boolean().optional(),
  recurrence_pattern: recurrencePatternSchema.nullable().optional(),
  reminder_minutes: z.union([reminderMinutesSchema, z.null()]).optional(),
}).superRefine((data, ctx) => {
  if (data.is_recurring) {
    if (!data.recurrence_pattern) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recurrence_pattern'],
        message: 'Recurring todos require a recurrence pattern',
      })
    }
    if (data.due_date === null || data.due_date === undefined || data.due_date === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['due_date'],
        message: 'Recurring todos require a due date',
      })
    }
  }

  if (data.reminder_minutes !== undefined && data.reminder_minutes !== null) {
    const dueCleared = data.due_date === null || data.due_date === ''
    if (dueCleared) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reminder_minutes'],
        message: 'Reminder requires a due date',
      })
    }
  }
})

const tagNameMax = 50
export const tagNameSchema = z
  .string()
  .trim()
  .min(1, { message: 'Tag name is required' })
  .max(tagNameMax, { message: `Tag name must be ${tagNameMax} characters or less` })

export const tagColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a hex code e.g. #3b82f6' })

export const createTagSchema = z.object({
  name: tagNameSchema,
  color: tagColorSchema.optional(),
})

export const updateTagSchema = z.object({
  name: tagNameSchema.optional(),
  color: tagColorSchema.optional(),
})
