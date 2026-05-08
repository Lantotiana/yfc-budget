import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import TaskColumn from './TaskColumn'
import TaskTabs from './TaskTabs'
import TaskFilters from './TaskFilters'
import TaskModal from './TaskModal'
import TaskForm from './TaskForm'
import Confetti from './Confetti'
import Portal from '../Portal'
import useMediaQuery from '../../hooks/useMediaQuery'
import {
  TASK_COLUMNS,
  canCreateTasks,
  getDueDateStatus,
} from '../../utils/taskUtils'

function norm(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export default function TaskBoard({
  user,
  userData,
  currentMember,
  tasks,
  counters,
  assignableMembers,
  loading,
  error,
  membersLoading,
  membersError,
  createTask,
  updateTask,
  updateTaskStatus,
  archiveTask,
}) {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState({ search: '', assignee: 'all', priority: 'all', mine: false, overdue: false })
  const [activeTab, setActiveTab] = useState('todo')
  const [selectedTask, setSelectedTask] = useState(null)
  const [creating, setCreating] = useState(false)
  const [draggingTask, setDraggingTask] = useState(null)
  const [highlightedTaskId, setHighlightedTaskId] = useState('')
  const [toast, setToast] = useState('')
  const [confetti, setConfetti] = useState(false)
  const canCreate = canCreateTasks(user)
  const canDrag = Boolean(user?.uid)

  useEffect(() => {
    function openCreate() {
      if (canCreate) setCreating(true)
    }
    window.addEventListener('yfc-open-task-create', openCreate)
    return () => window.removeEventListener('yfc-open-task-create', openCreate)
  }, [canCreate])

  useEffect(() => {
    const taskId = searchParams.get('task')
    if (!taskId || tasks.length === 0) return
    const task = tasks.find(item => item.id === taskId)
    if (!task) return

    if (task.status) setActiveTab(task.status)
    setHighlightedTaskId(taskId)

    const scrollTimer = window.setTimeout(() => {
      document.querySelector(`[data-task-id="${CSS.escape(taskId)}"]`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 180)
    const clearTimer = window.setTimeout(() => {
      setHighlightedTaskId('')
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.delete('task')
        return next
      }, { replace: true })
    }, 2600)

    return () => {
      window.clearTimeout(scrollTimer)
      window.clearTimeout(clearTimer)
    }
  }, [searchParams, setSearchParams, tasks])

  const filteredTasks = useMemo(() => {
    const term = norm(filters.search)
    return tasks.filter(task => {
      if (term && !norm(`${task.title} ${task.description} ${(task.assignedToNames || []).join(' ')}`).includes(term)) return false
      if (filters.assignee !== 'all' && !(task.assignedTo || []).includes(filters.assignee)) return false
      if (filters.priority !== 'all' && task.priority !== filters.priority) return false
      if (filters.mine && !(task.assignedTo || []).includes(user?.uid)) return false
      if (filters.overdue && !getDueDateStatus(task.deadline, task.status).isOverdue) return false
      return true
    })
  }, [filters, tasks, user?.uid])

  const filteredByStatus = useMemo(() => TASK_COLUMNS.reduce((acc, col) => {
    acc[col.key] = filteredTasks.filter(task => task.status === col.key)
    return acc
  }, {}), [filteredTasks])

  async function handleCreate(payload) {
    await createTask(payload)
    setCreating(false)
    setToast(t('tasks.created'))
    window.setTimeout(() => setToast(''), 2200)
  }

  async function handleStatus(task, status) {
    await updateTaskStatus(task, status)
    setSelectedTask(prev => prev?.id === task.id ? { ...prev, status } : prev)
    if (status === 'done') {
      setConfetti(true)
      window.setTimeout(() => setConfetti(false), 4000)
    }
    setToast(t('tasks.statusUpdated'))
    window.setTimeout(() => setToast(''), 2200)
  }

  function handleDragStart(event, task) {
    if (!canDrag) return
    setDraggingTask(task)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)
  }

  async function handleDropTask(status) {
    if (!draggingTask) return
    const task = draggingTask
    setDraggingTask(null)
    if (task.status === status) return
    await handleStatus(task, status)
  }

  return (
    <div className="tasks-page">
      <div className="tasks-hero textured-page-header" style={{ '--header-color': '#16b5a3' }}>
        <div>
          <h1>{t('tasks.title')}</h1>
          <p>{counters.total} {t('tasks.title').toLowerCase()}</p>
        </div>
        {canCreate && <button type="button" onClick={() => setCreating(true)}>{t('tasks.newTask')}</button>}
      </div>

      <div className="tasks-summary">
        <button type="button" className="summary-todo" onClick={() => setActiveTab('todo')}><span>{t('tasks.aTodo')}</span><strong>{counters.todo}</strong></button>
        <button type="button" className="summary-progress" onClick={() => setActiveTab('in_progress')}><span>{t('tasks.inProgress')}</span><strong>{counters.in_progress}</strong></button>
        <button type="button" className="summary-done" onClick={() => setActiveTab('done')}><span>{t('tasks.done')}</span><strong>{counters.done}</strong></button>
        <div className="summary-overdue"><span>{t('tasks.overdue')}</span><strong>{counters.overdue}</strong></div>
      </div>

      <TaskFilters filters={filters} setFilters={setFilters} assignableMembers={assignableMembers} compact={!isDesktop} />

      {error && <div className="task-load-error">{error}</div>}
      {membersError && <div className="task-load-error">{membersError}</div>}
      {membersLoading && <div className="task-load-note">{t('tasks.loadingMembers')}</div>}

      {loading ? (
        <div className="task-board-loading">{t('tasks.loadingTasks')}</div>
      ) : isDesktop ? (
        <div className="task-board">
          {TASK_COLUMNS.map(column => (
            <TaskColumn
              key={column.key}
              column={column}
              tasks={filteredByStatus[column.key] || []}
              onOpen={setSelectedTask}
              assignableMembers={assignableMembers}
              canCreate={canCreate}
              onCreate={() => setCreating(true)}
              canDrag={canDrag}
              draggingTaskId={draggingTask?.id}
              highlightedTaskId={highlightedTaskId}
              onDragStart={handleDragStart}
              onDropTask={handleDropTask}
            />
          ))}
        </div>
      ) : (
        <TaskTabs
          tasksByStatus={filteredByStatus}
          active={activeTab}
          setActive={setActiveTab}
          onOpen={setSelectedTask}
          assignableMembers={assignableMembers}
          highlightedTaskId={highlightedTaskId}
          canCreate={canCreate}
          onCreate={() => setCreating(true)}
        />
      )}

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          user={user}
          userData={userData}
          currentMember={currentMember}
          assignableMembers={assignableMembers}
          onClose={() => setSelectedTask(null)}
          onUpdate={updateTask}
          onStatus={handleStatus}
          onArchive={archiveTask}
        />
      )}

      {creating && (
        <Portal>
          <div className="modal-overlay task-modal-overlay" onClick={() => setCreating(false)}>
            <div className="task-modal" onClick={e => e.stopPropagation()}>
              <div className="task-modal-head">
                <div>
                  <span className="tasks-badge status-todo">{t('tasks.newLabel')}</span>
                  <h2>{t('tasks.newTaskTitle')}</h2>
                </div>
              </div>
              <TaskForm
                assignableMembers={assignableMembers}
                canEditAll={canCreate}
                onCancel={() => setCreating(false)}
                onSubmit={handleCreate}
              />
            </div>
          </div>
        </Portal>
      )}

      {toast && <div className="toast task-toast">{toast}</div>}
      <Confetti active={confetti} />
    </div>
  )
}
