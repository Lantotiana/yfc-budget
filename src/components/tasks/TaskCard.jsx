import { ChevronRight } from 'lucide-react'
import DueDateBadge from './DueDateBadge'
import PriorityBadge from './PriorityBadge'
import { TASK_STATUS_LABELS, initials } from '../../utils/taskUtils'

export default function TaskCard({ task, onOpen, assignableMembers = [], draggable = false, onDragStart, dragging = false, highlighted = false }) {
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

  return (
    <button
      type="button"
      className={`task-card${dragging ? ' dragging' : ''}${highlighted ? ' highlighted' : ''}`}
      data-task-id={task.id}
      onClick={() => onOpen(task)}
      draggable={draggable}
      onDragStart={event => onDragStart?.(event, task)}
      onDragEnd={event => {
        event.currentTarget.classList.remove('dragging')
      }}
    >
      <div className="task-card-head">
        <h3>{task.title}</h3>
        <ChevronRight size={17} />
      </div>
      {task.description && <p>{task.description}</p>}
      <div className="task-card-badges">
        <span className={`tasks-badge status-${task.status}`}>{TASK_STATUS_LABELS[task.status]}</span>
        <DueDateBadge deadline={task.deadline} status={task.status} />
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="task-card-people">
        <div className="task-avatars">
          {people.slice(0, 4).map(person => (
            <span key={person.uid || person.name} title={person.name}>
              {person.photoURL ? <img src={person.photoURL} alt="" /> : initials(person.name)}
            </span>
          ))}
          {people.length > 4 && <span>+{people.length - 4}</span>}
        </div>
        <small>{people.length ? people.map(person => person.name).join(', ') : 'Non assignée'}</small>
      </div>
    </button>
  )
}
