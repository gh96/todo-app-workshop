import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'todos.db')
const db = new Database(dbPath)

db.exec(`
CREATE TABLE IF NOT EXISTS holidays (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  observed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS holidays_date_idx ON holidays(date);
`)

interface HolidayEntry {
  id: string
  date: string
  name: string
  observed: boolean
}

// Singapore public holidays for 2025 and 2026
const holidays: HolidayEntry[] = [
  // 2025
  { id: 'sg-2025-new-year', date: '2025-01-01', name: "New Year's Day", observed: true },
  { id: 'sg-2025-cny-1', date: '2025-01-29', name: 'Chinese New Year (Day 1)', observed: true },
  { id: 'sg-2025-cny-2', date: '2025-01-30', name: 'Chinese New Year (Day 2)', observed: true },
  { id: 'sg-2025-good-friday', date: '2025-04-18', name: 'Good Friday', observed: true },
  { id: 'sg-2025-labour-day', date: '2025-05-01', name: 'Labour Day', observed: true },
  { id: 'sg-2025-vesak', date: '2025-05-12', name: 'Vesak Day', observed: true },
  { id: 'sg-2025-hari-raya-haji', date: '2025-06-07', name: 'Hari Raya Haji', observed: true },
  { id: 'sg-2025-national-day', date: '2025-08-09', name: 'National Day', observed: true },
  { id: 'sg-2025-deepavali', date: '2025-10-20', name: 'Deepavali', observed: true },
  { id: 'sg-2025-christmas', date: '2025-12-25', name: 'Christmas Day', observed: true },
  { id: 'sg-2025-hari-raya-puasa', date: '2025-03-31', name: 'Hari Raya Puasa', observed: true },

  // 2026
  { id: 'sg-2026-new-year', date: '2026-01-01', name: "New Year's Day", observed: true },
  { id: 'sg-2026-cny-1', date: '2026-02-17', name: 'Chinese New Year (Day 1)', observed: true },
  { id: 'sg-2026-cny-2', date: '2026-02-18', name: 'Chinese New Year (Day 2)', observed: true },
  { id: 'sg-2026-hari-raya-puasa', date: '2026-03-20', name: 'Hari Raya Puasa', observed: true },
  { id: 'sg-2026-good-friday', date: '2026-04-03', name: 'Good Friday', observed: true },
  { id: 'sg-2026-labour-day', date: '2026-05-01', name: 'Labour Day', observed: true },
  { id: 'sg-2026-vesak', date: '2026-05-31', name: 'Vesak Day', observed: true },
  { id: 'sg-2026-hari-raya-haji', date: '2026-05-27', name: 'Hari Raya Haji', observed: true },
  { id: 'sg-2026-national-day', date: '2026-08-09', name: 'National Day', observed: true },
  { id: 'sg-2026-national-day-obs', date: '2026-08-10', name: 'National Day (Observed)', observed: true },
  { id: 'sg-2026-deepavali', date: '2026-11-08', name: 'Deepavali', observed: true },
  { id: 'sg-2026-christmas', date: '2026-12-25', name: 'Christmas Day', observed: true },
]

const stmt = db.prepare(
  `INSERT OR IGNORE INTO holidays (id, date, name, observed) VALUES (@id, @date, @name, @observed)`
)

const insertMany = db.transaction((entries: HolidayEntry[]) => {
  for (const entry of entries) {
    stmt.run({
      id: entry.id,
      date: entry.date,
      name: entry.name,
      observed: entry.observed ? 1 : 0,
    })
  }
})

insertMany(holidays)

const count = (db.prepare('SELECT COUNT(*) as cnt FROM holidays').get() as { cnt: number }).cnt
process.stdout.write(`Seeded ${count} Singapore holidays.\n`)

db.close()
