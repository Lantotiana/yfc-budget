import { Flag } from 'lucide-react'
import { TASK_PRIORITY_LABELS } from '../../utils/taskUtils'

export default function PriorityBadge({ priority = 'medium' }) {
  return (
    <span className={`tasks-badge priority-${priority}`}>
      <Flag size={13} />
      {TASK_PRIORITY_LABELS[priority] || TASK_PRIORITY_LABELS.medium}
    </span>
  )
}
