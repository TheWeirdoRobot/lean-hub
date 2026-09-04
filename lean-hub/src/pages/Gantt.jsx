import { useState, useEffect, useRef, useMemo } from 'react'
import { format, parseISO, differenceInDays, addDays, getDay, isValid } from 'date-fns'
import { Download, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import TaskModal from '../components/TaskModal'
import { useCustomPhases } from '../hooks/useCustomPhases'
import { parseTaskDate, isDateInRange, MAX_YEARS_FROM_TODAY } from '../lib/dates'

// ── Constants ────────────────────────────────────────────────────────────────

const LW_NAME = 220
const LW_DATE = 100
const LW      = LW_NAME + LW_DATE * 2   // 420px total left panel
const ROW_H   = 48
const HDR_H   = 72                       // 3 rows × 24px each
const ROW1    = 24                       // month label row height
const ROW2    = 24                       // day number row height
const ROW3    = 24                       // day-of-week row height
const DAY_W   = 36
const HNDL_W  = 8
const MS_DAY  = 86_400_000
const DOW     = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

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

function subTeamAbbr(st) {
  if (st === 'Mechanical') return 'MT'
  if (st === 'Electrical') return 'ET'
  return 'FT'
}

function subTeamColor(st) {
  if (st === 'Mechanical') return '#DE9260'
  if (st === 'Electrical') return '#D9A73F'
  return '#6CA6E8'
}

function isWeekend(date) {
  const d = getDay(date)
  return d === 0 || d === 6
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GanttPage() {
  const { user } = useAuth()
  const { phases, phaseColorMap, loading: phasesLoading } = useCustomPhases()

  const [tasks, setTasks]           = useState([])
  const [profiles, setProfiles]     = useState([])
  const [selectedTask, setSelectedTask] = useState(null)
  const [tasksLoading, setTasksLoading] = useState(true)
  const [dragState, setDragState]   = useState(null)
  const [hoverId, setHoverId]       = useState(null)
  const [tooltip, setTooltip]       = useState(null)

  const headerRef   = useRef(null)
  const leftRef     = useRef(null)
  const timelineRef = useRef(null)
  const dragging    = useRef(null)
  const activeHandlers = useRef({ move: null, up: null })
  const allTasksRef = useRef([])
  const didAutoScroll = useRef(false)

  useEffect(() => { allTasksRef.current = tasks }, [tasks])

  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user])

  // Live sync: pick up teammates' task changes without a manual refresh
  useEffect(() => {
    const channel = supabase
      .channel('gantt-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        // Refetching mid-drag would yank the bar out from under the cursor;
        // the drag's own save refetches when it finishes.
        if (dragging.current) return
        fetchTasks()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const loading = tasksLoading || phasesLoading

  // Split off tasks whose dates can't be charted so one bad row can't break the page
  const { datedTasks, skippedTasks } = useMemo(() => {
    const ok = [], bad = []
    for (const t of tasks) {
      const s = parseTaskDate(t.start_date)
      const e = parseTaskDate(t.end_date)
      if (s && e && isDateInRange(s) && isDateInRange(e)) ok.push(t)
      else bad.push(t)
    }
    return { datedTasks: ok, skippedTasks: bad }
  }, [tasks])

  // On first render with data, jump the timeline so today sits near the left edge
  useEffect(() => {
    if (loading || didAutoScroll.current || datedTasks.length === 0) return
    const el = timelineRef.current
    if (!el) return
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const rawMin = new Date(Math.min(...datedTasks.map(t => parseISO(t.start_date).getTime())))
    const origin = addDays(rawMin, -3)
    const todayX = differenceInDays(today, origin) * DAY_W
    el.scrollLeft = Math.max(0, todayX - Math.floor(el.clientWidth / 4))
    didAutoScroll.current = true
  }, [loading, datedTasks])

  // Mouse wheel pans the timeline horizontally (Shift+wheel scrolls rows).
  // Native listener because React registers wheel as passive, blocking preventDefault.
  useEffect(() => {
    const el = timelineRef.current
    if (!el || loading || datedTasks.length === 0) return
    function onWheel(e) {
      if (e.ctrlKey) return // let browser zoom through
      const mult = e.deltaMode === 1 ? 40 : 1
      if (e.shiftKey) {
        el.scrollTop += e.deltaY * mult
      } else {
        el.scrollLeft += (e.deltaY + e.deltaX) * mult
      }
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [loading, datedTasks.length])

  // ── Data loading ────────────────────────────────────────────────────────────

  async function loadAll() {
    setTasksLoading(true)
    await Promise.all([fetchProfiles(), fetchTasks()])
    setTasksLoading(false)
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
    setTasks(data || [])
  }

  // ── Drag / resize ───────────────────────────────────────────────────────────

  function onBarMouseDown(e, task, type) {
    e.preventDefault()
    e.stopPropagation()
    setTooltip(null)

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

      if (isValid(d.ghostStart) && isValid(d.ghostEnd)) {
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

  // ── Export PNG (drawn directly on canvas: title + legend + panel + header + bars) ──

  function exportPNG() {
    if (visibleRows.length === 0) return

    const TITLE_H = 64
    const PAD     = 16
    const bodyH   = visibleRows.length * ROW_H
    const totalW  = LW + svgW
    const totalH  = TITLE_H + HDR_H + bodyH
    const scale   = Math.min(2, 16000 / totalW, 16000 / totalH)

    const canvas  = document.createElement('canvas')
    canvas.width  = Math.round(totalW * scale)
    canvas.height = Math.round(totalH * scale)
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)

    const FONT = 'Inter, sans-serif'
    const line = (x1, y1, x2, y2, color, width = 1) => {
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(x1 + 0.5, y1 + 0.5)
      ctx.lineTo(x2 + 0.5, y2 + 0.5)
      ctx.stroke()
    }
    const roundedRect = (x, y, w, h, r) => {
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
      else ctx.rect(x, y, w, h)
    }
    const truncate = (text, maxW) => {
      if (ctx.measureText(text).width <= maxW) return text
      let t = text
      while (t.length > 0 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
      return t + '…'
    }

    // Background
    ctx.fillStyle = '#101014'
    ctx.fillRect(0, 0, totalW, totalH)

    // ── Title bar ──
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#EDEDF2'
    ctx.font = `600 15px ${FONT}`
    ctx.fillText('LEAN Hub — Project Timeline', PAD, 27)
    ctx.fillStyle = '#70707C'
    ctx.font = `400 11px ${FONT}`
    ctx.fillText(
      `Exported ${format(new Date(), 'MMM d, yyyy')} · ${visibleRows.length} task${visibleRows.length !== 1 ? 's' : ''}`,
      PAD, 46,
    )

    // Phase legend, right-aligned in the title bar
    ctx.font = `500 11px ${FONT}`
    const legendItems = phases.map(p => ({ ...p, w: 16 + ctx.measureText(p.name).width + 18 }))
    const legendW = legendItems.reduce((s, i) => s + i.w, 0)
    let lx = totalW - PAD - legendW
    if (lx > 320) {
      for (const it of legendItems) {
        ctx.fillStyle = it.color
        roundedRect(lx, 23, 10, 10, 2)
        ctx.fill()
        ctx.fillStyle = '#A2A2AE'
        ctx.fillText(it.name, lx + 16, 32)
        lx += it.w
      }
    }
    line(0, TITLE_H, totalW, TITLE_H, '#26262E')

    // ── Header: left panel column labels ──
    ctx.fillStyle = '#70707C'
    ctx.font = `600 10px ${FONT}`
    ctx.fillText('TASK', 12, TITLE_H + HDR_H - 10)
    ctx.textAlign = 'center'
    ctx.fillText('FROM', LW_NAME + LW_DATE / 2, TITLE_H + HDR_H - 10)
    ctx.fillText('TO',   LW_NAME + LW_DATE * 1.5, TITLE_H + HDR_H - 10)
    ctx.textAlign = 'left'

    // ── Header: month labels ──
    ctx.font = `600 11px ${FONT}`
    for (const ms of monthSpans) {
      line(LW + ms.x, TITLE_H, LW + ms.x, TITLE_H + ROW1, '#26262E')
      if (ms.w >= 60) {
        ctx.fillStyle = '#EDEDF2'
        ctx.fillText(ms.label, LW + ms.x + 8, TITLE_H + ROW1 - 7)
      }
    }
    line(LW, TITLE_H + ROW1, totalW, TITLE_H + ROW1, '#26262E')

    // ── Header: day numbers + day-of-week ──
    ctx.textAlign = 'center'
    days.forEach((d, i) => {
      const x = LW + i * DAY_W
      const weekend = isWeekend(d)
      const isToday = i === todayOffset
      if (weekend) {
        ctx.fillStyle = '#0B0B0E'
        ctx.fillRect(x, TITLE_H + ROW1, DAY_W, ROW2 + ROW3)
      }
      line(x, TITLE_H + ROW1, x, TITLE_H + HDR_H, '#202028')
      ctx.font = isToday ? `700 11px ${FONT}` : `400 11px ${FONT}`
      ctx.fillStyle = isToday ? '#F97316' : weekend ? '#4E4E58' : '#A2A2AE'
      ctx.fillText(format(d, 'd'), x + DAY_W / 2, TITLE_H + ROW1 + ROW2 - 6)
      ctx.font = `400 9px ${FONT}`
      ctx.fillStyle = weekend ? '#3A3A42' : '#56565F'
      ctx.fillText(DOW[getDay(d)], x + DAY_W / 2, TITLE_H + HDR_H - 6)
    })
    ctx.textAlign = 'left'
    line(LW, TITLE_H + ROW1 + ROW2, totalW, TITLE_H + ROW1 + ROW2, '#26262E')
    line(0, TITLE_H + HDR_H, totalW, TITLE_H + HDR_H, '#26262E')

    const yB = TITLE_H + HDR_H

    // ── Body: timeline background (weekends, row stripes, grid) ──
    days.forEach((d, i) => {
      if (!isWeekend(d)) return
      ctx.fillStyle = '#0B0B0E'
      ctx.fillRect(LW + i * DAY_W, yB, DAY_W, bodyH)
    })
    visibleRows.forEach((_, i) => {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(23,23,28,0.55)' : 'rgba(18,18,23,0.55)'
      ctx.fillRect(LW, yB + i * ROW_H, svgW, ROW_H)
    })
    days.forEach((_, i) => line(LW + i * DAY_W, yB, LW + i * DAY_W, yB + bodyH, '#1C1C22'))
    visibleRows.forEach((_, i) => line(LW, yB + (i + 1) * ROW_H, totalW, yB + (i + 1) * ROW_H, '#26262E'))

    // ── Body: left panel rows ──
    ctx.textBaseline = 'middle'
    visibleRows.forEach((row, i) => {
      const task = row.task
      const y    = yB + i * ROW_H
      const cy   = y + ROW_H / 2
      ctx.fillStyle = i % 2 === 0 ? '#17171C' : '#121217'
      ctx.fillRect(0, y, LW, ROW_H)
      line(0, y + ROW_H, LW, y + ROW_H, '#26262E')

      // Sub-team chip, right-aligned in the name column
      const abbr  = subTeamAbbr(task.sub_team)
      const stCol = subTeamColor(task.sub_team)
      ctx.font = `700 9px ${FONT}`
      const chipTextW = ctx.measureText(abbr).width
      const chipW = chipTextW + 10
      const chipX = LW_NAME - chipW - 8
      ctx.fillStyle = stCol + '26'
      roundedRect(chipX, cy - 7, chipW, 14, 4)
      ctx.fill()
      ctx.strokeStyle = stCol + '55'
      ctx.lineWidth = 1
      roundedRect(chipX + 0.5, cy - 6.5, chipW - 1, 13, 4)
      ctx.stroke()
      ctx.fillStyle = stCol
      ctx.fillText(abbr, chipX + 5, cy + 0.5)

      // Task title, truncated to fit before the chip
      ctx.font = `400 12px ${FONT}`
      ctx.fillStyle = '#EDEDF2'
      ctx.fillText(truncate(task.title, chipX - 12 - 6), 12, cy)

      // From / to dates
      ctx.font = `400 11px ${FONT}`
      ctx.fillStyle = '#8A8A94'
      ctx.textAlign = 'center'
      ctx.fillText(format(parseISO(task.start_date), 'MMM d'), LW_NAME + LW_DATE / 2, cy)
      ctx.fillText(format(parseISO(task.end_date), 'MMM d'), LW_NAME + LW_DATE * 1.5, cy)
      ctx.textAlign = 'left'
    })

    // ── Body: task bars ──
    visibleRows.forEach((row, i) => {
      const task  = row.task
      const ds    = parseISO(task.start_date)
      const de    = parseISO(task.end_date)
      const bx    = LW + toX(ds, origin)
      const dur   = differenceInDays(de, ds) + 1
      const bw    = Math.max(DAY_W, dur * DAY_W)
      const barY  = yB + i * ROW_H + 7
      const barH  = ROW_H - 14
      const color = phaseColorMap[task.phase] || '#70707C'
      const pct   = { done: 100, review: 75, in_progress: 50, not_started: 0 }[task.status] ?? 0

      ctx.fillStyle = color
      roundedRect(bx, barY, bw, barH, 4)
      ctx.fill()

      ctx.save()
      roundedRect(bx, barY, bw, barH, 4)
      ctx.clip()
      if (pct > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)'
        ctx.fillRect(bx, barY, bw * (pct / 100), barH)
      }
      ctx.font = `500 11px ${FONT}`
      ctx.fillStyle = '#FFFFFF'
      ctx.fillText(`${task.title} · ${subTeamAbbr(task.sub_team)}`, bx + 8, barY + barH / 2)
      ctx.restore()
    })

    // ── Today marker ──
    if (todayOffset >= 0 && todayOffset < totalDays) {
      ctx.setLineDash([5, 4])
      line(LW + todayX, yB, LW + todayX, yB + bodyH, '#F97316', 1.5)
      ctx.setLineDash([])
    }

    // Panel divider + outer border
    line(LW, TITLE_H, LW, totalH, '#26262E')
    ctx.strokeStyle = '#26262E'
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, 0.5, totalW - 1, totalH - 1)

    canvas.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.download = `gantt-${format(new Date(), 'yyyy-MM-dd')}.png`
      a.href = url
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5_000)
    }, 'image/png')
  }

  // ── Loading state ─────────────────────────────────────────────────────────────

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

  const visibleRows = [...datedTasks]
    .sort((a, b) => {
      const d = a.start_date.localeCompare(b.start_date)
      if (d !== 0) return d
      return a.title.localeCompare(b.title)
    })
    .map(task => ({ id: task.id, task }))

  const hasTasks = datedTasks.length > 0
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const rawMin = hasTasks
    ? new Date(Math.min(...datedTasks.map(t => parseISO(t.start_date).getTime())))
    : new Date(today.getFullYear(), today.getMonth(), 1)
  const rawMax = hasTasks
    ? new Date(Math.max(...datedTasks.map(t => parseISO(t.end_date).getTime())))
    : new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const origin    = addDays(rawMin, -3)
  const tlEnd     = addDays(rawMax, 3)
  const totalDays = differenceInDays(tlEnd, origin) + 1
  const svgW      = totalDays * DAY_W
  const svgH      = Math.max(visibleRows.length * ROW_H, 320)

  // Build day array
  const days = Array.from({ length: totalDays }, (_, i) => addDays(origin, i))

  // Group days by month for header row 1
  const monthSpans = []
  let mi = 0
  while (mi < days.length) {
    const mo = format(days[mi], 'yyyy-MM')
    const si = mi
    while (mi < days.length && format(days[mi], 'yyyy-MM') === mo) mi++
    monthSpans.push({ label: format(days[si], 'MMM yyyy'), x: si * DAY_W, w: (mi - si) * DAY_W })
  }

  const todayOffset = differenceInDays(today, origin)
  const todayX      = todayOffset * DAY_W

  function syncScroll(e) {
    if (headerRef.current)  headerRef.current.scrollLeft = e.target.scrollLeft
    if (leftRef.current)    leftRef.current.scrollTop    = e.target.scrollTop
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .gantt-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .gantt-scroll::-webkit-scrollbar-track { background: #0C0C0F; }
        .gantt-scroll::-webkit-scrollbar-thumb { background: #26262E; border-radius: 4px; }
        .gantt-scroll::-webkit-scrollbar-thumb:hover { background: #3E3E4A; }
        .gantt-scroll::-webkit-scrollbar-corner { background: #0C0C0F; }
      `}</style>

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Gantt Chart</h1>
          <p className="page-subtitle">
            {datedTasks.length} task{datedTasks.length !== 1 ? 's' : ''} · drag bars to move or resize · scroll to pan, Shift+scroll for rows
          </p>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {phases.map(phase => (
            <div key={phase.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: phase.color }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{phase.name}</span>
            </div>
          ))}
          <button
            className="btn btn-secondary"
            onClick={exportPNG}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <Download size={14} /> Export PNG
          </button>
        </div>
      </div>

      {skippedTasks.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 9,
          padding: '10px 14px', marginBottom: 16,
          background: 'rgba(210,153,34,0.09)',
          border: '1px solid rgba(210,153,34,0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#D9A73F', fontSize: 13,
        }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {skippedTasks.length} task{skippedTasks.length !== 1 ? 's' : ''} not charted — the start or due date is unreadable or more than {MAX_YEARS_FROM_TODAY} years from today:{' '}
            <strong style={{ fontWeight: 600 }}>
              {skippedTasks.slice(0, 3).map(t => t.title).join(', ')}
              {skippedTasks.length > 3 ? ` and ${skippedTasks.length - 3} more` : ''}
            </strong>
            . Fix the dates on the Tasks board to include {skippedTasks.length !== 1 ? 'them' : 'it'} here.
          </span>
        </div>
      )}

      {datedTasks.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 15, fontWeight: 500 }}>No tasks with start &amp; end dates</p>
          <p style={{ fontSize: 13 }}>Add dates to tasks on the Kanban board to see them here</p>
        </div>
      ) : (
        <div style={{
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
          border: '1px solid #26262E', borderRadius: 14, overflow: 'hidden', background: '#101014',
        }}>

          {/* ── Fixed 3-row header ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid #26262E', background: '#101014', zIndex: 4 }}>

            {/* Left panel header */}
            <div style={{
              width: LW, flexShrink: 0, display: 'flex', alignItems: 'flex-end',
              height: HDR_H, borderRight: '1px solid #26262E', background: '#101014',
            }}>
              <div style={{ width: LW_NAME, padding: '0 12px 10px', fontSize: 11, fontWeight: 600, color: '#70707C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Task</div>
              <div style={{ width: LW_DATE, paddingBottom: 10, fontSize: 11, fontWeight: 600, color: '#70707C', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>From</div>
              <div style={{ width: LW_DATE, paddingBottom: 10, fontSize: 11, fontWeight: 600, color: '#70707C', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>To</div>
            </div>

            {/* Timeline header (hidden overflow, synced with body scroll) */}
            <div ref={headerRef} style={{ flex: 1, overflow: 'hidden' }}>
              <svg width={svgW} height={HDR_H} style={{ display: 'block' }}>
                <rect x={0} y={0} width={svgW} height={HDR_H} fill="#101014" />

                {/* Row 1 — Month labels */}
                {monthSpans.map(ms => (
                  <g key={ms.label + ms.x}>
                    <line x1={ms.x} x2={ms.x} y1={0} y2={ROW1} stroke="#26262E" strokeWidth={1} />
                    {ms.w >= 36 && (
                      <text x={ms.x + 8} y={ROW1 - 7} fill="#EDEDF2" fontSize={11} fontWeight={600} fontFamily="Inter, sans-serif">
                        {ms.label}
                      </text>
                    )}
                  </g>
                ))}
                <line x1={0} x2={svgW} y1={ROW1} y2={ROW1} stroke="#26262E" strokeWidth={1} />

                {/* Row 2 — Day numbers */}
                {days.map((d, i) => {
                  const x       = i * DAY_W
                  const weekend = isWeekend(d)
                  const isToday = i === todayOffset
                  return (
                    <g key={`dn-${i}`}>
                      {weekend && <rect x={x} y={ROW1} width={DAY_W} height={ROW2 + ROW3} fill="#0B0B0E" />}
                      <line x1={x} x2={x} y1={ROW1} y2={ROW1 + ROW2} stroke="#202028" strokeWidth={1} />
                      <text
                        x={x + DAY_W / 2} y={ROW1 + ROW2 - 6}
                        fill={isToday ? '#F97316' : weekend ? '#4E4E58' : '#A2A2AE'}
                        fontSize={11} fontWeight={isToday ? 700 : 400}
                        fontFamily="Inter, sans-serif" textAnchor="middle"
                      >
                        {format(d, 'd')}
                      </text>
                    </g>
                  )
                })}
                <line x1={0} x2={svgW} y1={ROW1 + ROW2} y2={ROW1 + ROW2} stroke="#26262E" strokeWidth={1} />

                {/* Row 3 — Day-of-week abbreviations */}
                {days.map((d, i) => {
                  const x       = i * DAY_W
                  const dow     = getDay(d)
                  const weekend = dow === 0 || dow === 6
                  return (
                    <g key={`dow-${i}`}>
                      <line x1={x} x2={x} y1={ROW1 + ROW2} y2={HDR_H} stroke="#202028" strokeWidth={1} />
                      <text
                        x={x + DAY_W / 2} y={HDR_H - 6}
                        fill={weekend ? '#3A3A42' : '#56565F'}
                        fontSize={9} fontFamily="Inter, sans-serif" textAnchor="middle"
                      >
                        {DOW[dow]}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>

          {/* ── Body: left panel + timeline ──────────────────────────────── */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

            {/* Left panel (synced vertical scroll) */}
            <div
              ref={leftRef}
              style={{ width: LW, flexShrink: 0, borderRight: '1px solid #26262E', overflowY: 'hidden', background: '#101014' }}
            >
              {visibleRows.map((row, i) => {
                const task  = row.task
                const abbr  = subTeamAbbr(task.sub_team)
                const stCol = subTeamColor(task.sub_team)
                const rowBg = i % 2 === 0 ? '#17171C' : '#121217'
                return (
                  <div
                    key={row.id}
                    style={{ height: ROW_H, flexShrink: 0, display: 'flex', alignItems: 'center', borderBottom: '1px solid #26262E', background: rowBg }}
                  >
                    <div style={{ width: LW_NAME, flexShrink: 0, padding: '0 6px 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: '#EDEDF2', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.title}
                      </span>
                      <span style={{
                        padding: '1px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700, flexShrink: 0,
                        background: stCol + '22', color: stCol, border: `1px solid ${stCol}44`,
                      }}>
                        {abbr}
                      </span>
                    </div>
                    <div style={{ width: LW_DATE, flexShrink: 0, fontSize: 11, color: '#8A8A94', textAlign: 'center' }}>
                      {format(parseISO(task.start_date), 'MMM d')}
                    </div>
                    <div style={{ width: LW_DATE, flexShrink: 0, fontSize: 11, color: '#8A8A94', textAlign: 'center' }}>
                      {format(parseISO(task.end_date), 'MMM d')}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Timeline SVG — primary scroll container */}
            <div
              ref={timelineRef}
              onScroll={syncScroll}
              className="gantt-scroll"
              style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}
            >
              <svg width={svgW} height={svgH} style={{ display: 'block' }}>

                {/* Weekend column shading (below everything else) */}
                {days.map((d, i) => {
                  if (!isWeekend(d)) return null
                  return (
                    <rect key={`wknd-${i}`}
                      x={i * DAY_W} y={0} width={DAY_W} height={svgH}
                      fill="#0B0B0E"
                    />
                  )
                })}

                {/* Alternating row backgrounds (semi-transparent over weekend shading) */}
                {visibleRows.map((row, i) => (
                  <rect
                    key={row.id + '-bg'}
                    x={0} y={i * ROW_H} width={svgW} height={ROW_H}
                    fill={i % 2 === 0 ? 'rgba(23,23,28,0.55)' : 'rgba(18,18,23,0.55)'}
                  />
                ))}

                {/* Vertical day grid lines */}
                {days.map((_, i) => (
                  <line key={`vl-${i}`}
                    x1={i * DAY_W} x2={i * DAY_W} y1={0} y2={svgH}
                    stroke="#1C1C22" strokeWidth={1}
                  />
                ))}

                {/* Horizontal row dividers */}
                {visibleRows.map((_, i) => (
                  <line key={`hl-${i}`}
                    x1={0} x2={svgW} y1={(i + 1) * ROW_H} y2={(i + 1) * ROW_H}
                    stroke="#26262E" strokeWidth={1}
                  />
                ))}

                {/* Today — full-height orange dashed line */}
                {todayOffset >= 0 && todayOffset < totalDays && (
                  <line
                    x1={todayX} x2={todayX} y1={0} y2={svgH}
                    stroke="#F97316" strokeWidth={1.5} strokeDasharray="5 4"
                  />
                )}

                {/* Task bars */}
                {visibleRows.map((row, i) => {
                  const task  = row.task
                  const y     = i * ROW_H
                  const ghost = dragState?.taskId === task.id ? dragState : null
                  const ds    = ghost ? ghost.start : parseISO(task.start_date)
                  const de    = ghost ? ghost.end   : parseISO(task.end_date)
                  const bx    = toX(ds, origin)
                  const dur   = differenceInDays(de, ds) + 1
                  const bw    = Math.max(DAY_W, dur * DAY_W)
                  const barY  = y + 7
                  const barH  = ROW_H - 14
                  const color = phaseColorMap[task.phase] || '#8A8A94'
                  const isHov = hoverId === task.id
                  const hW    = bw >= HNDL_W * 2 ? HNDL_W : Math.floor(bw / 2)
                  const innerW = Math.max(1, bw - hW * 2)
                  const pct   = { done: 100, review: 75, in_progress: 50, not_started: 0 }[task.status] ?? 0
                  const abbr  = subTeamAbbr(task.sub_team)

                  return (
                    <g
                      key={task.id}
                      onMouseEnter={() => {
                        setHoverId(task.id)
                        setTooltip({ task, ds, de, dur, cx: bx + bw / 2, ty: barY })
                      }}
                      onMouseLeave={() => { setHoverId(null); setTooltip(null) }}
                    >
                      {/* Left resize handle */}
                      <rect
                        x={bx} y={barY} width={hW} height={barH} rx={4}
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
                          width={innerW * (pct / 100)} height={barH} rx={0}
                          fill="rgba(255,255,255,0.18)"
                          style={{ pointerEvents: 'none' }}
                        />
                      )}
                      {/* Right resize handle */}
                      <rect
                        x={bx + bw - hW} y={barY} width={hW} height={barH} rx={4}
                        fill={isHov ? darken(color) : color}
                        opacity={ghost ? 0.75 : 1}
                        style={{ cursor: 'ew-resize' }}
                        onMouseDown={e => onBarMouseDown(e, task, 'right')}
                      />
                      {/* Label: title · sub-team abbr */}
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
                        {task.title} · {abbr}
                      </text>
                    </g>
                  )
                })}

                {/* Hover tooltip */}
                {tooltip && (() => {
                  const TT_W = 200
                  const TT_H = 76
                  const PAD  = 10
                  let tx = tooltip.cx - TT_W / 2
                  let ty = tooltip.ty - TT_H - 10
                  if (tx < 4) tx = 4
                  if (tx + TT_W > svgW - 4) tx = svgW - TT_W - 4
                  if (ty < 4) ty = tooltip.ty + (ROW_H - 14) + 10
                  return (
                    <g style={{ pointerEvents: 'none' }}>
                      <rect x={tx} y={ty} width={TT_W} height={TT_H} rx={7}
                        fill="#1E1E25" stroke="#3A3A44" strokeWidth={1}
                      />
                      <text x={tx + PAD} y={ty + 18}
                        fill="#EDEDF2" fontSize={12} fontWeight={600}
                        fontFamily="Inter, sans-serif"
                      >
                        {tooltip.task.title.length > 22
                          ? tooltip.task.title.substring(0, 22) + '…'
                          : tooltip.task.title}
                      </text>
                      <text x={tx + PAD} y={ty + 38}
                        fill="#A2A2AE" fontSize={10}
                        fontFamily="Inter, sans-serif"
                      >
                        {format(tooltip.ds, 'MMM d')} → {format(tooltip.de, 'MMM d')}
                      </text>
                      <text x={tx + PAD} y={ty + 57}
                        fill="#8A8A94" fontSize={10}
                        fontFamily="Inter, sans-serif"
                      >
                        {tooltip.dur} day{tooltip.dur !== 1 ? 's' : ''}
                      </text>
                    </g>
                  )
                })()}
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
