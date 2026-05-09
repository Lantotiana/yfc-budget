import { useTranslation } from 'react-i18next'
import { CheckCircle2, CircleCheckBig, LoaderCircle, Trash2 } from 'lucide-react'
import DueDateBadge from './DueDateBadge'
import PriorityBadge from './PriorityBadge'
import { initials } from '../../utils/taskUtils'

export default function TaskCard({ task, onOpen, onDelete, assignableMembers = [], draggable = false, onDragStart, dragging = false, highlighted = false }) {
  const { t } = useTranslation()
  const names = Array.isArray(task.assignedToNames) ? task.assignedToNames : []
  const assignedPeople = (task.assignedTo || []).map((uid, index) => {
    const member = assignableMembers.find(item => item.uid === uid)
    return {
      uid,
      name: member?.name || names[index] || 'Staff',
      photoURL: member?.photoURL || '',
    }
  })
  const people = assignedPeople.length ? assignedPeople : names.map(name => ({ uid: name, name, photoURL: '' }))
  const checklist = Array.isArray(task.checklist) ? task.checklist.filter(item => item?.text) : []
  const doneCount = checklist.filter(item => item.done).length
  const progress = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0
  const StatusIcon = task.status === 'done' ? CheckCircle2 : task.status === 'in_progress' ? LoaderCircle : CircleCheckBig

  return (
    <div
      className={`task-card${dragging ? ' dragging' : ''}${highlighted ? ' highlighted' : ''}`}
      data-task-id={task.id}
      style={{ position: 'relative' }}
      draggable={draggable}
      onDragStart={event => onDragStart?.(event, task)}
      onDragEnd={event => event.currentTarget.classList.remove('dragging')}
    >
      {onDelete && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 10, border: '1px solid var(--border-color, #e2e8f0)', background: 'transparent', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Trash2 size={14} />
        </button>
      )}

      <div onClick={() => onOpen(task)} style={{ cursor: 'pointer' }}>
        <div className="task-card-head" style={{ paddingRight: onDelete ? 32 : 0 }}>
          <h3>{task.title}</h3>
        </div>
        {task.description && <p>{task.description}</p>}
        <div className="task-card-badges">
          <span className={`tasks-badge status-${task.status}`}>
            <StatusIcon size={13} />
            {t(`tasks.${task.status === 'in_progress' ? 'inProgress' : task.status === 'todo' ? 'aTodo' : 'done'}`)}
          </span>
          <DueDateBadge deadline={task.deadline} status={task.status} />
          <PriorityBadge priority={task.priority} />
        </div>
        {checklist.length > 0 && (
          <div className="task-card-progress">
            <div className="task-card-progress-head">
              <span>Checklist</span>
              <strong>{doneCount}/{checklist.length}</strong>
            </div>
            <div className="task-card-progress-track">
              <div style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        <div className="task-card-people">
          <div className="task-avatars">
            {people.slice(0, 4).map(person => (
              <span key={person.uid || person.name} title={person.name}>
                {person.photoURL ? <img src={person.photoURL} alt="" /> : initials(person.name)}
              </span>
            ))}
            {people.length > 4 && <span>+{people.length - 4}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
