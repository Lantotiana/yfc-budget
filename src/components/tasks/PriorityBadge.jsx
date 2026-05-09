import { Circle, Triangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const PRIORITY_CONFIG = {
  low:    { Icon: Triangle, rotate: true  },
  medium: { Icon: Circle,   rotate: false },
  high:   { Icon: Triangle, rotate: false },
}

const PRIORITY_KEY = {
  low:    'tasks.priorityLow',
  medium: 'tasks.priorityMedium',
  high:   'tasks.priorityHigh',
}

export default function PriorityBadge({ priority = 'medium' }) {
  const { t } = useTranslation()
  const { Icon, rotate } = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium
  return (
    <span className={`tasks-badge priority-${priority}`}>
      <Icon size={12} style={rotate ? { transform: 'rotate(180deg)' } : undefined} />
      {t(PRIORITY_KEY[priority] || PRIORITY_KEY.medium)}
    </span>
  )
}
