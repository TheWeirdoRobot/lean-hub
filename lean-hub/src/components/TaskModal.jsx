import { useState, useEffect, useRef } from 'react'
import { X, Send, Paperclip, Trash2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Avatar from './Avatar'
import { format } from 'date-fns'
import { useCustomPhases } from '../hooks/useCustomPhases'
import { useCustomStatuses, statusToValue } from '../hooks/useCustomStatuses'

const SAFE_NAME_RE = /[^a-zA-Z0-9._-]/g

const PRIORITIES = [
  { value: 'low',      label: 'Low' },
  { value: 'medium',   label: 'Medium' },
  { value: 'high',     label: 'High' },
  { value: 'critical', label: 'Critical' },
]

const SUB_TEAMS = ['Full Team', 'Mechanical', 'Electrical']

export default function TaskModal({ task, profiles, onClose, onSave, onCreate, onDelete }) {
  const { user, profile } = useAuth()
  const { phases } = useCustomPhases()
  const { statuses } = useCustomStatuses()
  const isNew = !task?.id

  const [form, setForm] = useState({
    title:       task?.title       || '',
    description: task?.description || '',
    assigned_to: task?.assigned_to || '',
    status:      task?.status      || 'not_started',
    priority:    task?.priority    || 'medium',
    phase:       task?.phase       || 'Research',
    sub_team:    task?.sub_team    || 'Full Team',
    start_date:  task?.start_date  || '',
    end_date:    task?.end_date    || '',
  })
  const [saving, setSaving]                     = useState(false)
  const [saveError, setSaveError]               = useState('')
  const [confirmDelete, setConfirmDelete]       = useState(false)
  const [deleteError, setDeleteError]           = useState('')
  const [comments, setComments]                 = useState([])
  const [newComment, setNewComment]             = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [commentError, setCommentError]         = useState('')
  const [files, setFiles]                       = useState([])
  const [uploading, setUploading]               = useState(false)
  const [uploadError, setUploadError]           = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    if (!task?.id) return
    fetchComments()
    fetchFiles()

    const sub = supabase
      .channel(`task-comments-${task.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'comments',
        filter: `task_id=eq.${task.id}`,
      }, () => fetchComments())
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [task?.id])

  // Keep form.phase in sync if phases load after initial render and form.phase has no match
  useEffect(() => {
    if (phases.length > 0 && isNew && !phases.find(p => p.name === form.phase)) {
      setForm(f => ({ ...f, phase: phases[0].name }))
    }
  }, [phases])

  async function fetchComments() {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(full_name)')
      .eq('task_id', task.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  async function fetchFiles() {
    const { data } = await supabase
      .from('files')
      .select('*, profiles(full_name)')
      .eq('task_id', task.id)
      .order('created_at', { ascending: false })
    setFiles(data || [])
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    setSaveError('')
    const sanitized = {
      ...form,
      assigned_to: form.assigned_to || null,
      start_date:  form.start_date  || null,
      end_date:    form.end_date    || null,
    }
    try {
      if (isNew) {
        await onCreate({ ...sanitized, created_by: user.id })
      } else {
        await onSave(task.id, sanitized)
      }
      onClose()
    } catch (err) {
      console.error('Save error:', err)
      setSaveError(err.message || 'Failed to save task.')
    } finally {
      setSaving(false)
    }
  }

  async function handleComment(e) {
    e.preventDefault()
    if (!newComment.trim()) return
    setSubmittingComment(true)
    setCommentError('')
    const { error } = await supabase.from('comments').insert({
      task_id:   task.id,
      author_id: user.id,
      content:   newComment.trim(),
    })
    if (error) {
      setCommentError(error.message)
    } else {
      setNewComment('')
      await fetchComments()
    }
    setSubmittingComment(false)
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const safeName = file.name.replace(SAFE_NAME_RE, '_')
      const path = `${user.id}/${task.id}/${Date.now()}-${safeName}`
      const { error: uploadErr } = await supabase.storage.from('task-files').upload(path, file)
      if (uploadErr) throw new Error(uploadErr.message)
      const { error: dbErr } = await supabase.from('files').insert({
        task_id:     task.id,
        uploaded_by: user.id,
        file_name:   file.name,
        file_path:   path,
        file_size:   file.size,
      })
      if (dbErr) throw new Error(dbErr.message)
      await fetchFiles()
    } catch (err) {
      setUploadError(err.message || 'Upload failed.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDownload(file) {
    const { data } = await supabase.storage.from('task-files').createSignedUrl(file.file_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleDeleteFile(file) {
    await supabase.storage.from('task-files').remove([file.file_path])
    await supabase.from('files').delete().eq('id', file.id)
    setFiles(prev => prev.filter(f => f.id !== file.id))
  }

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal fade-in" style={{ maxWidth: isNew ? 580 : 700 }}>
        <div className="modal-header">
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
            {isNew ? 'New Task' : 'Task Details'}
          </h2>
          <button className="btn btn-ghost btn-sm" aria-label="Close" onClick={onClose} style={{ padding: 6 }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body">
          {/* Title */}
          <div className="form-group">
            <label htmlFor="task-title">Title *</label>
            <input id="task-title" className="input" value={form.title} onChange={set('title')} placeholder="Task title…" />
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="task-description">Description</label>
            <textarea
              id="task-description"
              className="input"
              value={form.description}
              onChange={set('description')}
              placeholder="Describe the task…"
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Row: status + priority */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label htmlFor="task-status">Status</label>
              <select id="task-status" className="select" value={form.status} onChange={set('status')}>
                {statuses.map(s => (
                  <option key={s.name} value={statusToValue(s.name)}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="task-priority">Priority</label>
              <select id="task-priority" className="select" value={form.priority} onChange={set('priority')}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Row: phase + sub_team + assignee */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label htmlFor="task-phase">Phase</label>
              <select id="task-phase" className="select" value={form.phase} onChange={set('phase')}>
                {phases.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="task-subteam">Sub-team</label>
              <select id="task-subteam" className="select" value={form.sub_team} onChange={set('sub_team')}>
                {SUB_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="task-assignee">Assigned To</label>
              <select id="task-assignee" className="select" value={form.assigned_to} onChange={set('assigned_to')}>
                <option value="">Unassigned</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label htmlFor="task-start">Start Date</label>
              <input id="task-start" type="date" className="input" value={form.start_date} onChange={set('start_date')} />
            </div>
            <div className="form-group">
              <label htmlFor="task-end">Due Date</label>
              <input id="task-end" type="date" className="input" value={form.end_date} onChange={set('end_date')} />
            </div>
          </div>

          {/* Errors */}
          {saveError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, marginBottom: 12, color: '#FCA5A5', fontSize: 12 }}>
              <AlertCircle size={13} />{saveError}
            </div>
          )}
          {deleteError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, marginBottom: 12, color: '#FCA5A5', fontSize: 12 }}>
              <AlertCircle size={13} />{deleteError}
            </div>
          )}

          {/* Save / Delete row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <div>
              {!isNew && onDelete && (
                confirmDelete ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Delete this task?</span>
                    <button
                      className="btn btn-sm"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}
                      onClick={async () => {
                        try {
                          setDeleteError('')
                          await onDelete(task.id)
                        } catch (e) {
                          setDeleteError(e.message || 'Failed to delete task.')
                        }
                      }}
                    >
                      Yes, delete
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 size={14} /> Delete Task
                  </button>
                )
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.title.trim()}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
                {isNew ? 'Create Task' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Files & Comments — existing tasks only */}
          {!isNew && (
            <>
              <div className="divider" style={{ margin: '24px 0' }} />

              {/* Files */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Attachments ({files.length})
                  </h3>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    <Paperclip size={13} />
                    {uploading ? 'Uploading…' : 'Attach File'}
                  </button>
                  <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
                </div>
                {uploadError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, marginBottom: 8, color: '#FCA5A5', fontSize: 12 }}>
                    <AlertCircle size={12} />{uploadError}
                  </div>
                )}
                {files.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No files attached.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {files.map(f => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg-primary)', borderRadius: 6, border: '1px solid var(--border)' }}>
                        <Paperclip size={13} color="var(--text-muted)" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.profiles?.full_name} · {formatBytes(f.file_size)}</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" aria-label="Download file" onClick={() => handleDownload(f)} style={{ padding: 4 }}>↓</button>
                        {f.uploaded_by === user.id && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteFile(f)} style={{ padding: 4, color: 'var(--danger)' }}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  Comments ({comments.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                  {comments.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No comments yet. Be the first.</p>
                  )}
                  {comments.map(c => (
                    <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                      <Avatar name={c.profiles?.full_name} size="sm" />
                      <div style={{ flex: 1, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{c.profiles?.full_name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{format(new Date(c.created_at), 'MMM d, h:mm a')}</span>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {commentError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, marginBottom: 8, color: '#FCA5A5', fontSize: 12 }}>
                    <AlertCircle size={12} />{commentError}
                  </div>
                )}
                <form onSubmit={handleComment} style={{ display: 'flex', gap: 8 }}>
                  <Avatar name={profile?.full_name} size="sm" style={{ marginTop: 2, flexShrink: 0 }} />
                  <input
                    className="input"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    style={{ flex: 1 }}
                  />
                  <button
                    type="submit"
                    aria-label="Post comment"
                    className="btn btn-primary btn-sm"
                    disabled={submittingComment || !newComment.trim()}
                    style={{ paddingLeft: 12, paddingRight: 12 }}
                  >
                    <Send size={13} aria-hidden="true" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
