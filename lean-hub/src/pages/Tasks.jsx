import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Plus, Calendar, GripVertical, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AvatarStack from '../components/AvatarStack'
import TaskModal from '../components/TaskModal'
import { format, isPast, parseISO } from 'date-fns'
import { useCustomPhases } from '../hooks/useCustomPhases'
import { useCustomStatuses, statusToValue } from '../hooks/useCustomStatuses'
import { SUB_TEAMS, subTeamOf, DEFAULT_SUB_TEAM } from '../lib/teams'
import { assigneesOf, isAssignedTo } from '../lib/taskPeople'

const TASK_SELECT = '*, creator:profiles!tasks_created_by_fkey(id, full_name)'

export default function Tasks() {
  const location = useLocation()
  const navigate = useNavigate()

  const { statuses, loading: statusesLoading } = useCustomStatuses()
  const { phaseColorMap, loading: phasesLoading } = useCustomPhases()

  const [tasks, setTasks]           = useState([])
  const [profiles, setProfiles]     = useState([])
  const [showModal, setShowModal]   = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterSubTeam, setFilterSubTeam]   = useState('')
  const [dataLoading, setDataLoading] = useState(true)

  const [pendingOpenId, setPendingOpenId] = useState(location.state?.openTaskId || null)

  const isDragging   = useRef(false)
  const missedUpdate = useRef(false)

  const loading = dataLoading || statusesLoading || phasesLoading

  // Build kanban columns dynamically from custom statuses
  const COLUMNS = statuses.map(s => ({
    id:    statusToValue(s.name),
    label: s.name,
    color: s.color,
  }))

  useEffect(() => {
    Promise.all([fetchTasks(), fetchProfiles()]).finally(() => setDataLoading(false))
  }, [])

  // Live sync: pick up teammates' task changes without a manual refresh
  useEffect(() => {
    const channel = supabase
      .channel('board-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        // Replacing the list mid-drag drops the card being dragged, so defer
        // until the drag finishes.
        if (isDragging.current) {
          missedUpdate.current = true
          return
        }
        fetchTasks()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (!pendingOpenId || loading || tasks.length === 0) return
    const target = tasks.find(t => t.id === pendingOpenId)
    if (target) {
      setEditingTask(target)
      setShowModal(true)
      setPendingOpenId(null)
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

  function flushMissedUpdate() {
    if (!missedUpdate.current) return
    missedUpdate.current = false
    fetchTasks()
  }

  async function handleDragEnd(result) {
    isDragging.current = false
    const { destination, source, draggableId } = result
    if (!destination || destination.droppableId === source.droppableId) {
      flushMissedUpdate()
      return
    }
    const newStatus = destination.droppableId
    setTasks(prev => prev.map(t => t.id === draggableId ? { ...t, status: newStatus } : t))
    await supabase.from('tasks').update({ status: newStatus }).eq('id', draggableId)
    flushMissedUpdate()
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
    setShowModal(false)
    setEditingTask(null)
    await fetchTasks()
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
    if (filterAssignee && !isAssignedTo(t, filterAssignee)) return false
    if (filterPriority && t.priority !== filterPriority) return false
    if (filterSubTeam && (t.sub_team || DEFAULT_SUB_TEAM) !== filterSubTeam) return false
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
          <select className="select" value={filterSubTeam} onChange={e => setFilterSubTeam(e.target.value)} style={{ width: 'auto', minWidth: 120 }}>
            <option value="">All Sub-teams</option>
            {SUB_TEAMS.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
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
        <DragDropContext onDragStart={() => { isDragging.current = true }} onDragEnd={handleDragEnd}>
          <div className="kanban-board" style={{ gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(240px, 1fr))` }}>
            {COLUMNS.map(col => {
              const colTasks = byStatus(col.id)
              return (
                <div key={col.id} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div className="kanban-col-head">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{col.label}</span>
                    <span className="kanban-count">{colTasks.length}</span>
                  </div>

                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`kanban-col-body${snapshot.isDraggingOver ? ' drag-over' : ''}`}
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
                                phaseColorMap={phaseColorMap}
                                profiles={profiles}
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

function TaskCard({ task, provided, isDragging, onClick, onDelete, phaseColorMap, profiles }) {
  const [deleteError, setDeleteError] = useState('')
  const isOverdue = task.end_date && task.status !== 'done' && isPast(parseISO(task.end_date))

  const phaseColor = phaseColorMap?.[task.phase] || '#70707C'
  const subTeam = task.sub_team || DEFAULT_SUB_TEAM
  const stStyle = subTeamOf(subTeam)
  const assignees = assigneesOf(task, profiles)

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={e => { if (!e.defaultPrevented) onClick() }}
      className="task-card"
      style={{
        ...(isDragging && {
          background: 'var(--bg-hover)',
          borderColor: 'var(--accent)',
          boxShadow: 'var(--shadow-md)',
        }),
        ...provided.draggableProps.style,
      }}
    >
      <button
        className="task-delete"
        aria-label={`Delete ${task.title}`}
        onClick={async e => {
          e.stopPropagation()
          if (window.confirm(`Delete "${task.title}"? This cannot be undone.`)) {
            try {
              setDeleteError('')
              await onDelete(task.id)
            } catch (err) {
              setDeleteError(err.message || 'Failed to delete task.')
            }
          }
        }}
      >
        <X size={11} />
      </button>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ marginTop: 2, color: 'var(--text-muted)', opacity: 0.5 }}>
          <GripVertical size={13} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
            <span className="tag" style={{ fontSize: 10, background: phaseColor + '1F', color: phaseColor }}>
              {task.phase}
            </span>
            <span className={`badge badge-${task.priority}`}>{task.priority}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, marginBottom: 10, color: 'var(--text-primary)' }}>
            {task.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AvatarStack people={assignees} />
            <span
              title={subTeam}
              style={{
                padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                color: stStyle.color, border: `1px solid ${stStyle.color}44`,
              }}
            >
              {stStyle.abbr}
            </span>
            {task.end_date && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, marginLeft: 'auto', color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                <Calendar size={11} />
                {format(parseISO(task.end_date), 'MMM d')}
              </span>
            )}
          </div>
          {deleteError && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--danger)' }}>{deleteError}</div>
          )}
        </div>
      </div>
    </div>
  )
}
