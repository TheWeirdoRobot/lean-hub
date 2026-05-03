import { useState } from 'react'
import { Plus, Trash2, GripVertical, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCustomPhases } from '../hooks/useCustomPhases'
import { useCustomStatuses, statusToValue } from '../hooks/useCustomStatuses'

const SUB_TEAMS = [
  { name: 'Full Team',  color: '#3B82F6', abbr: 'FT' },
  { name: 'Mechanical', color: '#F97316', abbr: 'MT' },
  { name: 'Electrical', color: '#EAB308', abbr: 'ET' },
]

const SECTION = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 24,
  marginBottom: 24,
}

const ROW = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '10px 14px',
  background: 'var(--bg-primary)',
  borderRadius: 8,
  border: '1px solid var(--border)',
}

const LABEL_STYLE = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.04em',
}

export default function Admin() {
  const { user } = useAuth()
  const { phases, reload: reloadPhases } = useCustomPhases()
  const { statuses, reload: reloadStatuses } = useCustomStatuses()

  const [showPhaseForm, setShowPhaseForm]       = useState(false)
  const [phaseForm, setPhaseForm]               = useState({ name: '', color: '#7C3AED' })
  const [phaseError, setPhaseError]             = useState('')
  const [phaseSaving, setPhaseSaving]           = useState(false)
  const [phaseDeleteWarn, setPhaseDeleteWarn]   = useState(null)

  const [showStatusForm, setShowStatusForm]     = useState(false)
  const [statusForm, setStatusForm]             = useState({ name: '', color: '#22C55E' })
  const [statusError, setStatusError]           = useState('')
  const [statusSaving, setStatusSaving]         = useState(false)
  const [statusDeleteWarn, setStatusDeleteWarn] = useState(null)

  // ── Phase actions ─────────────────────────────────────────────────────────

  async function addPhase() {
    if (!phaseForm.name.trim()) { setPhaseError('Name is required.'); return }
    setPhaseSaving(true)
    setPhaseError('')
    const { error } = await supabase.from('custom_phases').insert({
      name: phaseForm.name.trim(),
      color: phaseForm.color,
      created_by: user?.id,
    })
    if (error) {
      setPhaseError(error.message)
    } else {
      setPhaseForm({ name: '', color: '#7C3AED' })
      setShowPhaseForm(false)
      reloadPhases()
    }
    setPhaseSaving(false)
  }

  async function removePhase(phase) {
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('phase', phase.name)
    if (count > 0) { setPhaseDeleteWarn(phase.id); return }
    await supabase.from('custom_phases').delete().eq('id', phase.id)
    reloadPhases()
  }

  // ── Status actions ────────────────────────────────────────────────────────

  async function addStatus() {
    if (!statusForm.name.trim()) { setStatusError('Name is required.'); return }
    setStatusSaving(true)
    setStatusError('')
    const { error } = await supabase.from('custom_statuses').insert({
      name: statusForm.name.trim(),
      color: statusForm.color,
      column_order: statuses.length,
      created_by: user?.id,
    })
    if (error) {
      setStatusError(error.message)
    } else {
      setStatusForm({ name: '', color: '#22C55E' })
      setShowStatusForm(false)
      reloadStatuses()
    }
    setStatusSaving(false)
  }

  async function removeStatus(status) {
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', statusToValue(status.name))
    if (count > 0) { setStatusDeleteWarn(status.id); return }
    await supabase.from('custom_statuses').delete().eq('id', status.id)
    reloadStatuses()
  }

  async function moveStatus(fromIdx, toIdx) {
    const reordered = [...statuses]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    await Promise.all(
      reordered.map((s, i) =>
        supabase.from('custom_statuses').update({ column_order: i }).eq('id', s.id)
      )
    )
    reloadStatuses()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Panel</h1>
          <p className="page-subtitle">Manage custom phases, statuses, and project configuration</p>
        </div>
      </div>

      {/* ── PHASES ── */}
      <div style={SECTION}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>Phases</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Categorize tasks across the Gantt chart and kanban board
            </p>
          </div>
          {!showPhaseForm && (
            <button className="btn btn-primary btn-sm" onClick={() => { setShowPhaseForm(true); setPhaseError('') }}>
              <Plus size={14} /> Add Phase
            </button>
          )}
        </div>

        {showPhaseForm && (
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-end', padding: 14,
            background: 'var(--bg-primary)', border: '1px solid var(--border)',
            borderRadius: 8, marginBottom: 14, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={LABEL_STYLE}>Phase Name</label>
              <input
                className="input"
                value={phaseForm.name}
                onChange={e => setPhaseForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Integration"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && addPhase()}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Color</label>
              <input
                type="color"
                value={phaseForm.color}
                onChange={e => setPhaseForm(f => ({ ...f, color: e.target.value }))}
                style={{ width: 44, height: 38, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', cursor: 'pointer', padding: 3 }}
              />
            </div>
            <button className="btn btn-primary btn-sm" onClick={addPhase} disabled={phaseSaving}>
              {phaseSaving ? <span className="spinner" style={{ width: 13, height: 13 }} /> : 'Save'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowPhaseForm(false); setPhaseError('') }}>
              Cancel
            </button>
          </div>
        )}

        {phaseError && (
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, marginBottom: 12, color: '#FCA5A5', fontSize: 12 }}>
            <AlertCircle size={13} />{phaseError}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {phases.map(phase => (
            <div key={phase.id} style={ROW}>
              <div style={{ width: 14, height: 14, borderRadius: 4, background: phase.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{phase.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{phase.color}</span>
              {phaseDeleteWarn === phase.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={12} color="#FCA5A5" />
                  <span style={{ fontSize: 11, color: '#FCA5A5' }}>Tasks use this phase — cannot delete</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPhaseDeleteWarn(null)}>Dismiss</button>
                </div>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--danger)', padding: 5 }}
                  onClick={() => removePhase(phase)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── STATUSES ── */}
      <div style={SECTION}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>Statuses</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Define the kanban board columns and task workflow stages. Use ↑↓ to reorder.
            </p>
          </div>
          {!showStatusForm && (
            <button className="btn btn-primary btn-sm" onClick={() => { setShowStatusForm(true); setStatusError('') }}>
              <Plus size={14} /> Add Status
            </button>
          )}
        </div>

        {showStatusForm && (
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-end', padding: 14,
            background: 'var(--bg-primary)', border: '1px solid var(--border)',
            borderRadius: 8, marginBottom: 14, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={LABEL_STYLE}>Status Name</label>
              <input
                className="input"
                value={statusForm.name}
                onChange={e => setStatusForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Blocked"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && addStatus()}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Color</label>
              <input
                type="color"
                value={statusForm.color}
                onChange={e => setStatusForm(f => ({ ...f, color: e.target.value }))}
                style={{ width: 44, height: 38, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', cursor: 'pointer', padding: 3 }}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Slug (auto)</label>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', minWidth: 100 }}>
                {statusForm.name ? statusToValue(statusForm.name) : '—'}
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={addStatus} disabled={statusSaving}>
              {statusSaving ? <span className="spinner" style={{ width: 13, height: 13 }} /> : 'Save'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowStatusForm(false); setStatusError('') }}>
              Cancel
            </button>
          </div>
        )}

        {statusError && (
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, marginBottom: 12, color: '#FCA5A5', fontSize: 12 }}>
            <AlertCircle size={13} />{statusError}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {statuses.map((status, i) => (
            <div key={status.id} style={ROW}>
              <GripVertical size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <div style={{ width: 14, height: 14, borderRadius: 4, background: status.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{status.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{statusToValue(status.name)}</span>
              <div style={{ display: 'flex', gap: 2 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '3px 7px', fontSize: 12, opacity: i === 0 ? 0.3 : 1 }}
                  disabled={i === 0}
                  onClick={() => moveStatus(i, i - 1)}
                >↑</button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '3px 7px', fontSize: 12, opacity: i === statuses.length - 1 ? 0.3 : 1 }}
                  disabled={i === statuses.length - 1}
                  onClick={() => moveStatus(i, i + 1)}
                >↓</button>
              </div>
              {statusDeleteWarn === status.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={12} color="#FCA5A5" />
                  <span style={{ fontSize: 11, color: '#FCA5A5' }}>Tasks use this status — cannot delete</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => setStatusDeleteWarn(null)}>Dismiss</button>
                </div>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--danger)', padding: 5 }}
                  onClick={() => removeStatus(status)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── SUB-TEAMS (read-only) ── */}
      <div style={SECTION}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>Sub-Teams</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Fixed sub-team categories used to tag tasks — these cannot be modified
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SUB_TEAMS.map(st => (
            <div key={st.name} style={ROW}>
              <div style={{ width: 14, height: 14, borderRadius: 4, background: st.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{st.name}</span>
              <span style={{
                padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                background: st.color + '22', color: st.color, border: `1px solid ${st.color}44`,
              }}>
                {st.abbr}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '3px 8px', background: 'var(--bg-secondary)', borderRadius: 4, border: '1px solid var(--border)' }}>
                Fixed
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
