import { parseISO, isValid } from 'date-fns'

// A task date must parse AND land within this many years of today. Postgres
// `date` columns and <input type="date"> both accept years far outside the range
// JavaScript's Date can represent — a mistyped year such as 20206-09-04 saves
// without complaint, then turns the Gantt's timeline origin into an Invalid Date.
export const MAX_YEARS_FROM_TODAY = 5

export function parseTaskDate(value) {
  if (typeof value !== 'string' || value === '') return null
  const d = parseISO(value)
  return isValid(d) ? d : null
}

export function isDateInRange(date) {
  const year = new Date().getFullYear()
  return date.getFullYear() >= year - MAX_YEARS_FROM_TODAY
      && date.getFullYear() <= year + MAX_YEARS_FROM_TODAY
}

/**
 * Returns a message explaining why these dates can't be used, or '' if they're
 * fine. Empty dates are allowed — a task without them just won't chart.
 */
export function validateTaskDates(startValue, endValue) {
  for (const [label, value] of [['Start date', startValue], ['Due date', endValue]]) {
    if (!value) continue
    const d = parseTaskDate(value)
    if (!d) {
      return `${label} isn't a real date — check the year, it probably has an extra digit.`
    }
    if (!isDateInRange(d)) {
      // Pad so an early year reads as the 0202 the date field shows, not 202
      const year = String(d.getFullYear()).padStart(4, '0')
      return `${label} is in ${year}, more than ${MAX_YEARS_FROM_TODAY} years from today — check the year.`
    }
  }
  const start = parseTaskDate(startValue)
  const end   = parseTaskDate(endValue)
  if (start && end && end < start) return 'Due date is before the start date.'
  return ''
}
