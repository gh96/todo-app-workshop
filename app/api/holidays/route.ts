import { NextRequest, NextResponse } from 'next/server'
import { getAllHolidays, getHolidaysByMonth } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get('year')
  const monthParam = searchParams.get('month')

  if (yearParam && monthParam) {
    const year = parseInt(yearParam, 10)
    const month = parseInt(monthParam, 10)
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, error: 'Invalid year or month parameter' },
        { status: 400 }
      )
    }
    const holidays = getHolidaysByMonth(year, month)
    return NextResponse.json({ success: true, data: holidays })
  }

  const holidays = getAllHolidays()
  return NextResponse.json({ success: true, data: holidays })
}
