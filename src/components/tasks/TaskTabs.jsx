import { useState } from 'react'
import TaskCard from './TaskCard'
import { TASK_COLUMNS } from '../../utils/taskUtils'

export default function TaskTabs({ tasksByStatus, onOpen, assignableMembers, canCreate, onCreate }) {
  const [active, setActive] = useState('todo')
  const column = TASK_COLUMNS.find(item => item.key === active) || TASK_COLUMNS[0]
  const tasks = tasksByStatus[active] || []

  return (
    <div className="task-tabs-wrap">
      <div className="task-tabs" role="tablist">
        {TASK_COLUMNS.map(item => (
          <button
            key={item.key}
            type="button"
            className={active === item.key ? 'active' : ''}
            onClick={() => setActive(item.key)}
          >
            {item.label}
            <span>{tasksByStatus[item.key]?.length || 0}</span>
          </button>
        ))}
      </div>
      <div className="task-tab-list">
        {tasks.length === 0 ? (
          <div className="task-empty-state">
            <p>{column.empty}</p>
            {canCreate && column.key !== 'done' && <button type="button" onClick={onCreate}>Créer une tâche</button>}
          </div>
        ) : tasks.map(task => <TaskCard key={task.id} task={task} onOpen={onOpen} assignableMembers={assignableMembers} />)}
      </div>
    </div>
  )
}
