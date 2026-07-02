import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, CheckCircle2, Clock, AlertTriangle, ListTodo, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/Avatar'
import TaskModal from '../components/TaskModal'
import { formatDistanceToNow, format, isPast, parseISO } from 'date-fns'
import { useCustomPhases } from '../hooks/useCustomPhases'

const TASK_SELECT = '*, assignee:profiles!tasks_assigned_to_fkey(id, full_name), creator:profiles!tasks_created_by_fkey(id, full_name)'

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

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { phases } = useCustomPhases()

  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [showNewTask, setShowNewTask] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchTasks(), fetchProfiles(), fetchActivity()]).finally(() => setLoading(false))
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
      .limit(8)
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

  const total = tasks.length
  let inProgress = 0, done = 0, overdue = 0
  for (const t of tasks) {
    if (t.status === 'in_progress') inProgress++
    if (t.status === 'done') done++
    if (t.end_date && t.status !== 'done' && isPast(parseISO(t.end_date))) overdue++
  }
  const open = total - done

  const assignedCount = {}
  for (const t of tasks) {
    if (t.assigned_to) assignedCount[t.assigned_to] = (assignedCount[t.assigned_to] || 0) + 1
  }

  const stats = [
    { label: 'Total Tasks', value: total,      icon: ListTodo,      color: '#A79BE8', bg: 'rgba(110,86,207,0.14)' },
    { label: 'In Progress', value: inProgress, icon: Clock,         color: '#D9A73F', bg: 'rgba(210,153,34,0.12)' },
    { label: 'Completed',   value: done,       icon: CheckCircle2,  color: '#6BC77A', bg: 'rgba(63,185,80,0.12)'  },
    { label: 'Overdue',     value: overdue,    icon: AlertTriangle, color: '#F87F76', bg: 'rgba(248,81,73,0.12)'  },
  ]

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
          <h1 className="page-title">{greeting()}{firstName ? `, ${firstName}` : ''}</h1>
          <p className="page-subtitle">{subtitleParts.join(' · ')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNewTask(true)}>
          <Plus size={15} /> New Task
        </button>
      </div>

      {/* Stat cards */}
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

      {/* Content grid */}
      <div className="dashboard-grid">

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
              {[0, 1, 2, 3].map(i => (
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
                <button
                  key={task.id}
                  className="activity-row"
                  onClick={() => navigate('/tasks', { state: { openTaskId: task.id } })}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: STATUS_COLOR[task.status] || '#70707C',
                    flexShrink: 0,
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
                  <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div>
          {/* Phase breakdown */}
          <div className="card" style={{ marginBottom: 16 }}>
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

          {/* Team quick view */}
          <div className="card">
            <h2 className="panel-title" style={{ marginBottom: 16 }}>Team</h2>
            {profiles.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No members yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {profiles.map(p => {
                  const assigned = assignedCount[p.id] || 0
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={p.full_name} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.full_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.role}</div>
                      </div>
                      <span style={{
                        fontSize: 11,
                        color: assigned > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
                        fontVariantNumeric: 'tabular-nums',
                        flexShrink: 0,
                      }}>
                        {assigned} task{assigned !== 1 ? 's' : ''}
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
