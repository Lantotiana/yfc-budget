import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
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
  onDelete,
}) {
  const { t } = useTranslation()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  if (!task) return null

  const canEdit = canEditTask(task, user, userData, currentMember)

  return (
    <>
    <Portal>
      <div className="bottom-sheet-overlay" onClick={onClose}>
        <div className="bottom-sheet materiel-form-sheet task-create-sheet" onClick={e => e.stopPropagation()}>
          <div className="bottom-sheet-handle" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 className="dialog-title" style={{ margin: 0 }}>{task.title}</h2>
            {onDelete && <button type="button" className="task-icon-btn" onClick={() => setConfirmingDelete(true)} aria-label="Supprimer" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#ef4444' }}><Trash2 size={16} /></button>}
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

    {confirmingDelete && (
      <Portal>
        <div className="modal-overlay" onClick={() => setConfirmingDelete(false)} style={{ zIndex: 5500 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="dialog-title" style={{ marginBottom: 8 }}>Supprimer cette tâche ?</div>
            <p style={{ fontSize: 'var(--font-sm)', marginBottom: 20 }}>Cette action est irréversible.</p>
            <div className="dialog-footer">
              <button className="btn-secondary materiel-footer-btn" onClick={() => setConfirmingDelete(false)}>{t('common.cancel')}</button>
              <button className="materiel-primary-btn" style={{ background: '#ef4444', color: '#fff' }} onClick={onDelete}>Supprimer</button>
            </div>
          </div>
        </div>
      </Portal>
    )}
    </>
  )
}
