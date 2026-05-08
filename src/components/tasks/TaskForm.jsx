import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, X } from 'lucide-react'
import { toDateInputValue } from '../../utils/taskUtils'

const EMPTY = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  deadline: '',
  assignedTo: [],
}

export default function TaskForm({ task, assignableMembers, onSubmit, onCancel, canEditAll, submitLabel }) {
  const { t } = useTranslation()
  const defaultSubmitLabel = submitLabel ?? t('tasks.create')
  const [form, setForm] = useState(() => task ? {
    title: task.title || '',
    description: task.description || '',
    status: task.status || 'todo',
    priority: task.priority || 'medium',
    deadline: toDateInputValue(task.deadline),
    assignedTo: task.assignedTo || [],
  } : EMPTY)
  const [memberSearch, setMemberSearch] = useState('')
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const searchRef = useRef(null)
  const assigneeRef = useRef(null)

  const filteredMembers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase()
    if (!term) return assignableMembers
    return assignableMembers.filter(m => `${m.name} ${m.email} ${m.role}`.toLowerCase().includes(term))
  }, [assignableMembers, memberSearch])

  function toggleAssignee(uid, closeAfter = false) {
    if (!canEditAll) return
    setForm(prev => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(uid)
        ? prev.assignedTo.filter(id => id !== uid)
        : [...prev.assignedTo, uid],
    }))
    if (closeAfter) setAssigneeOpen(false)
  }

  const selectedMembers = useMemo(
    () => assignableMembers.filter(m => form.assignedTo.includes(m.uid)),
    [assignableMembers, form.assignedTo],
  )

  function openAssigneeDropdown() {
    if (!canEditAll) return
    setAssigneeOpen(true)
    window.setTimeout(() => searchRef.current?.focus(), 0)
  }

  useEffect(() => {
    if (!assigneeOpen) return

    function onPointerDown(event) {
      if (assigneeRef.current?.contains(event.target)) return
      setAssigneeOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [assigneeOpen])

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const selected = assignableMembers.filter(m => form.assignedTo.includes(m.uid))
      await onSubmit({
        ...form,
        assignedToNames: selected.map(m => m.name),
      })
    } catch (err) {
      setErrors(err.errors || { global: 'common.error' })
      setSaving(false)
      return
    }
    setSaving(false)
  }

  return (
    <form className="task-form" onSubmit={submit}>
      {errors.global && <div className="task-form-error">{t(errors.global)}</div>}
      <div>
        <label>{t('tasks.title')} *</label>
        <input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} placeholder={t('tasks.titlePlaceholder')} />
        {errors.title && <small>{t(errors.title)}</small>}
      </div>
      <div>
        <label>{t('tasks.description')}</label>
        <textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={4} placeholder={t('tasks.descPlaceholder')} />
      </div>
      <div className="task-form-grid">
        <div>
          <label>{t('tasks.deadline')} *</label>
          <input type="date" value={form.deadline} onChange={e => setForm(prev => ({ ...prev, deadline: e.target.value }))} />
          {errors.deadline && <small>{t(errors.deadline)}</small>}
        </div>
        <div>
        <label>{t('tasks.priority')}</label>
          <select value={form.priority} onChange={e => setForm(prev => ({ ...prev, priority: e.target.value }))}>
            <option value="low">{t('tasks.priorityLow')}</option>
            <option value="medium">{t('tasks.priorityMedium')}</option>
            <option value="high">{t('tasks.priorityHigh')}</option>
          </select>
        </div>
      </div>
      <div>
        <label>{t('tasks.status')}</label>
        <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}>
          <option value="todo">{t('tasks.todo')}</option>
          <option value="in_progress">{t('tasks.inProgress')}</option>
          <option value="done">{t('tasks.done')}</option>
        </select>
      </div>
      <div>
        <label>{t('tasks.assignedTo')} *</label>
        {assignableMembers.length === 0 ? (
          <div className="task-empty-inline">{t('tasks.noTasks')}</div>
        ) : (
          <div className="task-assignee-dropdown" ref={assigneeRef}>
            <button
              type="button"
              className={`task-assignee-trigger${assigneeOpen ? ' open' : ''}`}
              onClick={openAssigneeDropdown}
              disabled={!canEditAll}
            >
              <span>
                {selectedMembers.length === 0
                  ? t('tasks.filterAll')
                  : `${selectedMembers.length} membre${selectedMembers.length > 1 ? 's' : ''} sélectionné${selectedMembers.length > 1 ? 's' : ''}`}
              </span>
              <ChevronDown size={16} />
            </button>

            {selectedMembers.length > 0 && (
              <div className="task-selected-assignees">
                {selectedMembers.map(member => (
                  <span key={member.uid}>
                    {member.name}
                    {canEditAll && (
                      <button type="button" onClick={() => toggleAssignee(member.uid)} aria-label={`Retirer ${member.name}`}>
                        <X size={12} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {assigneeOpen && (
              <div className="task-assignee-menu">
                <div className="task-assignee-search">
                  <input
                    ref={searchRef}
                    type="search"
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    placeholder={t('tasks.searchPlaceholder')}
                  />
                </div>
                <div className="task-assignee-options">
                  {filteredMembers.length === 0 ? (
                    <div className="task-assignee-empty">Aucun membre trouvé</div>
                  ) : filteredMembers.map(member => {
                    const selected = form.assignedTo.includes(member.uid)
                    return (
                      <button
                        key={member.uid}
                        type="button"
                        className={selected ? 'selected' : ''}
                        onClick={() => toggleAssignee(member.uid, true)}
                      >
                        <span>
                          {member.name}
                          <small>{member.role || member.email}</small>
                        </span>
                        {selected && <Check size={16} />}
                      </button>
                    )
                  })}
                </div>
                <div className="task-assignee-menu-actions">
                  <button type="button" onClick={() => setAssigneeOpen(false)}>{t('common.close')}</button>
                </div>
              </div>
            )}
            </div>
        )}
        {errors.assignedTo && <small>{t(errors.assignedTo)}</small>}
      </div>
      <div className="task-form-actions">
        <button type="button" className="secondary" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="submit" disabled={saving}>{saving ? t('common.saving') : defaultSubmitLabel}</button>
      </div>
    </form>
  )
}
