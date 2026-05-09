import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { createNotification } from '../notifications'
import {
  getDisplayMemberName,
  getDueDateStatus,
  TASK_COLUMNS,
  validateTaskPayload,
} from '../utils/taskUtils'
import { normalizeAccessText, sameEmail } from '../utils/access'

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function normalizeTaskPayload(payload) {
  const deadline = payload.deadline instanceof Date
    ? payload.deadline
    : new Date(`${payload.deadline}T12:00:00`)
  const checklist = Array.isArray(payload.checklist)
    ? payload.checklist
      .map((item, index) => ({
        id: item.id || `item_${index}_${Date.now()}`,
        text: String(item.text || '').trim(),
        done: item.done === true,
      }))
      .filter(item => item.text)
    : []

  return {
    title: payload.title.trim(),
    description: payload.description?.trim() || '',
    status: payload.status || 'todo',
    priority: payload.priority || 'medium',
    deadline,
    assignedTo: payload.assignedTo || [],
    assignedToNames: payload.assignedToNames || [],
    checklist,
  }
}

function getActorName(user, userData) {
  return userData?.nom || userData?.displayName || user?.displayName || user?.email || 'Staff YFC'
}

async function notifyTaskAssignment({ taskId, taskTitle, assignedTo, assignableMembers }) {
  const assignedMembers = assignedTo
    .map(uid => assignableMembers.find(m => m.uid === uid))
    .filter(Boolean)
  const assignedNames = assignedMembers.map(member => member.name)

  await Promise.all(assignedMembers.map(member => createNotification({
    type: 'task',
    titre: "Une tâche est assignée à toi",
    detail: taskTitle,
    cible: member.name || '',
    route: `/tasks?task=${taskId}`,
    targetUserId: member.uid,
    targetUserEmail: member.email || null,
    metadata: { taskId },
  })))

  if (assignedNames.length > 0) {
    await createNotification({
      type: 'task',
      titre: `Tâche assignée à ${assignedNames.join(', ')}`,
      detail: taskTitle,
      cible: assignedNames.join(', '),
      route: `/tasks?task=${taskId}`,
      metadata: { taskId },
    })
  }
}

export default function useTasks({ user, userData } = {}) {
  const [tasks, setTasks] = useState([])
  const [assignableMembers, setAssignableMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(true)
  const [error, setError] = useState('')
  const [membersError, setMembersError] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('deadline', 'asc'))
    return onSnapshot(q, snap => {
      setTasks(snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(task => task.archived !== true))
      setLoading(false)
      setError('')
    }, err => {
      console.error(err)
      setError("Impossible de charger les tâches.")
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    let users = []
    let membres = []
    let usersReady = false
    let membresReady = false

    function buildAssignable() {
      if (!usersReady || !membresReady) return
      const next = users
        .filter(u => u.approuve === true)
        .map(u => {
          const email = normalizeEmail(u.email)
          const member = membres.find(m => sameEmail(m.email, email)) || {}
          return {
            uid: u.id,
            email,
            role: member.staffRole || u.staffRole || u.role || '',
            isStaff: member.staff === true || Boolean(member.staffRole) || normalizeAccessText(u.role || u.staffRole),
            name: getDisplayMemberName(u, member),
            photoURL: member.photoURL || u.photoURL || '',
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      setAssignableMembers(next)
      setMembersLoading(false)
      setMembersError('')
    }

    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      users = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      usersReady = true
      buildAssignable()
    }, err => {
      console.error(err)
      setMembersError("Impossible de charger les utilisateurs autorises.")
      setMembersLoading(false)
    })

    const unsubMembres = onSnapshot(collection(db, 'membres'), snap => {
      membres = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      membresReady = true
      buildAssignable()
    }, err => {
      console.error(err)
      setMembersError("Impossible de charger les membres.")
      setMembersLoading(false)
    })

    return () => {
      unsubUsers()
      unsubMembres()
    }
  }, [])

  const tasksByStatus = useMemo(() => TASK_COLUMNS.reduce((acc, col) => {
    acc[col.key] = tasks.filter(task => task.status === col.key)
    return acc
  }, {}), [tasks])

  const counters = useMemo(() => {
    const mine = tasks.filter(task => task.assignedTo?.includes(user?.uid)).length
    const overdue = tasks.filter(task => getDueDateStatus(task.deadline, task.status).isOverdue).length
    return {
      total: tasks.length,
      todo: tasksByStatus.todo?.length || 0,
      in_progress: tasksByStatus.in_progress?.length || 0,
      done: tasksByStatus.done?.length || 0,
      mine,
      overdue,
      dueSoon: tasks.filter(task => {
        const due = getDueDateStatus(task.deadline, task.status)
        return task.status !== 'done' && (due.color === 'orange' || due.color === 'red')
      }).length,
    }
  }, [tasks, tasksByStatus, user?.uid])

  const getTasksByStatus = useCallback(status => tasksByStatus[status] || [], [tasksByStatus])

  const createTask = useCallback(async payload => {
    const normalized = normalizeTaskPayload(payload)
    const errors = validateTaskPayload(normalized)
    if (Object.keys(errors).length) throw Object.assign(new Error('Validation task'), { errors })

    const ref = await addDoc(collection(db, 'tasks'), {
      ...normalized,
      deadline: Timestamp.fromDate(normalized.deadline),
      createdBy: user?.uid || '',
      createdByName: getActorName(user, userData),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      completedAt: normalized.status === 'done' ? serverTimestamp() : null,
      archived: false,
    })

    await notifyTaskAssignment({
      taskId: ref.id,
      taskTitle: normalized.title,
      assignedTo: normalized.assignedTo,
      assignableMembers,
    })

    return ref.id
  }, [assignableMembers, user, userData])

  const updateTask = useCallback(async (taskId, payload, previousTask = null) => {
    const normalized = normalizeTaskPayload(payload)
    const errors = validateTaskPayload(normalized)
    if (Object.keys(errors).length) throw Object.assign(new Error('Validation task'), { errors })

    const next = {
      ...normalized,
      deadline: Timestamp.fromDate(normalized.deadline),
      updatedAt: serverTimestamp(),
      completedAt: normalized.status === 'done'
        ? (previousTask?.status === 'done' ? previousTask.completedAt || serverTimestamp() : serverTimestamp())
        : null,
    }

    await updateDoc(doc(db, 'tasks', taskId), next)
    const previousAssigned = new Set(previousTask?.assignedTo || [])
    const newlyAssigned = normalized.assignedTo.filter(uid => !previousAssigned.has(uid))

    if (newlyAssigned.length > 0) {
      await notifyTaskAssignment({
        taskId,
        taskTitle: normalized.title,
        assignedTo: newlyAssigned,
        assignableMembers,
      })
    } else {
      await Promise.all(normalized.assignedTo.map(uid => {
        const member = assignableMembers.find(m => m.uid === uid)
        return createNotification({
          type: 'task',
          titre: 'Tâche modifiée',
          detail: normalized.title,
          cible: member?.name || '',
          route: `/tasks?task=${taskId}`,
          targetUserId: uid,
          targetUserEmail: member?.email || null,
          metadata: { taskId },
        })
      }))
    }
  }, [assignableMembers])

  const updateTaskStatus = useCallback(async (task, status) => {
    await updateDoc(doc(db, 'tasks', task.id), {
      status,
      updatedAt: serverTimestamp(),
      completedAt: status === 'done' ? serverTimestamp() : null,
    })
    if (status === 'done') {
      await createNotification({
        type: 'task',
        titre: 'Tâche terminée',
        detail: task.title,
        cible: task.createdByName || '',
        route: `/tasks?task=${task.id}`,
        targetUserId: task.createdBy || null,
        metadata: { taskId: task.id },
      })
    }
  }, [])

  const archiveTask = useCallback(async task => {
    await updateDoc(doc(db, 'tasks', task.id), {
      archived: true,
      updatedAt: serverTimestamp(),
    })
  }, [])

  return {
    tasks,
    tasksByStatus,
    counters,
    assignableMembers,
    loading,
    membersLoading,
    error,
    membersError,
    createTask,
    updateTask,
    updateTaskStatus,
    archiveTask,
    getTasksByStatus,
  }
}
