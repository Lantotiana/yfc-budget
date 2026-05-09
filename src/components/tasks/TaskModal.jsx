import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import Portal from '../Portal'
import TaskForm from './TaskForm'
import { canEditTask } from '../../utils/taskUtils'

export default function TaskModal({
  task,
  user,
  userData,
  currentMember,
  assignableMembers,
  onClose,
  onUpdate,
}) {
  const { t } = useTranslation()
  if (!task) return null

  const canEdit = canEditTask(task, user, userData, currentMember)

  return (
    <Portal>
      <div className="modal-overlay task-modal-overlay" onClick={onClose}>
        <div className="task-modal" onClick={e => e.stopPropagation()}>
          <div className="task-modal-head">
            <div>
              <span className={`tasks-badge status-${task.status}`}>
                {t(`tasks.${task.status === 'in_progress' ? 'inProgress' : task.status === 'todo' ? 'aTodo' : 'done'}`)}
              </span>
              <h2>{task.title}</h2>
            </div>
            <button type="button" className="task-icon-btn" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
          </div>

          <TaskForm
            task={task}
            assignableMembers={assignableMembers}
            canEditAll={canEdit}
            submitLabel={t('tasks.update')}
            onCancel={onClose}
            onSubmit={async payload => {
              await onUpdate(task.id, payload, task)
              onClose()
            }}
          />
        </div>
      </div>
    </Portal>
  )
}
