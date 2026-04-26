import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Plus, Calendar, GripVertical, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/Avatar'
import TaskModal from '../components/TaskModal'
import { format, isPast, parseISO } from 'date-fns'

// Explicit select that resolves both FKs from tasks → profiles
const TASK_SELECT = '*, assignee:profiles!tasks_assigned_to_fkey(id, full_name), creator:profiles!tasks_created_by_fkey(id, full_name)'

const COLUMNS = [
  { id: 'not_started', label: 'Not Started', color: '#64748B' },
  { id: 'in_progress', label: 'In Progress', color: '#F59E0B' },
  { id: 'review',      label: 'Review',      color: '#3B82F6' },
  { id: 'done',        label: 'Done',        color: '#22C55E' },
]

export default function Tasks() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [loading, setLoading] = useState(true)

  // ID to auto-open once tasks have loaded (passed via router state from Dashboard)
  const [pendingOpenId, setPendingOpenId] = useState(location.state?.openTaskId || null)

  useEffect(() => {
    Promise.all([fetchTasks(), fetchProfiles()]).finally(() => setLoading(false))
  }, [])

  // Once tasks are loaded and a pending ID exists, open that task's modal
  useEffect(() => {
    if (!pendingOpenId || loading || tasks.length === 0) return
    const target = tasks.find(t => t.id === pendingOpenId)
    if (target) {
      setEditingTask(target)
      setShowModal(true)
      setPendingOpenId(null)
      // Clear router state so a hard-refresh doesn't re-open the modal
      navigate('/tasks', { replace: true, state: {} })
    }
  }, [pendingOpenId, loading, tasks])

  async function fetchTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .order('created_at', { ascending: false })
    if (error) console.error('Tasks fetch error:', error)
    setTasks(data || [])
  }

  async function fetchProfiles() {
    const { data } = await supabase.from('profiles').select('*')
    setProfiles(data || [])
  }

  async function handleDragEnd(result) {
    const { destination, source, draggableId } = result
    if (!destination || destination.droppableId === source.droppableId) return
    const newStatus = destination.droppableId
    setTasks(prev => prev.map(t => t.id === draggableId ? { ...t, status: newStatus } : t))
    await supabase.from('tasks').update({ status: newStatus }).eq('id', draggableId)
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
    if (data) setTasks(prev => [data, ...prev])
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) {
      console.error('Task delete error:', error)
      throw new Error(error.message)
    }
    setTasks(prev => prev.filter(t => t.id !== id))
    setShowModal(false)
    setEditingTask(null)
  }

  async function handleSave(id, updates) {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select(TASK_SELECT)
      .single()
    if (error) {
      console.error('Task save error:', error)
      throw new Error(error.message)
    }
    if (data) setTasks(prev => prev.map(t => t.id === id ? data : t))
  }

  const filtered = tasks.filter(t => {
    if (filterAssignee && t.assigned_to !== filterAssignee) return false
    if (filterPriority && t.priority !== filterPriority) return false
    return true
  })

  const byStatus = (status) => filtered.filter(t => t.status === status)

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">{tasks.length} total task{tasks.length !== 1 ? 's' : ''} across all phases</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="select" value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={{ width: 'auto', minWidth: 130 }}>
            <option value="">All Members</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          <select className="select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ width: 'auto', minWidth: 120 }}>
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <button className="btn btn-primary" onClick={() => { setEditingTask(null); setShowModal(true) }}>
            <Plus size={15} /> New Task
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, flex: 1, minHeight: 0 }}>
            {COLUMNS.map(col => {
              const colTasks = byStatus(col.id)
              return (
                <div key={col.id} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px 10px 0 0',
                    borderBottom: 'none',
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{col.label}</span>
                    <span style={{
                      marginLeft: 'auto', fontSize: 11, fontWeight: 600,
                      background: 'var(--bg-primary)', color: 'var(--text-muted)',
                      padding: '1px 7px', borderRadius: 99,
                    }}>{colTasks.length}</span>
                  </div>

                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={{
                          flex: 1, overflowY: 'auto', padding: '8px',
                          background: snapshot.isDraggingOver ? 'rgba(124,58,237,0.06)' : 'var(--bg-secondary)',
                          border: `1px solid ${snapshot.isDraggingOver ? 'rgba(124,58,237,0.35)' : 'var(--border)'}`,
                          borderTop: 'none',
                          borderRadius: '0 0 10px 10px',
                          transition: 'all 0.15s',
                          minHeight: 120,
                        }}
                      >
                        {colTasks.length === 0 && (
                          <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                            Drop tasks here
                          </div>
                        )}
                        {colTasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(prov, snap) => (
                              <TaskCard
                                task={task}
                                provided={prov}
                                isDragging={snap.isDragging}
                                onClick={() => { setEditingTask(task); setShowModal(true) }}
                                onDelete={handleDelete}
                              />
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              )
            })}
          </div>
        </DragDropContext>
      )}

      {showModal && (
        <TaskModal
          task={editingTask}
          profiles={profiles}
          onClose={() => { setShowModal(false); setEditingTask(null) }}
          onSave={handleSave}
          onCreate={handleCreate}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

function TaskCard({ task, provided, isDragging, onClick, onDelete }) {
  const [isHovered, setIsHovered] = useState(false)
  const isOverdue = task.end_date && task.status !== 'done' && isPast(parseISO(task.end_date))

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        background: isDragging ? 'var(--bg-hover)' : 'var(--bg-primary)',
        border: `1px solid ${isDragging ? 'rgba(124,58,237,0.55)' : isHovered ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`,
        borderRadius: 8,
        padding: '12px',
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
        boxShadow: isDragging ? '0 8px 28px rgba(0,0,0,0.5)' : isHovered ? '0 2px 8px rgba(124,58,237,0.15)' : 'none',
        transform: isDragging ? 'rotate(1.5deg)' : 'none',
        ...provided.draggableProps.style,
      }}
    >
      {isHovered && !isDragging && (
        <button
          aria-label={`Delete ${task.title}`}
          onClick={e => {
            e.stopPropagation()
            if (window.confirm(`Delete "${task.title}"? This cannot be undone.`)) {
              onDelete(task.id)
            }
          }}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(239,68,68,0.15)',
            color: '#EF4444',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            zIndex: 1,
          }}
        >
          <X size={11} />
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div {...provided.dragHandleProps} style={{ marginTop: 2, color: 'var(--text-muted)', opacity: 0.5 }}>
          <GripVertical size={13} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
            <span className={`tag tag-${task.phase?.toLowerCase()}`} style={{ fontSize: 10 }}>{task.phase}</span>
            <span className={`badge badge-${task.priority}`}>{task.priority}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, marginBottom: 10, color: 'var(--text-primary)' }}>
            {task.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* assignee avatar — uses the aliased `assignee` key */}
            {task.assignee?.full_name ? (
              <Avatar name={task.assignee.full_name} size="sm" />
            ) : (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px dashed var(--border)' }} />
            )}
            {task.end_date && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                <Calendar size={11} />
                {format(parseISO(task.end_date), 'MMM d')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
