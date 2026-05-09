import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, GripVertical, Plus, Trash2, X } from 'lucide-react'
import { toDateInputValue } from '../../utils/taskUtils'

const EMPTY = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  deadline: '',
  assignedTo: [],
  checklist: [],
}

function createChecklistItem() {
  return { id: `check_${Date.now()}_${Math.random().toString(16).slice(2)}`, text: '', done: false }
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
    checklist: Array.isArray(task.checklist) ? task.checklist : [],
  } : EMPTY)
  const [memberSearch, setMemberSearch] = useState('')
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [planningMenu, setPlanningMenu] = useState('')
  const [draggedChecklistId, setDraggedChecklistId] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const searchRef = useRef(null)
  const assigneeRef = useRef(null)
  const dateRef = useRef(null)
  const planningRef = useRef(null)

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

  function addChecklistItem() {
    setForm(prev => ({ ...prev, checklist: [...(prev.checklist || []), createChecklistItem()] }))
  }

  function updateChecklistItem(id, patch) {
    setForm(prev => ({
      ...prev,
      checklist: (prev.checklist || []).map(item => item.id === id ? { ...item, ...patch } : item),
    }))
  }

  function removeChecklistItem(id) {
    setForm(prev => ({
      ...prev,
      checklist: (prev.checklist || []).filter(item => item.id !== id),
    }))
  }

  function moveChecklistItem(targetId) {
    if (!draggedChecklistId || draggedChecklistId === targetId) return
    setForm(prev => {
      const items = [...(prev.checklist || [])]
      const from = items.findIndex(item => item.id === draggedChecklistId)
      const to = items.findIndex(item => item.id === targetId)
      if (from < 0 || to < 0) return prev
      const [moved] = items.splice(from, 1)
      items.splice(to, 0, moved)
      return { ...prev, checklist: items }
    })
  }

  const selectedMembers = useMemo(
    () => assignableMembers.filter(m => form.assignedTo.includes(m.uid)),
    [assignableMembers, form.assignedTo],
  )

  function openAssigneeDropdown() {
    if (!canEditAll) return
    if (assigneeOpen) {
      setAssigneeOpen(false)
      return
    }
    setAssigneeOpen(true)
    window.setTimeout(() => searchRef.current?.focus(), 0)
  }

  function openDatePicker() {
    const input = dateRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') input.showPicker()
    else input.focus()
  }

  const deadlineLabel = form.deadline
    ? new Date(`${form.deadline}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : t('tasks.deadlineRequired')

  const priorityLabel = {
    low: t('tasks.priorityLow'),
    medium: t('tasks.priorityMedium'),
    high: t('tasks.priorityHigh'),
  }[form.priority] || t('tasks.priorityMedium')

  const statusLabel = {
    todo: t('tasks.todo'),
    in_progress: t('tasks.inProgress'),
    done: t('tasks.done'),
  }[form.status] || t('tasks.todo')

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

  useEffect(() => {
    if (!planningMenu) return

    function onPointerDown(event) {
      if (planningRef.current?.contains(event.target)) return
      setPlanningMenu('')
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [planningMenu])

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const selected = assignableMembers.filter(m => form.assignedTo.includes(m.uid))
      await onSubmit({
        ...form,
        checklist: (form.checklist || []).filter(item => item.text.trim()),
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
      <div className="dialog-content task-form-fields">
        {errors.global && <div className="task-form-error">{t(errors.global)}</div>}
        <div>
        <label className="form-label">{t('tasks.fieldTitle')} *</label>
        <input className="form-input" value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} placeholder={t('tasks.titlePlaceholder')} />
        {errors.title && <small>{t(errors.title)}</small>}
      </div>
      <div>
        <label className="form-label">{t('tasks.description')}</label>
        <textarea className="form-input" value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={4} placeholder={t('tasks.descPlaceholder')} />
      </div>
      <div>
        <label className="form-label">Planning</label>
        <div className="task-planning-chips" ref={planningRef}>
          <button type="button" className="due-neutral" onClick={openDatePicker}>{deadlineLabel}</button>
          <button type="button" className={`status-${form.status}`} onClick={() => setPlanningMenu(planningMenu === 'status' ? '' : 'status')}>{statusLabel}</button>
          <button type="button" className={`priority-${form.priority}`} onClick={() => setPlanningMenu(planningMenu === 'priority' ? '' : 'priority')}>{priorityLabel}</button>
          <input
            ref={dateRef}
            className="task-planning-native-date"
            type="date"
            value={form.deadline}
            onChange={e => setForm(prev => ({ ...prev, deadline: e.target.value }))}
            tabIndex={-1}
            aria-hidden="true"
          />
          {errors.deadline && <small>{t(errors.deadline)}</small>}
          {planningMenu === 'status' && (
            <div className="task-planning-menu">
              {[
                ['todo', t('tasks.todo')],
                ['in_progress', t('tasks.inProgress')],
                ['done', t('tasks.done')],
              ].map(([value, label]) => (
                <button key={value} type="button" className={form.status === value ? 'selected' : ''} onClick={() => {
                  setForm(prev => ({ ...prev, status: value }))
                  setPlanningMenu('')
                }}>
                  <span>{label}</span>
                  {form.status === value && <Check size={16} />}
                </button>
              ))}
            </div>
          )}
          {planningMenu === 'priority' && (
            <div className="task-planning-menu">
              {[
                ['low', t('tasks.priorityLow')],
                ['medium', t('tasks.priorityMedium')],
                ['high', t('tasks.priorityHigh')],
              ].map(([value, label]) => (
                <button key={value} type="button" className={form.priority === value ? 'selected' : ''} onClick={() => {
                  setForm(prev => ({ ...prev, priority: value }))
                  setPlanningMenu('')
                }}>
                  <span>{label}</span>
                  {form.priority === value && <Check size={16} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div>
        <label className="form-label">{t('tasks.assignedTo')} *</label>
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
                    placeholder="Rechercher un membre..."
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
              </div>
            )}
            </div>
        )}
        {errors.assignedTo && <small>{t(errors.assignedTo)}</small>}
      </div>
      <div>
        {(form.checklist || []).length === 0 ? (
          <button type="button" className="task-checklist-create" onClick={addChecklistItem}>
            <Plus size={16} /> Ajouter checklist
          </button>
        ) : (
          <>
            <div className="task-checklist-head">
              <label className="form-label">Checklist</label>
              <button type="button" className="task-checklist-add" onClick={addChecklistItem} aria-label="Ajouter un element">
                <Plus size={16} />
              </button>
            </div>
          <div className="task-checklist-editor">
            {form.checklist.map(item => (
              <div
                key={item.id}
                className={`task-checklist-row${item.done ? ' done' : ''}${draggedChecklistId === item.id ? ' dragging' : ''}`}
                draggable
                onClick={() => updateChecklistItem(item.id, { done: !item.done })}
                onDragStart={() => setDraggedChecklistId(item.id)}
                onDragEnter={() => moveChecklistItem(item.id)}
                onDragOver={e => e.preventDefault()}
                onDragEnd={() => setDraggedChecklistId('')}
              >
                <span className="task-checklist-check" aria-hidden="true">
                  {item.done && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7L5.5 10L11.5 4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
                <input
                  className="form-input"
                  value={item.text}
                  onClick={e => e.stopPropagation()}
                  onChange={e => updateChecklistItem(item.id, { text: e.target.value })}
                  placeholder="Ajouter une tache"
                />
                <button type="button" onClick={e => { e.stopPropagation(); removeChecklistItem(item.id) }} aria-label="Retirer cet element">
                  <Trash2 size={14} />
                </button>
                <span className="task-checklist-grip" aria-hidden="true"><GripVertical size={15} /></span>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
      </div>
      <div className="dialog-footer">
        <button type="button" className="btn-secondary materiel-footer-btn" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="submit" className="materiel-primary-btn" disabled={saving}>{saving ? t('common.saving') : defaultSubmitLabel}</button>
      </div>
    </form>
  )
}
