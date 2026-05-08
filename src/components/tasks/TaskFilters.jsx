import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, SlidersHorizontal } from 'lucide-react'

export default function TaskFilters({ filters, setFilters, assignableMembers, compact = false }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const detailsRef = useRef(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event) {
      if (detailsRef.current?.contains(event.target)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [open])

  const content = (
    <>
      <label className="task-search">
        <Search size={16} />
        <input
          type="search"
          placeholder={t('tasks.searchPlaceholder')}
          value={filters.search}
          onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
        />
      </label>
      <select value={filters.assignee} onChange={e => setFilters(prev => ({ ...prev, assignee: e.target.value }))}>
        <option value="all">{t('tasks.filterAll')}</option>
        {assignableMembers.map(m => <option key={m.uid} value={m.uid}>{m.name}</option>)}
      </select>
      <select value={filters.priority} onChange={e => setFilters(prev => ({ ...prev, priority: e.target.value }))}>
        <option value="all">{t('tasks.filterPriority')}</option>
        <option value="low">{t('tasks.priorityLow')}</option>
        <option value="medium">{t('tasks.priorityMedium')}</option>
        <option value="high">{t('tasks.priorityHigh')}</option>
      </select>
      <button
        type="button"
        className={filters.mine ? 'active' : ''}
        onClick={() => setFilters(prev => ({ ...prev, mine: !prev.mine }))}
      >
        {t('tasks.filterMine')}
      </button>
      <button
        type="button"
        className={filters.overdue ? 'active danger' : ''}
        onClick={() => setFilters(prev => ({ ...prev, overdue: !prev.overdue }))}
      >
        {t('tasks.filterOverdue')}
      </button>
    </>
  )

  if (compact) {
    return (
      <div className="task-filter-details" ref={detailsRef}>
        <button type="button" className="task-filter-summary" onClick={() => setOpen(prev => !prev)}>
          <SlidersHorizontal size={16} /> {t('common.search')}
        </button>
        {open && <div className="task-filters compact">{content}</div>}
      </div>
    )
  }

  return <div className="task-filters">{content}</div>
}
