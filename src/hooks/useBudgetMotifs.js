import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export default function useBudgetMotifs() {
  const [motifs, setMotifs] = useState([])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'motifs'), snap => {
      setMotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  return motifs
}
