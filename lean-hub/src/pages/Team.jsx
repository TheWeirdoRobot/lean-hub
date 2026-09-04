import { useState, useEffect } from 'react'
import { Users, CheckSquare, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import { SUB_TEAMS, DEFAULT_SUB_TEAM } from '../lib/teams'
import { assigneeIds } from '../lib/taskPeople'

const ROLE_COLORS = {
  'Team Lead': { bg: 'rgba(222,146,96,0.12)',  color: '#DE9260', border: 'rgba(222,146,96,0.3)' },
  'ME':        { bg: 'rgba(167,155,232,0.12)', color: '#A79BE8', border: 'rgba(167,155,232,0.3)' },
  'CS':        { bg: 'rgba(108,166,232,0.12)', color: '#6CA6E8', border: 'rgba(108,166,232,0.3)' },
  'Member':    { bg: 'rgba(157,162,174,0.1)',  color: '#9DA2AE', border: 'rgba(157,162,174,0.3)' },
}

function getRoleStyle(role) {
  return ROLE_COLORS[role] || ROLE_COLORS.Member
}

export default function Team() {
  const [profiles, setProfiles] = useState([])
  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([fetchProfiles(), fetchTasks()]).finally(() => setLoading(false))
  }, [])

  async function fetchProfiles() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: true })
    setProfiles(data || [])
  }

  async function fetchTasks() {
    const { data } = await supabase.from('tasks').select('assigned_to, assignee_ids, status, sub_team')
    setTasks(data || [])
  }

  // Per-profile task stats
  const profileStats = {}
  const profileSubTeams = {}
  for (const t of tasks) {
    // A task counts once for every person it is assigned to
    for (const id of assigneeIds(t)) {
      if (!profileStats[id]) profileStats[id] = { total: 0, inProgress: 0, done: 0 }
      const s = profileStats[id]
      s.total++
      if (t.status === 'in_progress') s.inProgress++
      if (t.status === 'done') s.done++

      const team = t.sub_team || DEFAULT_SUB_TEAM
      if (!profileSubTeams[id]) profileSubTeams[id] = {}
      profileSubTeams[id][team] = (profileSubTeams[id][team] || 0) + 1
    }
  }

  const EMPTY_STATS = { total: 0, inProgress: 0, done: 0 }

  // Compute each member's primary sub-team (most tasks)
  function primarySubTeam(pid) {
    const teams = profileSubTeams[pid]
    if (!teams || Object.keys(teams).length === 0) return null
    return Object.entries(teams).sort((a, b) => b[1] - a[1])[0][0]
  }

  // Group profiles by primary sub-team for the roster section
  const rosterBySubTeam = {}
  for (const p of profiles) {
    const st = primarySubTeam(p.id) || DEFAULT_SUB_TEAM
    if (!rosterBySubTeam[st]) rosterBySubTeam[st] = []
    rosterBySubTeam[st].push(p)
  }

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
        <>
          {/* Member Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {profiles.map(p => {
              const stats = profileStats[p.id] || EMPTY_STATS
              const roleStyle = getRoleStyle(p.role)
              const memberTeams = profileSubTeams[p.id] || {}
              return (
                <div
                  key={p.id}
                  className="card"
                  style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }}
                >
                  <div style={{ padding: '22px 22px 20px' }}>
                    {/* Avatar + name + role */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                      <Avatar name={p.full_name} size="lg" />
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{p.full_name}</div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', marginTop: 5, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: roleStyle.bg, color: roleStyle.color, border: `1px solid ${roleStyle.border}` }}>
                          {p.role}
                        </div>
                      </div>
                    </div>

                    <div className="divider" style={{ margin: '0 0 14px' }} />

                    {/* Sub-team badges */}
                    {Object.keys(memberTeams).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                        {SUB_TEAMS.filter(st => memberTeams[st.name]).map(st => (
                          <span key={st.name} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                            background: st.color + '1A', color: st.color, border: `1px solid ${st.color}4D`,
                          }}>
                            {st.abbr} {st.name}
                            <span style={{ opacity: 0.7, fontWeight: 400 }}>({memberTeams[st.name]})</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Task stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      <StatBox icon={<CheckSquare size={13} color="#9DA2AE" />} value={stats.total} label="Assigned" />
                      <StatBox icon={<Clock size={13} color="#D9A73F" />} value={stats.inProgress} label="Active" />
                      <StatBox icon={<CheckSquare size={13} color="#6BC77A" />} value={stats.done} label="Done" />
                    </div>

                    {/* Completion bar */}
                    {stats.total > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Completion</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round((stats.done / stats.total) * 100)}%</span>
                        </div>
                        <div style={{ height: 5, background: 'var(--bg-primary)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(stats.done / stats.total) * 100}%`, background: roleStyle.color, borderRadius: 99, transition: 'width 0.4s ease' }} />
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

          {/* ── Sub-Team Roster ── */}
          <div style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Sub-Team Roster</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Members grouped by their primary sub-team (most task assignments)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {SUB_TEAMS.map(st => {
                const members = rosterBySubTeam[st.name] || []
                return (
                  <div key={st.name} style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 12, overflow: 'hidden',
                  }}>
                    {/* Header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '14px 16px',
                      borderBottom: '1px solid var(--border)',
                      background: st.color + '1A',
                    }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: st.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: st.color, flex: 1 }}>{st.name}</span>
                      <span style={{
                        padding: '1px 7px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                        background: st.color + '30', color: st.color,
                      }}>
                        {members.length}
                      </span>
                    </div>
                    {/* Members list */}
                    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {members.length === 0 ? (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>No members assigned</p>
                      ) : members.map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={p.full_name} size="sm" />
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{p.full_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.role}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatBox({ icon, value, label }) {
  return (
    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 10px 8px', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
    </div>
  )
}
