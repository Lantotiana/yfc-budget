import { useEffect, useMemo, useState } from 'react'
import { Calendar, Check, CheckSquare, GripVertical, Pencil, Plus, RefreshCw, X } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useTheme } from '../context/ThemeContext'
import Portal from '../components/Portal'
import LoadingState from '../components/LoadingState'
import TaskForm from '../components/tasks/TaskForm'
import TaskModal from '../components/tasks/TaskModal'
import useTasks from '../hooks/useTasks'
import { ADMIN_EMAIL } from '../constants'
import {
  canManageTasks,
  getDueDateStatus,
  initials,
  toDate,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
} from '../utils/taskUtils'
import {
  subscribeToChecklist,
  syncAllExistingTasksToChecklist,
  toggleChecklistItem,
  updateChecklistOrder,
} from '../services/checklistService'

const FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'todo', label: 'À faire' },
  { key: 'in_progress', label: 'En cours' },
  { key: 'done', label: 'Terminé' },
]

const EVENT_DATE = new Date(2026, 4, 30, 10, 30, 0) // 30 mai 2026 10h30

function useCountdown(target) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const diff = Math.max(0, target - now)
  const totalSecs = Math.floor(diff / 1000)
  return {
    done: diff === 0,
    days:    Math.floor(totalSecs / 86400),
    hours:   Math.floor((totalSecs % 86400) / 3600),
    minutes: Math.floor((totalSecs % 3600) / 60),
    seconds: totalSecs % 60,
  }
}

/* ─── EventCountdown ──────────────────────────────────────────── */
function EventCountdown() {
  const { C } = useTheme()
  const { done, days, hours, minutes, seconds } = useCountdown(EVENT_DATE)
  const pad = n => String(n).padStart(2, '0')

  if (done) return (
    <div style={{ textAlign: 'center', padding: '28px 20px' }}>
      <span style={{ fontSize: 'var(--font-lg)', fontWeight: 800, color: C.teal }}>Bonne fête ! 🎉</span>
    </div>
  )

  const units = [
    { value: pad(days),    label: 'J' },
    { value: pad(hours),   label: 'H' },
    { value: pad(minutes), label: 'M' },
    { value: pad(seconds), label: 'S' },
  ]

  return (
    <div style={{ textAlign: 'center', padding: '28px 20px 0' }}>
      <p style={{
        margin: '0 0 14px', fontSize: 11, fontWeight: 700,
        color: C.t3, letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>
        10ème Anniversaire YFC
      </p>

      {/* Digits */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0 }}>
        {units.map((u, i) => (
          <div key={u.label} style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 52 }}>
              <span style={{
                fontSize: 40, fontWeight: 800, color: C.t1, lineHeight: 1,
                fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
              }}>
                {u.value}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.t3, marginTop: 5, letterSpacing: '0.08em' }}>
                {u.label}
              </span>
            </div>
            {i < 3 && (
              <span style={{
                fontSize: 32, fontWeight: 800, color: C.teal,
                lineHeight: 1, marginTop: 1, padding: '0 1px', alignSelf: 'flex-start',
              }}>
                :
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Summary text */}
      <p style={{ margin: '14px 0 0', fontSize: 'var(--font-sm)', color: C.t2, fontWeight: 600 }}>
        {days} jour{days !== 1 ? 's' : ''} {hours} heure{hours !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

const MAX_AVATARS = 3

/* ─── AvatarStack ─────────────────────────────────────────────── */
function AvatarStack({ users, C }) {
  if (!users?.length) return null
  const visible = users.slice(0, MAX_AVATARS)
  const overflow = users.length - MAX_AVATARS
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((u, idx) => (
        <div
          key={u.uid}
          title={u.displayName}
          style={{
            width: 20, height: 20, borderRadius: '50%',
            border: `1.5px solid ${C.surf}`,
            marginLeft: idx === 0 ? 0 : -6,
            flexShrink: 0, overflow: 'hidden',
            background: C.tealD,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', zIndex: visible.length - idx,
          }}
        >
          {u.photoURL
            ? <img src={u.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 7, fontWeight: 800, color: C.teal, lineHeight: 1 }}>{initials(u.displayName)}</span>
          }
        </div>
      ))}
      {overflow > 0 && (
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          border: `1.5px solid ${C.surf}`,
          marginLeft: -6, flexShrink: 0,
          background: C.bord2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 7, fontWeight: 800, color: C.t3,
          position: 'relative', zIndex: 0,
        }}>
          +{overflow}
        </div>
      )}
    </div>
  )
}

/* ─── DueDateChip ─────────────────────────────────────────────── */
function DueDateChip({ dueDate }) {
  const { C } = useTheme()
  const date = toDate(dueDate)
  if (!date) return null
  const due = getDueDateStatus(dueDate, 'todo')
  const colorMap = {
    red:     { fg: C.coral,  bg: C.coralD },
    orange:  { fg: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    green:   { fg: C.teal,   bg: C.tealD },
    neutral: null,
  }
  const colors = colorMap[due.color]
  if (!colors) return null
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
      background: colors.bg, color: colors.fg, whiteSpace: 'nowrap',
    }}>
      {date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
    </span>
  )
}

/* ─── ChecklistRow ───────────────────────────────────────────── */
function ChecklistRow({
  item, canEdit, onToggle, onOpen,
  nodeRef, dragStyle, dragAttributes, dragListeners, isDragging,
}) {
  const { C } = useTheme()
  const isDone = item.status === 'done'

  return (
    <div
      ref={nodeRef}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 12px', borderRadius: 12,
        background: isDone ? C.surf : C.surf2,
        border: `1px solid ${C.bord}`,
        opacity: isDragging ? 0.45 : isDone ? 0.62 : 1,
        cursor: 'pointer',
        transition: isDragging ? 'none' : 'opacity 0.15s',
        userSelect: 'none',
        ...dragStyle,
      }}
      onClick={() => onOpen(item)}
      {...dragAttributes}
    >
      {/* Drag handle */}
      {canEdit && dragListeners ? (
        <div
          {...dragListeners}
          onClick={e => e.stopPropagation()}
          style={{
            color: C.t3, cursor: 'grab', flexShrink: 0,
            display: 'flex', alignItems: 'center', touchAction: 'none', padding: '2px 0',
          }}
        >
          <GripVertical size={15} />
        </div>
      ) : (
        canEdit && <div style={{ width: 15, flexShrink: 0 }} />
      )}

      {/* Checkbox */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); if (canEdit) onToggle(item) }}
        disabled={!canEdit}
        aria-label={isDone ? 'Décocher' : 'Cocher'}
        style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          border: `2px solid ${isDone ? C.teal : C.bord2}`,
          background: isDone ? C.teal : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: canEdit ? 'pointer' : 'default',
          transition: 'all 0.15s', padding: 0,
        }}
      >
        {isDone && <Check size={13} color="#fff" strokeWidth={3} />}
      </button>

      {/* Title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 'var(--font-sm)', fontWeight: 600,
          color: isDone ? C.t3 : C.t1,
          textDecoration: isDone ? 'line-through' : 'none',
          display: 'block', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.title}
        </span>
      </div>

      {/* Right side: avatars + priority + due date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <AvatarStack users={item.assignedUsersPublic} C={C} />
        {item.priority === 'high' && (
          <span className="tasks-badge priority-high" style={{ fontSize: 10, padding: '2px 7px' }}>
            {TASK_PRIORITY_LABELS.high}
          </span>
        )}
        {item.dueDate && !isDone && <DueDateChip dueDate={item.dueDate} />}
      </div>
    </div>
  )
}

/* ─── SortableItem ───────────────────────────────────────────── */
function SortableItem(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.item.id })
  return (
    <ChecklistRow
      {...props}
      nodeRef={setNodeRef}
      dragStyle={{ transform: CSS.Transform.toString(transform), transition }}
      dragAttributes={attributes}
      dragListeners={listeners}
      isDragging={isDragging}
    />
  )
}

/* ─── DetailModal ─────────────────────────────────────────────── */
function DetailModal({ item, canEdit, onClose, onEdit }) {
  const { C } = useTheme()
  if (!item) return null

  const dueDate = toDate(item.dueDate)

  return (
    <Portal>
      <div className="bottom-sheet-overlay" onClick={onClose}>
        <div
          className="bottom-sheet"
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: 520, margin: '0 auto', padding: '8px 20px 36px' }}
        >
          <div className="bottom-sheet-handle" />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, marginTop: 8 }}>
            <h2 style={{ flex: 1, margin: 0, fontWeight: 700, fontSize: 'var(--font-base)', color: C.t1, lineHeight: 1.3 }}>
              {item.title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.t3, padding: 2, flexShrink: 0 }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Status + priority */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            <span className={`tasks-badge status-${item.status}`}>
              {TASK_STATUS_LABELS[item.status] || item.status}
            </span>
            {item.priority && (
              <span className={`tasks-badge priority-${item.priority}`}>
                {TASK_PRIORITY_LABELS[item.priority] || item.priority}
              </span>
            )}
          </div>

          {/* Due date */}
          {dueDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Calendar size={15} color={C.t3} />
              <span style={{ fontSize: 'var(--font-sm)', color: C.t2 }}>
                {dueDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          )}

          {/* Assignees */}
          {item.assignedUsersPublic?.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {item.assignedUsersPublic.map(u => (
                  <div key={u.uid} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {u.photoURL ? (
                      <img src={u.photoURL} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', background: C.tealD,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: C.teal,
                      }}>
                        {initials(u.displayName)}
                      </div>
                    )}
                    <span style={{ fontSize: 'var(--font-sm)', color: C.t2 }}>{u.displayName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {item.publicDescription && (
            <p style={{ fontSize: 'var(--font-sm)', color: C.t2, lineHeight: 1.6, margin: '0 0 14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {item.publicDescription}
            </p>
          )}

          {/* Updated at */}
          {item.sourceUpdatedAt && (
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 16 }}>
              Mis à jour le {toDate(item.sourceUpdatedAt)?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}

          {/* Actions */}
          {canEdit && item.taskId && (
            <button
              type="button"
              onClick={() => onEdit(item)}
              style={{
                width: '100%', padding: '12px', borderRadius: 12,
                border: 'none', background: C.teal,
                color: '#fff', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 'var(--font-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Pencil size={14} />
              Modifier
            </button>
          )}
        </div>
      </div>
    </Portal>
  )
}

/* ─── CreateSheet ─────────────────────────────────────────────── */
function CreateSheet({ user, userData, assignableMembers, onClose, onCreate }) {
  const { C } = useTheme()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(payload) {
    setSaving(true)
    try {
      await onCreate(payload)
      onClose()
    } catch (e) {
      console.error('[checklist] createTask:', e)
    }
    setSaving(false)
  }

  return (
    <Portal>
      <div className="bottom-sheet-overlay" onClick={onClose}>
        <div
          className="bottom-sheet materiel-form-sheet task-create-sheet"
          onClick={e => e.stopPropagation()}
        >
          <div className="bottom-sheet-handle" />
          <h2 className="dialog-title" style={{ marginBottom: 16 }}>Nouvelle tâche</h2>
          <TaskForm
            task={null}
            assignableMembers={assignableMembers}
            canEditAll
            submitLabel={saving ? 'Enregistrement…' : 'Créer'}
            onSubmit={handleSubmit}
            onCancel={onClose}
          />
        </div>
      </div>
    </Portal>
  )
}

/* ─── GeneralChecklist (main page) ───────────────────────────── */
export default function GeneralChecklist({ user, userData }) {
  const { C } = useTheme()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [editTask, setEditTask] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const { createTask, updateTask, archiveTask, deleteTask, assignableMembers } = useTasks({ user, userData })
  const currentMember = assignableMembers.find(m => m.uid === user?.uid) || null

  const canEdit = canManageTasks(user, userData)
  const isAdmin = user?.email === ADMIN_EMAIL
  const canDrag = canEdit && filter === 'all' && !search.trim()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    const unsub = subscribeToChecklist(
      newItems => { setItems(newItems); setLoading(false) },
      () => { setError('Impossible de charger la checklist.'); setLoading(false) }
    )
    return unsub
  }, [])

  const filteredItems = useMemo(() => {
    let result = items
    if (filter !== 'all') result = result.filter(i => i.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(i => i.title.toLowerCase().includes(q))
    }
    // Enrich assignedUsersPublic with live photoURLs from assignableMembers
    // (Firestore may have stale/empty photoURL if sync ran before members loaded)
    if (assignableMembers.length > 0) {
      result = result.map(item => ({
        ...item,
        assignedUsersPublic: (item.assignedUsersPublic || []).map(u => {
          const live = assignableMembers.find(m => m.uid === u.uid)
          return live?.photoURL ? { ...u, photoURL: live.photoURL } : u
        }),
      }))
    }
    return result
  }, [items, filter, search, assignableMembers])

  function handleDragEnd({ active, over }) {
    if (!active || !over || active.id === over.id) return
    setItems(current => {
      const oldIndex = current.findIndex(i => i.id === active.id)
      const newIndex = current.findIndex(i => i.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return current
      const reordered = arrayMove(current, oldIndex, newIndex)
      updateChecklistOrder(reordered).catch(() => {})
      return reordered
    })
  }

  async function handleToggle(item) {
    if (!canEdit) return
    const newChecked = !item.checked
    setItems(current =>
      current.map(i =>
        i.id === item.id
          ? { ...i, checked: newChecked, status: newChecked ? 'done' : 'todo' }
          : i
      )
    )
    try {
      await toggleChecklistItem(item.id, newChecked, item.taskId)
    } catch {
      setItems(current =>
        current.map(i => i.id === item.id ? { ...i, checked: item.checked, status: item.status } : i)
      )
    }
  }

  async function handleEdit(item) {
    setSelectedItem(null)
    try {
      const snap = await getDoc(doc(db, 'tasks', item.taskId))
      if (snap.exists()) setEditTask({ id: snap.id, ...snap.data() })
    } catch (e) {
      console.error('[checklist] handleEdit:', e)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      await syncAllExistingTasksToChecklist()
    } catch (e) {
      console.error('[checklist] sync all:', e)
    }
    setSyncing(false)
  }

  const doneCount = items.filter(i => i.status === 'done').length
  const totalCount = items.length

  return (
    <div style={{ paddingBottom: 100 }}>

      {/* Page header */}
      <div style={{ padding: '22px 20px 0', marginBottom: 4 }}>
        <h1 style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 800, color: C.t1 }}>
          Checklist générale
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--font-sm)', color: C.t3 }}>
          {doneCount}/{totalCount} {totalCount === 1 ? 'tâche terminée' : 'tâches terminées'}
        </p>
      </div>

      {/* Event countdown */}
      <EventCountdown />

      {/* Progress bar */}
      {totalCount > 0 && (
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{ height: 5, borderRadius: 999, background: C.bord, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 999, background: C.teal,
              width: `${Math.round((doneCount / totalCount) * 100)}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ padding: '14px 16px 0' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une tâche..."
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 12,
            border: `1.5px solid ${C.bord2}`, background: C.surf2, color: C.t1,
            fontFamily: 'inherit', fontSize: 'var(--font-sm)', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Filter tabs */}
      <div style={{ padding: '10px 16px 0', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {FILTERS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            style={{
              flexShrink: 0, padding: '6px 13px', borderRadius: 999, cursor: 'pointer',
              border: `1.5px solid ${filter === tab.key ? C.teal : C.bord}`,
              background: filter === tab.key ? C.tealD : 'transparent',
              color: filter === tab.key ? C.teal : C.t3,
              fontWeight: 600, fontSize: 12, fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Admin sync */}
      {isAdmin && (
        <div style={{ padding: '10px 16px 0' }}>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 13px', borderRadius: 10,
              border: `1px dashed ${C.bord2}`, background: 'transparent',
              color: C.t3, fontSize: 12, cursor: syncing ? 'default' : 'pointer',
              fontFamily: 'inherit', opacity: syncing ? 0.6 : 1,
            }}
          >
            <RefreshCw size={12} />
            {syncing ? 'Synchronisation…' : 'Sync toutes les tâches'}
          </button>
        </div>
      )}

      {/* Drag hint */}
      {canEdit && filter !== 'all' && (
        <div style={{ padding: '8px 16px 0' }}>
          <span style={{ fontSize: 11, color: C.t3 }}>
            Sélectionne "Tous" pour réordonner
          </span>
        </div>
      )}

      {/* List */}
      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loading ? (
          <LoadingState label="Chargement de la checklist…" />
        ) : error ? (
          <div style={{ textAlign: 'center', color: C.coral, padding: '32px 0', fontSize: 'var(--font-sm)' }}>
            {error}
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.t3 }}>
            <CheckSquare size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: 'var(--font-sm)' }}>
              {search
                ? 'Aucune tâche ne correspond à votre recherche'
                : filter !== 'all'
                  ? `Aucune tâche "${FILTERS.find(f => f.key === filter)?.label}"`
                  : 'Aucune tâche dans la checklist'}
            </p>
            {isAdmin && !search && filter === 'all' && (
              <p style={{ margin: '8px 0 0', fontSize: 11, color: C.t3 }}>
                Utilise "Sync toutes les tâches" pour importer les tâches existantes
              </p>
            )}
          </div>
        ) : canDrag ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
              {filteredItems.map(item => (
                <SortableItem
                  key={item.id}
                  item={item}
                  canEdit={canEdit}
                  onToggle={handleToggle}
                  onOpen={setSelectedItem}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          filteredItems.map(item => (
            <ChecklistRow
              key={item.id}
              item={item}
              canEdit={canEdit}
              onToggle={handleToggle}
              onOpen={setSelectedItem}
            />
          ))
        )}
      </div>

      {/* FAB — create task */}
      {canEdit && (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          aria-label="Ajouter une tâche"
          style={{
            position: 'fixed', bottom: 28, right: 20,
            width: 52, height: 52, borderRadius: '50%',
            background: C.teal, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            cursor: 'pointer', zIndex: 50,
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.07)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(0,0,0,0.24)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)' }}
        >
          <Plus size={24} color="#fff" strokeWidth={2.5} />
        </button>
      )}

      {/* Detail modal */}
      {selectedItem && (
        <DetailModal
          item={selectedItem}
          canEdit={canEdit}
          onClose={() => setSelectedItem(null)}
          onEdit={handleEdit}
        />
      )}

      {/* Create task sheet */}
      {showCreate && (
        <CreateSheet
          user={user}
          userData={userData}
          assignableMembers={assignableMembers}
          onClose={() => setShowCreate(false)}
          onCreate={createTask}
        />
      )}

      {/* Edit task modal */}
      {editTask && (
        <TaskModal
          task={editTask}
          user={user}
          userData={userData}
          currentMember={currentMember}
          assignableMembers={assignableMembers}
          onClose={() => setEditTask(null)}
          onUpdate={(taskId, payload, prev) => updateTask(taskId, payload, prev)}
          onDelete={() => { deleteTask(editTask); setEditTask(null) }}
        />
      )}
    </div>
  )
}
