import { useState } from 'react'
import { CalendarDays, CheckCircle2, Pencil, Trash2, UserRound, X } from 'lucide-react'
import Portal from '../Portal'
import TaskForm from './TaskForm'
import DueDateBadge from './DueDateBadge'
import PriorityBadge from './PriorityBadge'
import {
  TASK_STATUS_LABELS,
  canArchiveTask,
  canChangeTaskStatus,
  canEditTask,
  formatDate,
} from '../../utils/taskUtils'

export default function TaskModal({
  task,
  user,
  userData,
  currentMember,
  assignableMembers,
  onClose,
  onUpdate,
  onStatus,
  onArchive,
}) {
  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)
  if (!task) return null

  const canEdit = canEditTask(task, user, userData, currentMember)
  const canStatus = canChangeTaskStatus(task, user, userData, currentMember)
  const canArchive = canArchiveTask(user, userData, currentMember)
  const statusActions = [
    ['todo', 'Remettre à faire'],
    ['in_progress', 'Mettre en cours'],
    ['done', 'Terminer'],
  ].filter(([status]) => status !== task.status)

  async function archive() {
    if (!window.confirm('Voulez-vous vraiment supprimer cette tâche ?')) return
    setArchiving(true)
    await onArchive(task)
    setArchiving(false)
    onClose()
  }

  return (
    <Portal>
      <div className="modal-overlay task-modal-overlay" onClick={onClose}>
        <div className="task-modal" onClick={e => e.stopPropagation()}>
          <div className="task-modal-head">
            <div>
              <span className={`tasks-badge status-${task.status}`}>{TASK_STATUS_LABELS[task.status]}</span>
              <h2>{editing ? 'Modifier la tâche' : task.title}</h2>
            </div>
            <button type="button" className="task-icon-btn" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
          </div>

          {editing ? (
            <TaskForm
              task={task}
              assignableMembers={assignableMembers}
              canEditAll={canEdit}
              submitLabel="Mettre à jour"
              onCancel={() => setEditing(false)}
              onSubmit={async payload => {
                await onUpdate(task.id, payload, task)
                setEditing(false)
              }}
            />
          ) : (
            <>
              <div className="task-detail-body">
                {task.description ? <p className="task-detail-description">{task.description}</p> : <p className="task-detail-muted">Aucune description.</p>}
                <div className="task-card-badges">
                  <DueDateBadge deadline={task.deadline} status={task.status} />
                  <PriorityBadge priority={task.priority} />
                </div>

                <div className="task-detail-grid">
                  <div><CalendarDays size={15} /><span>Deadline</span><strong>{formatDate(task.deadline)}</strong></div>
                  <div><UserRound size={15} /><span>Assignés</span><strong>{(task.assignedToNames || []).join(', ') || 'Non assignée'}</strong></div>
                  <div><span>Créé par</span><strong>{task.createdByName || 'Staff YFC'}</strong></div>
                  <div><span>Créé le</span><strong>{formatDate(task.createdAt) || '-'}</strong></div>
                  <div><span>Dernière modification</span><strong>{formatDate(task.updatedAt) || '-'}</strong></div>
                  {task.status === 'done' && <div><CheckCircle2 size={15} /><span>Fin</span><strong>{formatDate(task.completedAt) || '-'}</strong></div>}
                </div>
              </div>

              <div className="task-modal-actions">
                {canEdit && (
                  <button type="button" onClick={() => setEditing(true)}>
                    <Pencil size={15} /> Modifier
                  </button>
                )}
                {canStatus && statusActions.map(([status, label]) => (
                  <button key={status} type="button" className={status === 'done' ? 'success' : ''} onClick={() => onStatus(task, status)}>
                    {label}
                  </button>
                ))}
                {canArchive && (
                  <button type="button" className="danger" onClick={archive} disabled={archiving}>
                    <Trash2 size={15} /> {archiving ? 'Suppression...' : 'Supprimer'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Portal>
  )
}
