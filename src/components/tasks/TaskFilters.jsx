import { useEffect, useRef, useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { TASK_PRIORITY_LABELS } from '../../utils/taskUtils'

export default function TaskFilters({ filters, setFilters, assignableMembers, compact = false }) {
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
          placeholder="Rechercher une tâche..."
          value={filters.search}
          onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
        />
      </label>
      <select value={filters.assignee} onChange={e => setFilters(prev => ({ ...prev, assignee: e.target.value }))}>
        <option value="all">Tous les assignes</option>
        {assignableMembers.map(m => <option key={m.uid} value={m.uid}>{m.name}</option>)}
      </select>
      <select value={filters.priority} onChange={e => setFilters(prev => ({ ...prev, priority: e.target.value }))}>
        <option value="all">Toutes priorites</option>
        {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <button
        type="button"
        className={filters.mine ? 'active' : ''}
        onClick={() => setFilters(prev => ({ ...prev, mine: !prev.mine }))}
      >
        Mes tâches
      </button>
      <button
        type="button"
        className={filters.overdue ? 'active danger' : ''}
        onClick={() => setFilters(prev => ({ ...prev, overdue: !prev.overdue }))}
      >
        En retard
      </button>
    </>
  )

  if (compact) {
    return (
      <div className="task-filter-details" ref={detailsRef}>
        <button type="button" className="task-filter-summary" onClick={() => setOpen(prev => !prev)}>
          <SlidersHorizontal size={16} /> Filtrer
        </button>
        {open && <div className="task-filters compact">{content}</div>}
      </div>
    )
  }

  return <div className="task-filters">{content}</div>
}
