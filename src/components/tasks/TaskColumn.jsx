import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import TaskCard from './TaskCard'

export default function TaskColumn({ column, tasks, onOpen, assignableMembers, canCreate, onCreate, canDrag, draggingTaskId, highlightedTaskId, onDragStart, onDropTask }) {
  const { t } = useTranslation()
  const [dragOver, setDragOver] = useState(false)

  function handleDragOver(event) {
    if (!canDrag || !draggingTaskId) return
    event.preventDefault()
    setDragOver(true)
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragOver(false)
    if (!canDrag || !draggingTaskId) return
    onDropTask?.(column.key)
  }

  return (
    <section
      className={`task-column task-column-${column.key}${dragOver ? ' drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="task-column-head">
        <h2>{t(column.labelKey)}</h2>
        <span>{tasks.length}</span>
      </div>
      <div className="task-column-list">
        {tasks.length === 0 ? (
          <div className="task-empty-state">
            <p>{t(column.emptyKey)}</p>
            {canCreate && column.key !== 'done' && <button type="button" onClick={onCreate}>{t('tasks.newTaskTitle')}</button>}
          </div>
        ) : tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onOpen={onOpen}
            assignableMembers={assignableMembers}
            draggable={canDrag}
            dragging={draggingTaskId === task.id}
            highlighted={highlightedTaskId === task.id}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </section>
  )
}
