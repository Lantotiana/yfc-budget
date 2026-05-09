import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Circle, Clock, Search, Triangle, X } from 'lucide-react'
import { initials } from '../../utils/taskUtils'


const PRIORITIES = [
  { value: 'low',    labelKey: 'tasks.priorityLow',    Icon: Triangle, iconColor: '#3b82f6', rotate: true  },
  { value: 'medium', labelKey: 'tasks.priorityMedium', Icon: Circle,   iconColor: '#16a34a', rotate: false },
  { value: 'high',   labelKey: 'tasks.priorityHigh',   Icon: Triangle, iconColor: '#f97316', rotate: false },
]

export default function TaskFilters({ filters, setFilters, membersWithTasks = [] }) {
  const { t } = useTranslation()
  const [spinKey, setSpinKey] = useState({})

  function togglePriority(value) {
    setSpinKey(prev => ({ ...prev, [value]: (prev[value] || 0) + 1 }))
    setFilters(prev => ({ ...prev, priority: prev.priority === value ? 'all' : value }))
  }

  function toggleOverdue() {
    setSpinKey(prev => ({ ...prev, overdue: (prev.overdue || 0) + 1 }))
    setFilters(prev => ({ ...prev, overdue: !prev.overdue }))
  }

  function toggleAssignee(uid) {
    setFilters(prev => {
      const current = prev.assignee
      return {
        ...prev,
        assignee: current.includes(uid) ? current.filter(id => id !== uid) : [...current, uid],
      }
    })
  }

  return (
    <div className="task-filter-bar">

      {/* Search bar */}
      <div className="tx-search-wrapper">
        <div className="tx-search-icon"><Search size={14} /></div>
        <input
          className="tx-search-input"
          type="search"
          placeholder={t('tasks.searchPlaceholder')}
          value={filters.search}
          onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
          style={{ paddingLeft: 38, paddingRight: filters.search ? 38 : 12 }}
        />
        {filters.search && (
          <button
            type="button"
            className="tx-search-clear"
            onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Avatars */}
      {membersWithTasks.length > 0 && (
        <div className="task-filter-top-row">
          <div className="task-filter-members-scroll">
            {membersWithTasks.map(m => (
              <div
                key={m.uid}
                className={`task-filter-avatar-ring${filters.assignee.includes(m.uid) ? ' active' : ''}`}
              >
                <button
                  type="button"
                  className="task-filter-avatar"
                  title={m.name}
                  onClick={() => toggleAssignee(m.uid)}
                >
                  {m.photoURL
                    ? <img src={m.photoURL} alt={m.name} />
                    : <span>{initials(m.name)}</span>
                  }
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags priorité */}
      <div className="task-filter-tags">
        {PRIORITIES.map(({ value, labelKey, Icon, iconColor, rotate }) => (
          <button
            key={value}
            type="button"
            className={`task-filter-tag${filters.priority === value ? ` priority-${value}` : ''}`}
            onClick={() => togglePriority(value)}
          >
            <span
              key={spinKey[value] || 0}
              className={spinKey[value] ? 'tag-icon-spin' : ''}
              style={{ display: 'inline-flex', alignItems: 'center' }}
            >
              <Icon
                size={12}
                style={{
                  color: filters.priority === value ? 'currentColor' : iconColor,
                  transform: rotate ? 'rotate(180deg)' : undefined,
                  flexShrink: 0,
                }}
              />
            </span>
            {t(labelKey)}
          </button>
        ))}
        <button
          type="button"
          className={`task-filter-tag${filters.overdue ? ' danger' : ''}`}
          onClick={toggleOverdue}
        >
          <span
            key={spinKey.overdue || 0}
            className={spinKey.overdue ? 'tag-icon-spin' : ''}
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            <Clock size={12} style={{ color: filters.overdue ? 'currentColor' : '#ef4444', flexShrink: 0 }} />
          </span>
          {t('tasks.filterOverdue')}
        </button>
      </div>
    </div>
  )
}
