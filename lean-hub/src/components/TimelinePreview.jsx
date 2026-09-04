import { format, addDays, differenceInDays, startOfDay } from 'date-fns'
import { parseTaskDate, isDateInRange } from '../lib/dates'

// A squeezed copy of the full chart would be unreadable at this size, so this
// shows a fixed near-term window instead — the part you actually act on.
const DAYS_BEFORE = 3
const DAYS_AFTER  = 32
const MAX_ROWS    = 7

export default function TimelinePreview({ tasks, phaseColorMap, onOpenTask }) {
  const today = startOfDay(new Date())
  const from  = addDays(today, -DAYS_BEFORE)
  const to    = addDays(today, DAYS_AFTER)
  const span  = differenceInDays(to, from) + 1

  const pct = date => (differenceInDays(startOfDay(date), from) / span) * 100

  const rows = tasks
    .map(t => ({ task: t, start: parseTaskDate(t.start_date), end: parseTaskDate(t.end_date) }))
    .filter(r => r.start && r.end && isDateInRange(r.start) && isDateInRange(r.end))
    .filter(r => r.end >= from && r.start <= to)
    .sort((a, b) => a.start - b.start || a.task.title.localeCompare(b.task.title))

  const shown  = rows.slice(0, MAX_ROWS)
  const hidden = rows.length - shown.length

  // Week gridlines across the window
  const ticks = []
  for (let d = 0; d <= span; d += 7) ticks.push(addDays(from, d))

  if (rows.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0 4px' }}>
        Nothing scheduled in the next {DAYS_AFTER} days.
      </p>
    )
  }

  return (
    <div>
      {/* Week ruler */}
      <div style={{ display: 'flex', marginBottom: 6, paddingLeft: 150 }}>
        <div style={{ position: 'relative', flex: 1, height: 14 }}>
          {ticks.map((d, i) => (
            <span
              key={i}
              style={{
                position: 'absolute', left: `${pct(d)}%`,
                fontSize: 10, color: 'var(--text-muted)',
                transform: 'translateX(-2px)', whiteSpace: 'nowrap',
              }}
            >
              {format(d, 'MMM d')}
            </span>
          ))}
        </div>
      </div>

      {shown.map(({ task, start, end }) => {
        const left  = Math.max(0, pct(start))
        const right = Math.min(100, pct(end) + (100 / span))
        const width = Math.max(1.5, right - left)
        const color = phaseColorMap?.[task.phase] || 'var(--accent)'
        return (
          <button
            key={task.id}
            onClick={() => onOpenTask?.(task)}
            style={{
              display: 'flex', alignItems: 'center', width: '100%',
              padding: '4px 0', textAlign: 'left', color: 'inherit',
            }}
          >
            <span
              style={{
                width: 150, flexShrink: 0, paddingRight: 12,
                fontSize: 12, color: 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
              title={task.title}
            >
              {task.title}
            </span>
            <span style={{ position: 'relative', flex: 1, height: 20 }}>
              {/* week gridlines */}
              {ticks.map((d, i) => (
                <span key={i} style={{
                  position: 'absolute', left: `${pct(d)}%`, top: 0, bottom: 0,
                  width: 1, background: 'var(--border)',
                }} />
              ))}
              {/* today */}
              <span style={{
                position: 'absolute', left: `${pct(today)}%`, top: -2, bottom: -2,
                width: 2, background: '#F97316', opacity: 0.7, borderRadius: 1,
              }} />
              {/* bar */}
              <span
                title={`${format(start, 'MMM d')} → ${format(end, 'MMM d')}`}
                style={{
                  position: 'absolute', left: `${left}%`, width: `${width}%`,
                  top: 3, height: 14, borderRadius: 3, background: color,
                }}
              />
            </span>
          </button>
        )
      })}

      {hidden > 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          +{hidden} more in this window
        </p>
      )}
    </div>
  )
}
