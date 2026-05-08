import { useTranslation } from 'react-i18next'
import TaskCard from './TaskCard'
import { TASK_COLUMNS } from '../../utils/taskUtils'

export default function TaskTabs({ tasksByStatus, active, setActive, onOpen, assignableMembers, highlightedTaskId, canCreate, onCreate }) {
  const { t } = useTranslation()
  const column = TASK_COLUMNS.find(item => item.key === active) || TASK_COLUMNS[0]
  const tasks = tasksByStatus[active] || []

  return (
    <div className="task-tabs-wrap">
      <div className="task-tabs" role="tablist" data-active={active}>
        <span className="task-tabs-indicator" aria-hidden="true" />
        {TASK_COLUMNS.map(item => (
          <button
            key={item.key}
            type="button"
            className={active === item.key ? 'active' : ''}
            onClick={() => setActive(item.key)}
          >
            {t(item.labelKey)}
            <span>{tasksByStatus[item.key]?.length || 0}</span>
          </button>
        ))}
      </div>
      <div className="task-tab-list">
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
            highlighted={highlightedTaskId === task.id}
          />
        ))}
      </div>
    </div>
  )
}
