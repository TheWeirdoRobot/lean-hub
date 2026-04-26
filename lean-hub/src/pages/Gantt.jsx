import { useState, useEffect, useRef } from 'react'
import { format, parseISO, differenceInDays, addDays, startOfWeek, getISOWeek } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import TaskModal from '../components/TaskModal'
import { ChevronRight, ChevronDown } from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────────────────

const PHASE_ORDER = ['Research', 'Design', 'Fabrication', 'Testing', 'Competition']

const PHASE_COLOR = {
  Research:    '#3B82F6',
  Design:      '#A855F7',
  Fabrication: '#F97316',
  Testing:     '#22C55E',
  Competition: '#EAB308',
}


const LW_NAME = 220   // name column in left panel
const LW_DATE = 100   // each date column in left panel
const LW      = LW_NAME + LW_DATE * 2   // total left panel width = 420
const ROW_H   = 40
const HDR_H   = 52   // 2-row header (month / week)
const DAY_W   = 20   // px per calendar day
const HNDL_W  = 8    // resize handle width
const MS_DAY  = 86_400_000

// ── Helpers ──────────────────────────────────────────────────────────────────

function toX(date, origin) {
  return differenceInDays(date, origin) * DAY_W
}

function darken(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (n >> 16) - 45)
  const g = Math.max(0, ((n >> 8) & 0xff) - 45)
  const b = Math.max(0, (n & 0xff) - 45)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GanttPage() {
  const { user } = useAuth()

  // ── State / refs (all hooks must be before any early return) ──
  const [tasks, setTasks]         = useState([])
  const [profiles, setProfiles]   = useState([])
  const [collapsed, setCollapsed] = useState(new Set())
  const [selectedTask, setSelectedTask] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [dragState, setDragState] = useState(null)  // { taskId, start, end }
  const [hoverId, setHoverId]     = useState(null)

  const headerRef     = useRef(null)   // div wrapping the header SVG (synced scroll)
  const leftRef       = useRef(null)   // left panel body (synced vertical scroll)
  const timelineRef   = useRef(null)   // the scrollable timeline container
  const dragging      = useRef(null)
  const activeHandlers = useRef({ move: null, up: null })
  const allTasksRef   = useRef([])

  useEffect(() => { allTasksRef.current = tasks }, [tasks])

  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user])

  // ── Data loading ────────────────────────────────────────────────────────────

  async function loadAll() {
    setLoading(true)
    await Promise.all([fetchProfiles(), fetchTasks()])
    setLoading(false)
  }

  async function fetchProfiles() {
    const { data } = await supabase.from('profiles').select('*')
    setProfiles(data || [])
  }

  async function fetchTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('*, assignee:profiles!tasks_assigned_to_fkey(id, full_name), creator:profiles!tasks_created_by_fkey(id, full_name)')
      .not('start_date', 'is', null)
      .not('end_date', 'is', null)
      .order('start_date', { ascending: true })
    setTasks(data || [])
  }

  // ── Drag / resize / click ───────────────────────────────────────────────────

  function onBarMouseDown(e, task, type) {
    e.preventDefault()
    e.stopPropagation()

    dragging.current = {
      task, type,
      startX:    e.clientX,
      origStart: parseISO(task.start_date),
      origEnd:   parseISO(task.end_date),
      hasMoved:  false,
      ghostStart: null,
      ghostEnd:   null,
    }

    const move = (ev) => {
      const d = dragging.current
      if (!d) return
      const dx = ev.clientX - d.startX
      if (Math.abs(dx) >= 3) d.hasMoved = true
      const days = Math.round(dx / DAY_W)
      let s = d.origStart, en = d.origEnd

      if (type === 'move') {
        s  = new Date(d.origStart.getTime() + days * MS_DAY)
        en = new Date(d.origEnd.getTime()   + days * MS_DAY)
      } else if (type === 'left') {
        s = new Date(d.origStart.getTime() + days * MS_DAY)
        if (s >= en) s = new Date(en.getTime() - MS_DAY)
      } else {
        en = new Date(d.origEnd.getTime() + days * MS_DAY)
        if (en <= s) en = new Date(s.getTime() + MS_DAY)
      }
      d.ghostStart = s
      d.ghostEnd   = en
      setDragState({ taskId: d.task.id, start: s, end: en })
    }

    const up = async () => {
      const d = dragging.current
      window.removeEventListener('mousemove', activeHandlers.current.move)
      window.removeEventListener('mouseup',   activeHandlers.current.up)
      document.body.style.userSelect = ''
      dragging.current = null
      setDragState(null)
      if (!d) return

      if (!d.hasMoved) {
        const raw = allTasksRef.current.find(t => t.id === d.task.id)
        if (raw) setSelectedTask(raw)
        return
      }

      if (d.ghostStart && d.ghostEnd) {
        await supabase.from('tasks').update({
          start_date: format(d.ghostStart, 'yyyy-MM-dd'),
          end_date:   format(d.ghostEnd,   'yyyy-MM-dd'),
        }).eq('id', d.task.id)
        await fetchTasks()
      }
    }

    activeHandlers.current = { move, up }
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup',   up)
  }

  // ── Modal handlers ───────────────────────────────────────────────────────────

  async function handleSave(id, updates) {
    const { error } = await supabase.from('tasks').update(updates).eq('id', id)
    if (error) throw new Error(error.message)
    await fetchTasks()
    setSelectedTask(null)
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setSelectedTask(null)
    await fetchTasks()
  }

  // ── Early returns (after all hooks) ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Gantt Chart</h1>
            <p className="page-subtitle">Loading…</p>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      </div>
    )
  }

  // ── Layout computations ──────────────────────────────────────────────────────

  // Visible rows (phase headers + tasks, respecting collapse)
  const visibleRows = []
  PHASE_ORDER.forEach(phase => {
    const phaseTasks = tasks.filter(t => t.phase === phase)
    if (!phaseTasks.length) return
    visibleRows.push({ id: `phase::${phase}`, type: 'phase', phase, count: phaseTasks.length, tasks: phaseTasks })
    if (!collapsed.has(phase)) {
      phaseTasks.forEach(task => visibleRows.push({ id: task.id, type: 'task', task, phase }))
    }
  })

  // Timeline date bounds
  const hasTasks = tasks.length > 0
  const rawMin = hasTasks ? new Date(Math.min(...tasks.map(t => parseISO(t.start_date).getTime()))) : new Date()
  const rawMax = hasTasks ? new Date(Math.max(...tasks.map(t => parseISO(t.end_date).getTime())))   : addDays(new Date(), 90)
  const origin = startOfWeek(addDays(rawMin, -7), { weekStartsOn: 1 })
  const tlEnd  = addDays(rawMax, 30)
  const svgW   = (differenceInDays(tlEnd, origin) + 1) * DAY_W
  const svgH   = Math.max(visibleRows.length * ROW_H, 320)

  // Today marker
  const todayX = toX(new Date(), origin)

  // Week columns
  const weeks = []
  let wCursor = origin
  while (wCursor <= tlEnd) { weeks.push(wCursor); wCursor = addDays(wCursor, 7) }

  // Month spans for upper header row
  const monthSpans = []
  let wi = 0
  while (wi < weeks.length) {
    const mo = format(weeks[wi], 'yyyy-MM')
    const si = wi
    while (wi < weeks.length && format(weeks[wi], 'yyyy-MM') === mo) wi++
    const x1 = toX(weeks[si], origin)
    const x2 = wi < weeks.length ? toX(weeks[wi], origin) : svgW
    monthSpans.push({ label: format(weeks[si], 'MMM yyyy'), x: x1, w: x2 - x1 })
  }

  function syncScroll(e) {
    if (headerRef.current)   headerRef.current.scrollLeft = e.target.scrollLeft
    if (leftRef.current)     leftRef.current.scrollTop    = e.target.scrollTop
  }

  function toggleCollapse(phase) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(phase) ? next.delete(phase) : next.add(phase)
      return next
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Gantt Chart</h1>
          <p className="page-subtitle">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} on timeline · drag bars to move or resize
          </p>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {PHASE_ORDER.map(phase => (
            <div key={phase} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: PHASE_COLOR[phase] }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{phase}</span>
            </div>
          ))}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 15, fontWeight: 500 }}>No tasks with start & end dates</p>
          <p style={{ fontSize: 13 }}>Add dates to tasks on the Kanban board to see them here</p>
        </div>
      ) : (
        <div style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #2D2D5E',
          borderRadius: 14,
          overflow: 'hidden',
          background: '#0D0D1A',
        }}>

          {/* ── Fixed header row ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid #2D2D5E', background: '#0D0D1A', zIndex: 4 }}>

            {/* Left panel header */}
            <div style={{
              width: LW, flexShrink: 0,
              display: 'flex', alignItems: 'flex-end',
              height: HDR_H,
              borderRight: '1px solid #2D2D5E',
              background: '#0D0D1A',
            }}>
              <div style={{ width: LW_NAME, padding: '0 12px 10px', fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Task</div>
              <div style={{ width: LW_DATE, paddingBottom: 10, fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>From</div>
              <div style={{ width: LW_DATE, paddingBottom: 10, fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>To</div>
            </div>

            {/* Timeline header — hidden overflow, scrolled via JS */}
            <div ref={headerRef} style={{ flex: 1, overflow: 'hidden' }}>
              <svg width={svgW} height={HDR_H} style={{ display: 'block' }}>
                <rect x={0} y={0} width={svgW} height={HDR_H} fill="#0D0D1A" />

                {/* Month labels (upper row) */}
                {monthSpans.map(ms => (
                  <g key={ms.label + ms.x}>
                    <line x1={ms.x} x2={ms.x} y1={0} y2={HDR_H} stroke="#2D2D5E" strokeWidth={1} />
                    {ms.w > 40 && (
                      <text x={ms.x + 8} y={20} fill="#F1F5F9" fontSize={11} fontWeight={600} fontFamily="Inter, sans-serif">
                        {ms.label}
                      </text>
                    )}
                  </g>
                ))}

                {/* Divider between month and week rows */}
                <line x1={0} x2={svgW} y1={HDR_H / 2} y2={HDR_H / 2} stroke="#2D2D5E" strokeWidth={1} />

                {/* Week labels (lower row) */}
                {weeks.map(wk => {
                  const x = toX(wk, origin)
                  return (
                    <g key={wk.toISOString()}>
                      <line x1={x} x2={x} y1={HDR_H / 2} y2={HDR_H} stroke="#2D2D5E" strokeWidth={1} />
                      <text x={x + 4} y={HDR_H - 7} fill="#64748B" fontSize={10} fontFamily="Inter, sans-serif">
                        W{getISOWeek(wk)}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>

          {/* ── Body: left panel + timeline ──────────────────────────────── */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

            {/* Left panel rows (vertical scroll synced via JS) */}
            <div
              ref={leftRef}
              style={{
                width: LW, flexShrink: 0,
                borderRight: '1px solid #2D2D5E',
                overflowY: 'hidden',
                background: '#0D0D1A',
              }}
            >
              {visibleRows.map(row => {
                const isPhase     = row.type === 'phase'
                const isCollapsed = isPhase && collapsed.has(row.phase)
                const color       = PHASE_COLOR[row.phase ?? row.task?.phase]

                return (
                  <div
                    key={row.id}
                    style={{
                      height: ROW_H, flexShrink: 0,
                      display: 'flex', alignItems: 'center',
                      borderBottom: '1px solid #2D2D5E',
                      background: isPhase ? '#1A1A35' : 'transparent',
                    }}
                  >
                    {isPhase ? (
                      <button
                        onClick={() => toggleCollapse(row.phase)}
                        style={{
                          width: LW, height: '100%',
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '0 12px',
                          background: 'none', border: 'none',
                          cursor: 'pointer',
                          color: '#E2E8F0', fontWeight: 600, fontSize: 13,
                          textAlign: 'left',
                        }}
                      >
                        {isCollapsed
                          ? <ChevronRight size={14} color="#94A3B8" />
                          : <ChevronDown  size={14} color="#94A3B8" />
                        }
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                        {row.phase}
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748B', fontWeight: 400 }}>
                          {row.count}
                        </span>
                      </button>
                    ) : (
                      <>
                        <div style={{
                          width: LW_NAME, flexShrink: 0,
                          padding: '0 8px 0 28px',
                          fontSize: 12, color: '#E2E8F0',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {row.task.title}
                        </div>
                        <div style={{ width: LW_DATE, flexShrink: 0, fontSize: 11, color: '#64748B', textAlign: 'center' }}>
                          {format(parseISO(row.task.start_date), 'MMM d')}
                        </div>
                        <div style={{ width: LW_DATE, flexShrink: 0, fontSize: 11, color: '#64748B', textAlign: 'center' }}>
                          {format(parseISO(row.task.end_date), 'MMM d')}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Timeline SVG (primary scroll container) */}
            <div
              ref={timelineRef}
              onScroll={syncScroll}
              style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}
            >
              <svg
                width={svgW}
                height={svgH}
                style={{ display: 'block' }}
              >
                {/* ── Row backgrounds ── */}
                {visibleRows.map((row, i) => (
                  <rect
                    key={row.id + '-bg'}
                    x={0} y={i * ROW_H} width={svgW} height={ROW_H}
                    fill={row.type === 'phase' ? '#1A1A35' : i % 2 === 0 ? '#111127' : '#0D0D1A'}
                  />
                ))}

                {/* ── Vertical week grid lines ── */}
                {weeks.map(wk => {
                  const x = toX(wk, origin)
                  return <line key={wk.toISOString()} x1={x} x2={x} y1={0} y2={svgH} stroke="#2D2D5E" strokeWidth={1} />
                })}

                {/* ── Horizontal row dividers ── */}
                {visibleRows.map((_, i) => (
                  <line key={i + '-hdiv'} x1={0} x2={svgW} y1={(i + 1) * ROW_H} y2={(i + 1) * ROW_H} stroke="#2D2D5E" strokeWidth={1} />
                ))}

                {/* ── Today line ── */}
                {todayX > 0 && todayX < svgW && (
                  <line
                    x1={todayX} x2={todayX} y1={0} y2={svgH}
                    stroke="#7C3AED" strokeWidth={1.5} strokeDasharray="5 4"
                  />
                )}

                {/* ── Task bars ── */}
                {visibleRows.map((row, i) => {
                  const y = i * ROW_H

                  if (row.type === 'phase') {
                    const ps = new Date(Math.min(...row.tasks.map(t => parseISO(t.start_date).getTime())))
                    const pe = new Date(Math.max(...row.tasks.map(t => parseISO(t.end_date).getTime())))
                    const bx = toX(ps, origin)
                    const bw = Math.max(DAY_W, (differenceInDays(pe, ps) + 1) * DAY_W)
                    return (
                      <rect
                        key={row.id + '-pbar'}
                        x={bx} y={y + ROW_H * 0.35}
                        width={bw} height={ROW_H * 0.3}
                        rx={3}
                        fill={PHASE_COLOR[row.phase] || '#64748B'}
                        opacity={0.35}
                        style={{ pointerEvents: 'none' }}
                      />
                    )
                  }

                  // Task bar
                  const task  = row.task
                  const ghost = dragState?.taskId === task.id ? dragState : null
                  const ds    = ghost ? ghost.start : parseISO(task.start_date)
                  const de    = ghost ? ghost.end   : parseISO(task.end_date)
                  const bx    = toX(ds, origin)
                  const bw    = Math.max(DAY_W, (differenceInDays(de, ds) + 1) * DAY_W)
                  const barY  = y + 5
                  const barH  = ROW_H - 10
                  const color = PHASE_COLOR[row.phase] || '#64748B'
                  const isHov = hoverId === task.id
                  const hW    = bw >= HNDL_W * 2 ? HNDL_W : Math.floor(bw / 2)
                  const innerW = Math.max(1, bw - hW * 2)
                  const pct   = { done: 100, review: 75, in_progress: 50, not_started: 0 }[task.status] ?? 0

                  return (
                    <g
                      key={task.id}
                      onMouseEnter={() => setHoverId(task.id)}
                      onMouseLeave={() => setHoverId(null)}
                    >
                      {/* Left resize handle */}
                      <rect
                        x={bx} y={barY} width={hW} height={barH} rx={3}
                        fill={isHov ? darken(color) : color}
                        opacity={ghost ? 0.75 : 1}
                        style={{ cursor: 'ew-resize' }}
                        onMouseDown={e => onBarMouseDown(e, task, 'left')}
                      />

                      {/* Bar body */}
                      <rect
                        x={bx + hW} y={barY} width={innerW} height={barH} rx={0}
                        fill={color}
                        opacity={ghost ? 0.75 : 1}
                        style={{ cursor: ghost ? 'grabbing' : 'grab' }}
                        onMouseDown={e => onBarMouseDown(e, task, 'move')}
                      />

                      {/* Progress fill */}
                      {pct > 0 && (
                        <rect
                          x={bx + hW} y={barY}
                          width={innerW * (pct / 100)} height={barH}
                          rx={0}
                          fill="rgba(255,255,255,0.18)"
                          style={{ pointerEvents: 'none' }}
                        />
                      )}

                      {/* Right resize handle */}
                      <rect
                        x={bx + bw - hW} y={barY} width={hW} height={barH} rx={3}
                        fill={isHov ? darken(color) : color}
                        opacity={ghost ? 0.75 : 1}
                        style={{ cursor: 'ew-resize' }}
                        onMouseDown={e => onBarMouseDown(e, task, 'right')}
                      />

                      {/* Label (clipped to bar) */}
                      <clipPath id={`clip-${task.id}`}>
                        <rect x={bx} y={barY} width={bw} height={barH} />
                      </clipPath>
                      <text
                        x={bx + hW + 6} y={barY + barH / 2 + 4}
                        fill="white" fontSize={11} fontWeight={500}
                        fontFamily="Inter, sans-serif"
                        clipPath={`url(#clip-${task.id})`}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {task.title}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>
        </div>
      )}

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          profiles={profiles}
          onClose={() => setSelectedTask(null)}
          onSave={handleSave}
          onDelete={handleDelete}
          onCreate={() => {}}
        />
      )}
    </div>
  )
}
