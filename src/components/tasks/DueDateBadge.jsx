import { CheckCircle2, Clock } from 'lucide-react'
import { getDueDateStatus } from '../../utils/taskUtils'

export default function DueDateBadge({ deadline, status }) {
  const due = getDueDateStatus(deadline, status)
  return (
    <span className={`tasks-badge due-${due.color}`}>
      {status === 'done' ? <CheckCircle2 size={13} /> : <Clock size={13} />}
      {due.label}
    </span>
  )
}
