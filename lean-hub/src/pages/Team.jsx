import { useState, useEffect } from 'react'
import { Users, CheckSquare, Clock, UserPlus, Trash2, AlertCircle, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/Avatar'
import { SUB_TEAMS, DEFAULT_SUB_TEAM } from '../lib/teams'
import { assigneeIds } from '../lib/taskPeople'
import { loadProfiles } from '../lib/profiles'

const ROLE_COLORS = {
  'Team Lead': { bg: 'rgba(222,146,96,0.12)',  color: '#DE9260', border: 'rgba(222,146,96,0.3)' },
  'ME':        { bg: 'rgba(167,155,232,0.12)', color: '#A79BE8', border: 'rgba(167,155,232,0.3)' },
  'CS':        { bg: 'rgba(108,166,232,0.12)', color: '#6CA6E8', border: 'rgba(108,166,232,0.3)' },
  'Member':    { bg: 'rgba(157,162,174,0.1)',  color: '#9DA2AE', border: 'rgba(157,162,174,0.3)' },
}

const ROLES = Object.keys(ROLE_COLORS)

const EMPTY_STATS = { total: 0, inProgress: 0, done: 0 }
const BLANK_FORM = { full_name: '', email: '', role: 'Member', sub_team: DEFAULT_SUB_TEAM }

function getRoleStyle(role) {
  return ROLE_COLORS[role] || ROLE_COLORS.Member
}

export default function Team() {
  const { canEdit } = useAuth()
  const [profiles, setProfiles] = useState([])
  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(true)

  const [showAdd, setShowAdd]   = useState(false)
  const [form, setForm]         = useState(BLANK_FORM)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    Promise.all([fetchProfiles(), fetchTasks()]).finally(() => setLoading(false))
  }, [canEdit])

  async function fetchProfiles() {
    // email is readable by signed-in members only — anon lacks the column grant
    setProfiles(await loadProfiles({ withEmail: canEdit, ordered: true }))
  }

  async function fetchTasks() {
    const { data } = await supabase.from('tasks').select('assigned_to, assignee_ids, status, sub_team')
    setTasks(data || [])
  }

  async function addMember() {
    const name = form.full_name.trim()
    if (!name) { setError('Name is required.'); return }
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('profiles').insert({
      full_name: name,
      email: form.email.trim().toLowerCase() || null,
      role: form.role,
      sub_team: form.sub_team,
      is_placeholder: true,
    })
    if (err) {
      setError(err.message)
    } else {
      setForm(BLANK_FORM)
      setShowAdd(false)
      await fetchProfiles()
    }
    setSaving(false)
  }

  async function updateSubTeam(id, sub_team) {
    setError('')
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, sub_team } : p)) // optimistic
    const { error: err } = await supabase.from('profiles').update({ sub_team }).eq('id', id)
    if (err) {
      setError(err.message)
      await fetchProfiles()
    }
  }

  async function removeMember(profile) {
    if (!window.confirm(`Remove ${profile.full_name} from the roster?`)) return
    setError('')
    const { error: err } = await supabase.from('profiles').delete().eq('id', profile.id)
    if (err) setError(err.message)
    await fetchProfiles()
  }

  // Per-profile task stats — a task counts for everyone assigned to it
  const profileStats = {}
  for (const t of tasks) {
    for (const id of assigneeIds(t)) {
      if (!profileStats[id]) profileStats[id] = { total: 0, inProgress: 0, done: 0 }
      const s = profileStats[id]
      s.total++
      if (t.status === 'in_progress') s.inProgress++
      if (t.status === 'done') s.done++
    }
  }

  // Roster comes from each member's own sub-team now, not from their task history
  const rosterBySubTeam = {}
  for (const p of profiles) {
    const st = p.sub_team || DEFAULT_SUB_TEAM
    if (!rosterBySubTeam[st]) rosterBySubTeam[st] = []
    rosterBySubTeam[st].push(p)
  }

  const pending = profiles.filter(p => p.is_placeholder).length

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-subtitle">
            {profiles.length} member{profiles.length !== 1 ? 's' : ''} on the LEAN project
            {pending > 0 && ` · ${pending} without an account yet`}
          </p>
        </div>
        {canEdit && !showAdd && (
          <button className="btn btn-primary" onClick={() => { setShowAdd(true); setError('') }}>
            <UserPlus size={15} /> Add Member
          </button>
        )}
      </div>

      {error && (
        <div className="alert-error" style={{ marginBottom: 18 }}>
          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {canEdit && showAdd && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 className="panel-title" style={{ marginBottom: 4 }}>Add a member</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            For teammates who haven&apos;t signed up yet. You can assign them tasks straight
            away — when they create an account with the same email, it links to this member
            and keeps everything assigned to them.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 0.9fr 0.9fr auto', gap: 10, alignItems: 'flex-end' }}>
            <div>
              <label htmlFor="member-name">Full name</label>
              <input
                id="member-name"
                className="input"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Jane Smith"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && addMember()}
              />
            </div>
            <div>
              <label htmlFor="member-email">Email (used to link their account)</label>
              <input
                id="member-email"
                type="email"
                className="input"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jane@u.boisestate.edu"
                onKeyDown={e => e.key === 'Enter' && addMember()}
              />
            </div>
            <div>
              <label htmlFor="member-role">Role</label>
              <select
                id="member-role"
                className="select"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="member-subteam">Sub-team</label>
              <select
                id="member-subteam"
                className="select"
                value={form.sub_team}
                onChange={e => setForm(f => ({ ...f, sub_team: e.target.value }))}
              >
                {SUB_TEAMS.map(st => <option key={st.name} value={st.name}>{st.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={addMember} disabled={saving || !form.full_name.trim()}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> : 'Add'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowAdd(false); setForm(BLANK_FORM); setError('') }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : profiles.length === 0 ? (
        <div className="empty-state">
          <Users size={40} />
          <p style={{ fontSize: 15, fontWeight: 500 }}>No team members yet</p>
          <p style={{ fontSize: 13 }}>
            {canEdit ? 'Add members above, or they appear here after signing up' : 'Members appear here after signing up'}
          </p>
        </div>
      ) : (
        <>
          {/* Member Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {profiles.map(p => {
              const stats = profileStats[p.id] || EMPTY_STATS
              const roleStyle = getRoleStyle(p.role)
              return (
                <div key={p.id} className="card" style={{ padding: '22px 22px 20px' }}>
                  {/* Avatar + name + role */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                    <Avatar name={p.full_name} size="lg" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.full_name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99,
                          fontSize: 11, fontWeight: 600,
                          background: roleStyle.bg, color: roleStyle.color, border: `1px solid ${roleStyle.border}`,
                        }}>
                          {p.role}
                        </span>
                        {p.is_placeholder && (
                          <span className="readonly-badge" title="This member has not created an account yet">
                            No account yet
                          </span>
                        )}
                      </div>
                    </div>
                    {canEdit && p.is_placeholder && (
                      <button
                        className="btn btn-ghost btn-sm"
                        aria-label={`Remove ${p.full_name}`}
                        title="Remove from roster"
                        onClick={() => removeMember(p)}
                        style={{ color: 'var(--danger)', padding: 5 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="divider" style={{ margin: '0 0 14px' }} />

                  {/* Sub-team */}
                  <div style={{ marginBottom: 14 }}>
                    <label htmlFor={`subteam-${p.id}`} style={{ marginBottom: 5 }}>Sub-team</label>
                    {canEdit ? (
                      <select
                        id={`subteam-${p.id}`}
                        className="select"
                        value={p.sub_team || DEFAULT_SUB_TEAM}
                        onChange={e => updateSubTeam(p.id, e.target.value)}
                      >
                        {SUB_TEAMS.map(st => <option key={st.name} value={st.name}>{st.name}</option>)}
                      </select>
                    ) : (
                      <SubTeamBadge name={p.sub_team || DEFAULT_SUB_TEAM} />
                    )}
                  </div>

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

                  {/* Footer */}
                  <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-muted)' }}>
                    {p.is_placeholder ? 'Added' : 'Joined'}{' '}
                    {new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                    {canEdit && p.is_placeholder && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                        <Mail size={11} />
                        {p.email
                          ? <>Links to <span style={{ color: 'var(--text-secondary)' }}>{p.email}</span> on signup</>
                          : <span style={{ color: 'var(--warning)' }}>No email — won&apos;t link automatically</span>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Sub-Team Roster ── */}
          <div style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Sub-Team Roster</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Members grouped by the sub-team set on their card
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {SUB_TEAMS.map(st => {
                const members = rosterBySubTeam[st.name] || []
                return (
                  <div key={st.name} style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 12, overflow: 'hidden',
                  }}>
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
                    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {members.length === 0 ? (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>No members assigned</p>
                      ) : members.map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={p.full_name} size="sm" />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.full_name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {p.role}{p.is_placeholder ? ' · invited' : ''}
                            </div>
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

function SubTeamBadge({ name }) {
  const st = SUB_TEAMS.find(s => s.name === name) || SUB_TEAMS[0]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600,
      background: st.color + '1A', color: st.color, border: `1px solid ${st.color}4D`,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.color }} />
      {st.name}
    </span>
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
