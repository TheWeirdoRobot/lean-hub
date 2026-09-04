import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, CheckCircle2, Clock, AlertTriangle, ListTodo, ArrowRight, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/Avatar'
import AvatarStack from '../components/AvatarStack'
import TaskModal from '../components/TaskModal'
import TimelinePreview from '../components/TimelinePreview'
import { formatDistanceToNow, format, isPast, isToday, parseISO } from 'date-fns'
import { useCustomPhases } from '../hooks/useCustomPhases'
import { assigneesOf, isAssignedTo } from '../lib/taskPeople'

const TASK_SELECT = '*, creator:profiles!tasks_created_by_fkey(id, full_name)'

const STATUS_COLOR = {
  not_started: '#70707C',
  in_progress: '#D29922',
  review:      '#58A6FF',
  done:        '#3FB950',
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function dueLabel(task) {
  if (!task.end_date) return null
  const d = parseISO(task.end_date)
  if (isToday(d)) return { text: 'Due today', tone: 'var(--warning)' }
  if (isPast(d))  return { text: `Overdue · ${format(d, 'MMM d')}`, tone: 'var(--danger)' }
  return { text: format(d, 'MMM d'), tone: 'var(--text-muted)' }
}

export default function Dashboard() {
  const { user, profile, canEdit } = useAuth()
  const navigate = useNavigate()
  const { phases, phaseColorMap } = useCustomPhases()

  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [showNewTask, setShowNewTask] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchTasks(), fetchProfiles(), fetchActivity()]).finally(() => setLoading(false))
  }, [])

  // Live sync: keep the counters and activity feed current as the team works
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTasks()
        fetchActivity()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .order('created_at', { ascending: false })
    if (error) console.error('Dashboard tasks error:', error)
    setTasks(data || [])
  }

  async function fetchProfiles() {
    const { data } = await supabase.from('profiles').select('*')
    setProfiles(data || [])
  }

  async function fetchActivity() {
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .order('updated_at', { ascending: false })
      .limit(6)
    if (error) console.error('Activity fetch error:', error)
    setRecentActivity(data || [])
  }

  async function handleCreate(taskData) {
    const { data, error } = await supabase
      .from('tasks')
      .insert(taskData)
      .select(TASK_SELECT)
      .single()
    if (error) {
      console.error('Task create error:', error)
      throw new Error(error.message)
    }
    if (data) {
      setTasks(prev => [data, ...prev])
      fetchActivity()
    }
  }

  const openTask = (task) => navigate('/tasks', { state: { openTaskId: task.id } })

  // ── Team-wide counters ──
  const total = tasks.length
  let inProgress = 0, done = 0, overdue = 0
  for (const t of tasks) {
    if (t.status === 'in_progress') inProgress++
    if (t.status === 'done') done++
    if (t.end_date && t.status !== 'done' && isPast(parseISO(t.end_date))) overdue++
  }
  const open = total - done

  const stats = [
    { label: 'Total Tasks', value: total,      icon: ListTodo,      color: '#A79BE8', bg: 'rgba(110,86,207,0.14)' },
    { label: 'In Progress', value: inProgress, icon: Clock,         color: '#D9A73F', bg: 'rgba(210,153,34,0.12)' },
    { label: 'Completed',   value: done,       icon: CheckCircle2,  color: '#6BC77A', bg: 'rgba(63,185,80,0.12)'  },
    { label: 'Overdue',     value: overdue,    icon: AlertTriangle, color: '#F87F76', bg: 'rgba(248,81,73,0.12)'  },
  ]

  // ── Mine ──
  const myTasks = tasks
    .filter(t => isAssignedTo(t, user?.id) && t.status !== 'done')
    .sort((a, b) => {
      if (!a.end_date && !b.end_date) return 0
      if (!a.end_date) return 1
      if (!b.end_date) return -1
      return a.end_date.localeCompare(b.end_date)
    })
  const myOverdue = myTasks.filter(t => t.end_date && isPast(parseISO(t.end_date))).length

  // ── Per-member open counts ──
  const openByMember = {}
  for (const t of tasks) {
    if (t.status === 'done') continue
    for (const p of assigneesOf(t, profiles)) {
      openByMember[p.id] = (openByMember[p.id] || 0) + 1
    }
  }

  const firstName = profile?.full_name?.split(' ')[0]
  const subtitleParts = [format(new Date(), 'EEEE, MMMM d')]
  if (!loading) {
    subtitleParts.push(`${open} open task${open !== 1 ? 's' : ''}`)
    if (overdue > 0) subtitleParts.push(`${overdue} overdue`)
  }

  return (
    <div className="fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {canEdit ? `${greeting()}${firstName ? `, ${firstName}` : ''}` : 'Project Overview'}
          </h1>
          <p className="page-subtitle">{subtitleParts.join(' · ')}</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setShowNewTask(true)}>
            <Plus size={15} /> New Task
          </button>
        )}
      </div>

      {/* Team-wide counters */}
      <div className="dashboard-stats">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card stat-card">
            <div className="stat-icon" style={{ background: bg }}>
              <Icon size={18} color={color} aria-hidden="true" />
            </div>
            <div>
              <div className="stat-value">{loading ? '—' : value}</div>
              <div className="stat-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        {/* ── Main column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* My tasks — only meaningful for a signed-in member */}
          {canEdit && (
          <div className="card" style={{ padding: 0 }}>
            <div className="panel-head">
              <h2 className="panel-title">
                My Tasks
                {!loading && myTasks.length > 0 && (
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                    {' '}· {myTasks.length} open{myOverdue > 0 ? `, ${myOverdue} overdue` : ''}
                  </span>
                )}
              </h2>
              <button className="panel-link" onClick={() => navigate('/tasks')}>
                Open board <ArrowRight size={12} />
              </button>
            </div>

            {loading ? (
              <div style={{ padding: '12px 20px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                    <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%' }} />
                    <div className="skeleton" style={{ height: 12, width: `${60 - i * 10}%` }} />
                  </div>
                ))}
              </div>
            ) : myTasks.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 20px' }}>
                <CheckCircle2 size={28} />
                <p style={{ fontSize: 13 }}>Nothing assigned to you right now</p>
              </div>
            ) : (
              <div>
                {myTasks.slice(0, 6).map(task => {
                  const due = dueLabel(task)
                  return (
                    <button key={task.id} className="activity-row" onClick={() => openTask(task)}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: STATUS_COLOR[task.status] || '#70707C', flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {task.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {task.phase}{task.sub_team ? ` · ${task.sub_team}` : ''}
                        </div>
                      </div>
                      {due && (
                        <span style={{ fontSize: 11, color: due.tone, whiteSpace: 'nowrap' }}>{due.text}</span>
                      )}
                      <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                    </button>
                  )
                })}
                {myTasks.length > 6 && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', padding: '10px 20px 12px' }}>
                    +{myTasks.length - 6} more assigned to you
                  </p>
                )}
              </div>
            )}
          </div>
          )}

          {/* Upcoming timeline */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <CalendarDays size={14} color="var(--text-muted)" /> Next 5 Weeks
              </h2>
              <button className="panel-link" onClick={() => navigate('/gantt')}>
                Full chart <ArrowRight size={12} />
              </button>
            </div>
            {loading
              ? <div className="skeleton" style={{ height: 120 }} />
              : <TimelinePreview tasks={tasks} phaseColorMap={phaseColorMap} onOpenTask={openTask} />}
          </div>

          {/* Recent activity */}
          <div className="card" style={{ padding: 0 }}>
            <div className="panel-head">
              <h2 className="panel-title">Recent Activity</h2>
              <button className="panel-link" onClick={() => navigate('/tasks')}>
                View all <ArrowRight size={12} />
              </button>
            </div>

            {loading ? (
              <div style={{ padding: '12px 20px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                    <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%' }} />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton" style={{ height: 12, width: `${70 - i * 10}%`, marginBottom: 6 }} />
                      <div className="skeleton" style={{ height: 9, width: 120 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="empty-state"><ListTodo size={32} /><p>No tasks yet</p></div>
            ) : (
              <div>
                {recentActivity.map(task => (
                  <button key={task.id} className="activity-row" onClick={() => openTask(task)}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: STATUS_COLOR[task.status] || '#70707C', flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {task.creator?.full_name ? `by ${task.creator.full_name} · ` : ''}
                        {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}
                      </div>
                    </div>
                    <AvatarStack people={assigneesOf(task, profiles)} max={2} />
                    <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Side column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Phase breakdown */}
          <div className="card">
            <h2 className="panel-title" style={{ marginBottom: 18 }}>Phase Breakdown</h2>
            {phases.map(({ name, color }) => {
              const phaseTasks = tasks.filter(t => t.phase === name)
              const count      = phaseTasks.length
              const doneCount  = phaseTasks.filter(t => t.status === 'done').length
              const pct        = count ? Math.round((doneCount / count) * 100) : 0
              return (
                <div key={name} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span className="tag" style={{ background: color + '1F', color }}>{name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {count === 0 ? '—' : `${doneCount} / ${count}`}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Team */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 className="panel-title">Team</h2>
              <button className="panel-link" onClick={() => navigate('/team')}>
                Details <ArrowRight size={12} />
              </button>
            </div>
            {profiles.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No members yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {profiles.map(p => {
                  const count = openByMember[p.id] || 0
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={p.full_name} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.full_name}{p.id === user?.id ? ' (you)' : ''}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.role}</div>
                      </div>
                      <span style={{
                        fontSize: 11,
                        color: count > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
                        fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                      }}>
                        {count} open
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showNewTask && (
        <TaskModal
          profiles={profiles}
          onClose={() => setShowNewTask(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}
