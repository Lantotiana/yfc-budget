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

  const enAttente = users.filter(u => u.approuve !== true)
  const approuves = users.filter(u => u.approuve === true)

  const sectionLabel = {
    fontSize: '10px',
    fontWeight: '700',
    color: '#9b8fb5',
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    marginBottom: '8px',
    marginTop: '1rem'
  }

  return (
    <div style={{position:'fixed', inset:0, background:'rgba(26,16,64,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200}}>
      <div style={{background:'white', borderRadius:'20px', padding:'1.5rem', width:'420px', maxHeight:'85vh', overflowY:'auto'}}>

        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
          <h2 style={{fontSize:'16px', fontWeight:'700', color:'#2d1f6e'}}>Gestion des membres</h2>
          <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer', fontSize:'18px', color:'#9b8fb5'}}>✕</button>
        </div>

        <div style={{...sectionLabel, marginTop:0}}>
          En attente ({enAttente.length})
        </div>

        {enAttente.length === 0 ? (
          <div style={{fontSize:'13px', color:'#9b8fb5', padding:'10px 0', marginBottom:'8px'}}>
            Aucune demande en attente
          </div>
        ) : enAttente.map(u => (
          <div key={u.id} style={{display:'flex', alignItems:'center', gap:'10px', padding:'12px', background:'#fef9ec', borderRadius:'12px', marginBottom:'8px'}}>
            <div style={{width:'36px', height:'36px', borderRadius:'50%', background:'#fef3c7', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', fontSize:'12px', color:'#b45309', flexShrink:0}}>
              {(u.nom || u.email || '?')[0].toUpperCase()}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:'13px', fontWeight:'600', color:'#2d1f6e'}}>{u.nom || 'Sans nom'}</div>
              <div style={{fontSize:'11px', color:'#9b8fb5', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{u.email}</div>
              <div style={{fontSize:'10px', color:'#b8afd4', marginTop:'2px'}}>{u.dateInscription}</div>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
              <button onClick={() => approuver(u.id)} style={{padding:'6px 10px', background:'#d4f4ee', color:'#0f766e', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'11px', fontWeight:'700', fontFamily:'inherit'}}>
                Approuver
              </button>
              <button onClick={() => supprimer(u.id)} style={{padding:'6px 10px', background:'#fde8e8', color:'#be123c', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'11px', fontWeight:'700', fontFamily:'inherit'}}>
                Refuser
              </button>
            </div>
          </div>
        ))}

        <div style={sectionLabel}>
          Membres approuvés ({approuves.length})
        </div>

        {approuves.map(u => (
          <div key={u.id} style={{display:'flex', alignItems:'center', gap:'10px', padding:'12px', background:'#f0eef8', borderRadius:'12px', marginBottom:'8px'}}>
            <div style={{width:'36px', height:'36px', borderRadius:'50%', background:'#e8e4f4', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', fontSize:'12px', color:'#2d1f6e', flexShrink:0}}>
              {(u.nom || u.email || '?')[0].toUpperCase()}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:'13px', fontWeight:'600', color:'#2d1f6e'}}>{u.nom || 'Sans nom'}</div>
              <div style={{fontSize:'11px', color:'#9b8fb5', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{u.email}</div>
            </div>
            <button onClick={() => supprimer(u.id)} style={{padding:'6px 10px', background:'#fde8e8', color:'#be123c', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'11px', fontWeight:'700', fontFamily:'inherit'}}>
              Supprimer
            </button>
          </div>
        ))}

        <div style={{marginTop:'1rem', padding:'12px', background:'#f0eef8', borderRadius:'12px', fontSize:'12px', color:'#9b8fb5', lineHeight:'1.5'}}>
          Les utilisateurs doivent s'inscrire via le formulaire de l'appli pour apparaître ici. Les comptes créés directement dans Firebase Auth ne sont pas visibles.
        </div>
      </div>
    </div>
  )
}