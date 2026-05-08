import { Flag } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const PRIORITY_KEY = { low: 'tasks.priorityLow', medium: 'tasks.priorityMedium', high: 'tasks.priorityHigh' }

export default function PriorityBadge({ priority = 'medium' }) {
  const { t } = useTranslation()
  return (
    <span className={`tasks-badge priority-${priority}`}>
      <Flag size={13} />
      {t(PRIORITY_KEY[priority] || PRIORITY_KEY.medium)}
    </span>
  )
}
