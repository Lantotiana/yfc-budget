import { CheckCircle2, Clock } from 'lucide-react'
import { getDueDateStatus } from '../../utils/taskUtils'
import { useTranslation } from 'react-i18next'

export default function DueDateBadge({ deadline, status }) {
  const { t } = useTranslation()
  const due = getDueDateStatus(deadline, status)
  const label = due.labelN !== undefined ? t(due.labelKey, { n: due.labelN }) : t(due.labelKey)
  return (
    <span className={`tasks-badge due-${due.color}`}>
      {status === 'done' ? <CheckCircle2 size={13} /> : <Clock size={13} />}
      {label}
    </span>
  )
}
