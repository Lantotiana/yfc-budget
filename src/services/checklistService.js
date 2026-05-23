import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'

const COLL = 'publicChecklistItems'

/**
 * Build a safe public representation of a task.
 * NEVER copies: private notes, financial data, emails, phone numbers,
 * full task history, or any confidential internal data.
 */
function taskToPublicItem(task, members = []) {
  const assignedUsersPublic = (task.assignedTo || []).map((uid, i) => {
    const member = members.find(m => m.uid === uid)
    return {
      uid,
      displayName: member?.name || (task.assignedToNames || [])[i] || 'Staff',
      photoURL: member?.photoURL || '',
    }
  })

  return {
    taskId: task.id,
    title: task.title || '',
    status: task.status || 'todo',
    checked: task.status === 'done',
    priority: task.priority || null,
    category: task.category || null,
    dueDate: task.deadline || null,
    assignedTo: task.assignedTo || [],
    assignedUsersPublic,
    // Description capped at 300 chars — no sensitive content
    publicDescription: task.description ? String(task.description).slice(0, 300) : '',
    sourceUpdatedAt: task.updatedAt || null,
    archived: task.archived === true,
  }
}

/**
 * Sync one task to publicChecklistItems.
 * Creates a new item if none exists for this taskId, otherwise updates it.
 * Fire-and-forget safe — errors are swallowed and logged.
 */
export async function syncTaskToChecklist(task, members = []) {
  if (!task?.id) return
  try {
    const snap = await getDocs(query(collection(db, COLL), where('taskId', '==', task.id)))
    const item = taskToPublicItem(task, members)

    if (snap.empty) {
      const all = await getDocs(collection(db, COLL))
      await addDoc(collection(db, COLL), {
        ...item,
        order: all.size,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } else {
      await updateDoc(snap.docs[0].ref, { ...item, updatedAt: serverTimestamp() })
    }
  } catch (e) {
    console.warn('[checklist] syncTaskToChecklist:', e?.code || e?.message)
  }
}

/**
 * Mark the checklist item archived when its source task is archived or deleted.
 */
export async function archiveChecklistItemByTaskId(taskId) {
  if (!taskId) return
  try {
    const snap = await getDocs(query(collection(db, COLL), where('taskId', '==', taskId)))
    await Promise.all(
      snap.docs.map(d => updateDoc(d.ref, { archived: true, updatedAt: serverTimestamp() }))
    )
  } catch (e) {
    console.warn('[checklist] archiveChecklistItemByTaskId:', e?.code || e?.message)
  }
}

/**
 * Toggle checked state and write the new status back to the source task.
 *   checked=true  → status 'done'
 *   checked=false → status 'todo'
 *   (previous status is lost at this point; 'todo' is the safe default)
 */
export async function toggleChecklistItem(itemId, checked, taskId) {
  const newStatus = checked ? 'done' : 'todo'
  await updateDoc(doc(db, COLL, itemId), {
    checked,
    status: newStatus,
    updatedAt: serverTimestamp(),
  })
  if (taskId) {
    await updateDoc(doc(db, 'tasks', taskId), {
      status: newStatus,
      updatedAt: serverTimestamp(),
      completedAt: checked ? serverTimestamp() : null,
    })
  }
}

/**
 * Persist display order after a drag-and-drop reorder.
 * items must be the full ordered array with .id fields.
 */
export async function updateChecklistOrder(items) {
  await Promise.all(
    items.map((item, i) =>
      updateDoc(doc(db, COLL, item.id), { order: i, updatedAt: serverTimestamp() })
    )
  )
}

/**
 * Subscribe to active (non-archived) checklist items.
 * Sorted client-side: first by order, fallback to createdAt.
 * Returns unsubscribe function.
 */
export function subscribeToChecklist(callback, onError) {
  const q = query(collection(db, COLL))
  return onSnapshot(
    q,
    snap => {
      const items = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(item => !item.archived)
        .sort((a, b) => {
          const ao = a.order ?? Number.MAX_SAFE_INTEGER
          const bo = b.order ?? Number.MAX_SAFE_INTEGER
          if (ao !== bo) return ao - bo
          return (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0)
        })
      callback(items)
    },
    err => {
      console.error('[checklist] subscribeToChecklist:', err)
      onError?.(err)
    }
  )
}

/**
 * Admin-only: sync ALL existing tasks to publicChecklistItems.
 * Idempotent — safe to run multiple times.
 * Skips archived tasks. Does not delete items whose source task no longer exists.
 */
export async function syncAllExistingTasksToChecklist(members = []) {
  const [tasksSnap, existingSnap] = await Promise.all([
    getDocs(collection(db, 'tasks')),
    getDocs(collection(db, COLL)),
  ])

  const existingByTaskId = Object.fromEntries(
    existingSnap.docs.map(d => [d.data().taskId, d])
  )

  let nextOrder = existingSnap.size
  const writes = []

  for (const taskDoc of tasksSnap.docs) {
    const task = { id: taskDoc.id, ...taskDoc.data() }
    const item = taskToPublicItem(task, members)
    const existing = existingByTaskId[task.id]

    if (existing) {
      writes.push(updateDoc(existing.ref, { ...item, updatedAt: serverTimestamp() }))
    } else if (!task.archived) {
      writes.push(
        addDoc(collection(db, COLL), {
          ...item,
          order: nextOrder++,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    }
  }

  await Promise.all(writes)
}
