import { useCallback, useEffect, useMemo, useState } from 'react'

type NotificationTodo = {
  id: string
  title: string
  due_date: string | null
}

type CheckResponse = {
  success: boolean
  data: NotificationTodo[]
  error?: string
}

export function useNotifications() {
  const isSupported = typeof window !== 'undefined' && 'Notification' in window
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    isSupported ? Notification.permission : 'unsupported'
  )

  const canPoll = useMemo(() => isSupported && permission === 'granted', [isSupported, permission])

  const enableNotifications = useCallback(async () => {
    if (!isSupported) return false
    const next = await Notification.requestPermission()
    setPermission(next)
    return next === 'granted'
  }, [isSupported])

  useEffect(() => {
    if (!canPoll) return

    let cancelled = false

    const poll = async () => {
      try {
        const response = await fetch('/api/notifications/check')
        const body = (await response.json()) as CheckResponse
        if (!response.ok || !body.success || cancelled) return

        body.data.forEach((todo) => {
          const dueText = todo.due_date ? ` (due ${new Date(todo.due_date).toLocaleString()})` : ''
          new Notification('Todo Reminder', {
            body: `${todo.title}${dueText}`,
            tag: `todo-reminder-${todo.id}`,
          })
        })
      } catch {
        // Polling failures should not interrupt the user flow.
      }
    }

    void poll()
    const timer = setInterval(() => {
      void poll()
    }, 30_000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [canPoll])

  return {
    isSupported,
    permission,
    canPoll,
    enableNotifications,
  }
}
