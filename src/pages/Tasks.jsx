import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { Plus } from 'lucide-react'
import { db } from '../firebase'
import TaskBoard from '../components/tasks/TaskBoard'
import useTasks from '../hooks/useTasks'
import { useDesktopToolbar } from '../context/DesktopToolbarContext'
import { sameEmail } from '../utils/access'
import { canCreateTasks } from '../utils/taskUtils'

export default function Tasks({ user, userData }) {
  const taskState = useTasks({ user, userData })
  const { setToolbar } = useDesktopToolbar()
  const [members, setMembers] = useState([])
  const currentMember = useMemo(() => members.find(m => sameEmail(m.email, user?.email)), [members, user?.email])
  const canCreate = canCreateTasks(user)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'membres'), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, () => setMembers([]))
    return () => unsub()
  }, [])

  const desktopActions = useMemo(() => canCreate ? (
    <button className="desktop-toolbar-btn" type="button" onClick={() => window.dispatchEvent(new CustomEvent('yfc-open-task-create'))}>
      <Plus size={16} /> Nouvelle tâche
    </button>
  ) : null, [canCreate])

  useEffect(() => {
    setToolbar({ title: 'Tâches', actions: desktopActions })
    return () => setToolbar({ actions: null })
  }, [desktopActions, setToolbar])

  return (
    <TaskBoard
      user={user}
      userData={userData}
      currentMember={currentMember}
      {...taskState}
    />
  )
}
