import { useState, useEffect } from 'react'
import { Users, CheckSquare, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'

const ROLE_COLORS = {
  'Team Lead': { bg: 'rgba(249,115,22,0.12)', color: '#F97316', border: 'rgba(249,115,22,0.3)' },
  'ME': { bg: 'rgba(168,85,247,0.12)', color: '#A855F7', border: 'rgba(168,85,247,0.3)' },
  'CS': { bg: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: 'rgba(59,130,246,0.3)' },
  'Member': { bg: 'rgba(100,116,139,0.12)', color: '#94A3B8', border: 'rgba(100,116,139,0.3)' },
}

function getRoleStyle(role) {
  return ROLE_COLORS[role] || ROLE_COLORS.Member
}

export default function Team() {
  const [profiles, setProfiles] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchProfiles(), fetchTasks()]).finally(() => setLoading(false))
  }, [])

  async function fetchProfiles() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: true })
    setProfiles(data || [])
  }

  async function fetchTasks() {
    const { data } = await supabase.from('tasks').select('assigned_to, status')
    setTasks(data || [])
  }

  const profileStats = {}
  for (const t of tasks) {
    if (!t.assigned_to) continue
    if (!profileStats[t.assigned_to]) profileStats[t.assigned_to] = { total: 0, inProgress: 0, done: 0 }
    const s = profileStats[t.assigned_to]
    s.total++
    if (t.status === 'in_progress') s.inProgress++
    if (t.status === 'done') s.done++
  }
  const EMPTY_STATS = { total: 0, inProgress: 0, done: 0 }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-subtitle">{profiles.length} member{profiles.length !== 1 ? 's' : ''} on the LEAN project</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : profiles.length === 0 ? (
        <div className="empty-state">
          <Users size={40} />
          <p style={{ fontSize: 15, fontWeight: 500 }}>No team members yet</p>
          <p style={{ fontSize: 13 }}>Members will appear here after signing up</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {profiles.map(p => {
            const stats = profileStats[p.id] || EMPTY_STATS
            const roleStyle = getRoleStyle(p.role)
            return (
              <div
                key={p.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0,
                  padding: 0,
                  overflow: 'hidden',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  cursor: 'default',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
              >
                {/* Top color bar */}
                <div style={{ height: 4, background: `linear-gradient(90deg, ${roleStyle.color}, ${roleStyle.color}88)` }} />

                <div style={{ padding: '22px 22px 20px' }}>
                  {/* Avatar + name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                    <Avatar name={p.full_name} size="lg" />
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{p.full_name}</div>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        marginTop: 5,
                        padding: '2px 8px',
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 600,
                        background: roleStyle.bg,
                        color: roleStyle.color,
                        border: `1px solid ${roleStyle.border}`,
                      }}>
                        {p.role}
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="divider" style={{ margin: '0 0 16px' }} />

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <StatBox icon={<CheckSquare size={13} color="#94A3B8" />} value={stats.total} label="Assigned" />
                    <StatBox icon={<Clock size={13} color="#F59E0B" />} value={stats.inProgress} label="Active" />
                    <StatBox icon={<CheckSquare size={13} color="#22C55E" />} value={stats.done} label="Done" />
                  </div>

                  {/* Task bar */}
                  {stats.total > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Completion</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round((stats.done / stats.total) * 100)}%</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--bg-primary)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${(stats.done / stats.total) * 100}%`,
                          background: roleStyle.color,
                          borderRadius: 99,
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Joined */}
                  <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-muted)' }}>
                    Joined {new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatBox({ icon, value, label }) {
  return (
    <div style={{
      background: 'var(--bg-primary)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '10px 10px 8px',
      textAlign: 'center',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
    </div>
  )
}
