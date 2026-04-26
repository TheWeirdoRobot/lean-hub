import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, CheckCircle2, Clock, AlertTriangle, ListTodo, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/Avatar'
import WheelchairLogo from '../components/WheelchairLogo'
import TaskModal from '../components/TaskModal'
import { formatDistanceToNow, isPast, parseISO } from 'date-fns'

const TASK_SELECT = '*, assignee:profiles!tasks_assigned_to_fkey(id, full_name), creator:profiles!tasks_created_by_fkey(id, full_name)'

const STATUS_COLOR = {
  not_started: '#64748B',
  in_progress:  '#EAB308',
  review:        '#3B82F6',
  done:          '#22C55E',
}

const PHASES = ['Research', 'Design', 'Fabrication', 'Testing', 'Competition']
const PHASE_COLOR = {
  Research:    '#60A5FA',
  Design:      '#C084FC',
  Fabrication: '#FB923C',
  Testing:     '#4ADE80',
  Competition: '#FCD34D',
}

export default function Dashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [showNewTask, setShowNewTask] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hoveredActivity, setHoveredActivity] = useState(null)

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

  const assignedCount = {}
  for (const t of tasks) {
    if (t.assigned_to) assignedCount[t.assigned_to] = (assignedCount[t.assigned_to] || 0) + 1
  }

  const stats = [
    { label: 'Total Tasks', value: total,      icon: ListTodo,      color: '#A855F7', bg: 'rgba(168,85,247,0.14)' },
    { label: 'In Progress', value: inProgress,  icon: Clock,         color: '#EAB308', bg: 'rgba(234,179,8,0.14)'  },
    { label: 'Completed',   value: done,        icon: CheckCircle2,  color: '#22C55E', bg: 'rgba(34,197,94,0.14)'  },
    { label: 'Overdue',     value: overdue,     icon: AlertTriangle, color: '#EF4444', bg: 'rgba(239,68,68,0.14)'  },
  ]

  return (
    <div className="fade-in">
      {/* Hero banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.13) 0%, rgba(168,85,247,0.07) 100%)',
        borderTop: '1px solid #2D2D5E',
        borderRight: '1px solid #2D2D5E',
        borderBottom: '1px solid #2D2D5E',
        borderLeft: '4px solid #7C3AED',
        borderRadius: 16,
        padding: '28px 32px',
        marginBottom: 28,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', right: -20, top: -20,
          width: 240, height: 240,
          background: 'radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #7C3AED, #A855F7)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(124,58,237,0.55)', flexShrink: 0 }}>
              <WheelchairLogo size={22} color="#fff" />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#A855F7', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Capstone 2026
            </span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 8px', color: 'var(--text-primary)' }}>
            LEAN Hub — Powered Wheelchair Basketball
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 560, margin: 0, lineHeight: 1.6 }}>
            Hands-free control via torso lean through a pressure-sensing cushion. Track engineering milestones, assignments, and team progress in one place.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => setShowNewTask(true)}>
            <Plus size={15} /> Quick Add Task
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="card"
            style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 22px', cursor: 'default' }}
          >
            <div style={{ width: 44, height: 44, background: bg, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={20} color={color} aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

        {/* Recent activity */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Recent Activity</h2>
            <button
              onClick={() => navigate('/tasks')}
              style={{ background: 'none', border: 'none', fontSize: 12, color: '#A855F7', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', padding: 0 }}
            >
              View all <ArrowRight size={12} />
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
              <div className="spinner" />
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="empty-state"><ListTodo size={32} /><p>No tasks yet</p></div>
          ) : (
            <div>
              {recentActivity.map((task, i) => (
                <button
                  key={task.id}
                  onClick={() => navigate('/tasks', { state: { openTaskId: task.id } })}
                  onMouseEnter={() => setHoveredActivity(task.id)}
                  onMouseLeave={() => setHoveredActivity(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '13px 22px',
                    /* Reset all browser-default button borders, keep only the row divider */
                    borderTop: 'none',
                    borderRight: 'none',
                    borderLeft: 'none',
                    borderBottom: i < recentActivity.length - 1 ? '1px solid #2D2D5E' : 'none',
                    outline: 'none',
                    appearance: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s, box-shadow 0.15s',
                    width: '100%',
                    background: hoveredActivity === task.id ? 'rgba(124,58,237,0.07)' : 'transparent',
                    boxShadow: hoveredActivity === task.id ? 'inset 3px 0 0 0 #7C3AED' : 'none',
                    textAlign: 'left',
                    color: 'inherit',
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: STATUS_COLOR[task.status] || '#64748B',
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
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Phase Breakdown</h2>
            {PHASES.map(phase => {
              const phaseTasks = tasks.filter(t => t.phase === phase)
              const count      = phaseTasks.length
              const doneCount  = phaseTasks.filter(t => t.status === 'done').length
              const pct        = count ? Math.round((doneCount / count) * 100) : 0
              const color      = PHASE_COLOR[phase]
              return (
                <div key={phase} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className={`tag tag-${phase.toLowerCase()}`}>{phase}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {count === 0 ? '—' : `${doneCount} / ${count}`}
                    </span>
                  </div>
                  <div style={{ height: 5, background: 'var(--bg-primary)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${color}, ${color}99)`,
                      borderRadius: 99,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Team quick view */}
          <div className="card">
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Team</h2>
            {profiles.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No members yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {profiles.map(p => {
                  const assigned = assignedCount[p.id] || 0
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={p.full_name} size="sm" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{p.full_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.role}</div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-primary)', padding: '2px 8px', borderRadius: 99 }}>
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
