/**
 * STORAGE SETUP REQUIRED
 * Before file uploads will work, you must manually create the storage bucket in Supabase:
 *   1. Go to Supabase Dashboard → Storage → New bucket
 *   2. Name it exactly: task-files
 *   3. Set it to private (not public) — signed URLs are used for downloads
 *   4. Make sure you have already run supabase-schema.sql which adds the RLS policies
 */

import { useState, useEffect, useRef } from 'react'
import { FolderOpen, Upload, Download, Trash2, FileText, Image, File, Search, AlertCircle, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/Avatar'
import { format } from 'date-fns'

const SAFE_NAME_RE = /[^a-zA-Z0-9._-]/g

function FileIcon({ name }) {
  const ext = name?.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return <Image size={16} color="#A855F7" />
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) return <FileText size={16} color="#3B82F6" />
  return <File size={16} color="#64748B" />
}

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function Files() {
  const { user } = useAuth()
  const [files, setFiles] = useState([])
  const [tasks, setTasks] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedTask, setSelectedTask] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    Promise.all([fetchFiles(), fetchTasks()]).finally(() => setLoading(false))
  }, [])

  async function fetchFiles() {
    const { data, error } = await supabase
      .from('files')
      .select('*, profiles(full_name), tasks(title)')
      .order('created_at', { ascending: false })
    if (error) console.error('Files fetch error:', error)
    setFiles(data || [])
  }

  async function fetchTasks() {
    const { data } = await supabase.from('tasks').select('id, title').order('title')
    setTasks(data || [])
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setUploadError('')

    try {
      // Sanitise file name to avoid storage path issues
      const safeName = file.name.replace(SAFE_NAME_RE, '_')
      const path = `${user.id}/${selectedTask || 'general'}/${Date.now()}-${safeName}`

      const { error: uploadErr } = await supabase.storage
        .from('task-files')
        .upload(path, file)

      if (uploadErr) {
        console.error('Storage upload error:', uploadErr)
        // Provide a helpful message if the bucket doesn't exist
        const msg = uploadErr.message?.includes('bucket')
          ? 'Bucket "task-files" not found. Create it in Supabase Dashboard → Storage.'
          : uploadErr.message
        throw new Error(msg)
      }

      const { error: dbErr } = await supabase.from('files').insert({
        task_id: selectedTask || null,
        uploaded_by: user.id,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
      })

      if (dbErr) {
        console.error('File record insert error:', dbErr)
        throw new Error(dbErr.message)
      }

      await fetchFiles()
    } catch (err) {
      setUploadError(err.message || 'Upload failed. Check the console for details.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDownload(file) {
    const { data, error } = await supabase.storage
      .from('task-files')
      .createSignedUrl(file.file_path, 120)
    if (error) {
      console.error('Download error:', error)
      return
    }
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleDelete(file) {
    if (!window.confirm(`Delete "${file.file_name}"?`)) return
    const { error: storageErr } = await supabase.storage
      .from('task-files')
      .remove([file.file_path])
    if (storageErr) console.error('Storage delete error:', storageErr)
    await supabase.from('files').delete().eq('id', file.id)
    setFiles(prev => prev.filter(f => f.id !== file.id))
  }

  const filtered = files.filter(f =>
    !search || f.file_name.toLowerCase().includes(search.toLowerCase())
  )

  const totalSize = files.reduce((sum, f) => sum + (f.file_size || 0), 0)

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Files</h1>
          <p className="page-subtitle">{files.length} file{files.length !== 1 ? 's' : ''} · {formatBytes(totalSize)} total</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            aria-label="Attach to task"
            className="select"
            value={selectedTask}
            onChange={e => setSelectedTask(e.target.value)}
            style={{ width: 'auto', minWidth: 160 }}
          >
            <option value="">No task (general)</option>
            {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <button
            className="btn btn-primary"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={14} />
            {uploading ? 'Uploading…' : 'Upload File'}
          </button>
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
        </div>
      </div>

      {/* Upload error banner */}
      {uploadError && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '12px 16px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8,
          marginBottom: 18,
          color: '#FCA5A5',
          fontSize: 13,
        }}>
          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ flex: 1 }}>{uploadError}</span>
          <button
            aria-label="Dismiss error"
            onClick={() => setUploadError('')}
            style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', padding: 0, display: 'flex' }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 360, marginBottom: 20 }}>
        <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          aria-label="Search files"
          className="input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search files…"
          style={{ paddingLeft: 34 }}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <FolderOpen size={40} />
          <p style={{ fontSize: 15, fontWeight: 500 }}>
            {search ? 'No results found' : 'No files uploaded yet'}
          </p>
          <p style={{ fontSize: 13 }}>
            {search ? 'Try a different search term' : 'Upload a file using the button above'}
          </p>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 80px 100px 60px',
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-primary)',
          }}>
            {['File Name', 'Uploaded By', 'Task', 'Size', 'Date', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {h}
              </div>
            ))}
          </div>

          {filtered.map((file, i) => (
            <div
              key={file.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 80px 100px 60px',
                padding: '14px 20px',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center',
                transition: 'background 0.15s',
                gap: 8,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              {/* File name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 32, height: 32,
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <FileIcon name={file.file_name} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.file_name}
                </span>
              </div>

              {/* Uploader */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Avatar name={file.profiles?.full_name} size="sm" />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.profiles?.full_name || 'Unknown'}
                </span>
              </div>

              {/* Task */}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.tasks?.title || <span style={{ fontStyle: 'italic' }}>General</span>}
              </div>

              {/* Size */}
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {formatBytes(file.file_size)}
              </div>

              {/* Date */}
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {format(new Date(file.created_at), 'MMM d, yyyy')}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  aria-label="Download"
                  onClick={() => handleDownload(file)}
                  style={{ padding: 6 }}
                >
                  <Download size={14} aria-hidden="true" />
                </button>
                {file.uploaded_by === user.id && (
                  <button
                    className="btn btn-ghost btn-sm"
                    aria-label="Delete"
                    onClick={() => handleDelete(file)}
                    style={{ padding: 6, color: 'var(--danger)' }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
