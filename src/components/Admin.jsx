import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore'

export default function Admin({ onClose }) {
  const [users, setUsers] = useState([])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  async function approuver(id) {
    await updateDoc(doc(db, 'users', id), { approuve: true })
  }

  async function supprimer(id) {
    if (window.confirm('Supprimer cet utilisateur ?')) {
      await deleteDoc(doc(db, 'users', id))
    }
  }

  const enAttente = users.filter(u => !u.approuve)
  const approuves = users.filter(u => u.approuve)

  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200}}>
      <div style={{background:'white', borderRadius:'16px', padding:'1.5rem', width:'480px', maxHeight:'80vh', overflowY:'auto'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
          <h2 style={{fontSize:'16px', fontWeight:'600'}}>Gestion des membres</h2>
          <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer', fontSize:'18px', color:'#888'}}>✕</button>
        </div>

        <div style={{fontSize:'11px', fontWeight:'600', color:'#999', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:'8px'}}>
          En attente ({enAttente.length})
        </div>
        {enAttente.length === 0 && <div style={{fontSize:'13px', color:'#aaa', marginBottom:'1rem'}}>Aucune demande en attente</div>}
        {enAttente.map(u => (
          <div key={u.id} style={{display:'flex', alignItems:'center', gap:'10px', padding:'10px', background:'#fff9e6', borderRadius:'8px', marginBottom:'6px'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:'14px', fontWeight:'500'}}>{u.nom}</div>
              <div style={{fontSize:'12px', color:'#888'}}>{u.email}</div>
            </div>
            <button onClick={() => approuver(u.id)} style={{padding:'6px 12px', background:'#dcfce7', color:'#16a34a', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px', fontWeight:'600'}}>Approuver</button>
            <button onClick={() => supprimer(u.id)} style={{padding:'6px 12px', background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px', fontWeight:'600'}}>Refuser</button>
          </div>
        ))}

        <div style={{fontSize:'11px', fontWeight:'600', color:'#999', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:'8px', marginTop:'1rem'}}>
          Membres approuvés ({approuves.length})
        </div>
        {approuves.map(u => (
          <div key={u.id} style={{display:'flex', alignItems:'center', gap:'10px', padding:'10px', background:'#f9f9f7', borderRadius:'8px', marginBottom:'6px'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:'14px', fontWeight:'500'}}>{u.nom}</div>
              <div style={{fontSize:'12px', color:'#888'}}>{u.email}</div>
            </div>
            <button onClick={() => supprimer(u.id)} style={{padding:'6px 12px', background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px', fontWeight:'600'}}>Supprimer</button>
          </div>
        ))}
      </div>
    </div>
  )
}