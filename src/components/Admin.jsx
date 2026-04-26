import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import emailjs from '@emailjs/browser'
import { useTheme } from '../context/ThemeContext'
import { X } from 'lucide-react'

const EMAILJS_SERVICE_ID = 'service_q55ivrp'
const EMAILJS_TEMPLATE_ID = 'template_wgibd9k'
const EMAILJS_PUBLIC_KEY = 'DBkP2rCi6WMgXW9kq'
const APP_URL = 'https://yfc-budget.vercel.app'

export default function Admin({ onClose }) {
  const { dark } = useTheme()
  const [users, setUsers] = useState([])
  const [sending, setSending] = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  async function approuver(u) {
    setSending(u.id)
    try {
      await updateDoc(doc(db, 'users', u.id), { approuve: true })

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          nom: u.nom || u.email,
          email: u.email,
          app_url: APP_URL
        },
        EMAILJS_PUBLIC_KEY
      )
    } catch(e) {
      console.error('Erreur envoi email:', e)
    }
    setSending(null)
  }

  async function supprimer(id) {
    if (window.confirm('Supprimer cet utilisateur ?')) {
      await deleteDoc(doc(db, 'users', id))
    }
  }

  const enAttente = users.filter(u => u.approuve !== true)
  const approuves = users.filter(u => u.approuve === true)

  const pendingItemBg = dark ? 'rgba(180,83,9,0.12)' : '#fef9ec'
  const pendingAvatarBg = dark ? 'rgba(180,83,9,0.2)' : '#fef3c7'
  const pendingColor = dark ? '#f59e0b' : '#b45309'

  const sectionLabel = {
    fontSize: '10px',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    marginBottom: '8px',
    marginTop: '1rem'
  }

  return (
    <div style={{position:'fixed', inset:0, background:'rgba(26,16,64,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200}}>
      <div style={{background:'var(--card-bg)', borderRadius:'20px', padding:'1.5rem', width:'420px', maxHeight:'85vh', overflowY:'auto'}}>

        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
          <h2 style={{fontSize:'16px', fontWeight:'700', color:'var(--text-primary)'}}>Gestion des membres</h2>
          <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', display:'flex', alignItems:'center'}}><X size={18} /></button>
        </div>

        <div style={{...sectionLabel, marginTop:0}}>
          En attente ({enAttente.length})
        </div>

        {enAttente.length === 0 ? (
          <div style={{fontSize:'13px', color:'var(--text-secondary)', padding:'10px 0', marginBottom:'8px'}}>
            Aucune demande en attente
          </div>
        ) : enAttente.map(u => (
          <div key={u.id} style={{display:'flex', alignItems:'center', gap:'10px', padding:'12px', background:pendingItemBg, borderRadius:'12px', marginBottom:'8px'}}>
            <div style={{width:'36px', height:'36px', borderRadius:'50%', background:pendingAvatarBg, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', fontSize:'12px', color:pendingColor, flexShrink:0}}>
              {(u.nom || u.email || '?')[0].toUpperCase()}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:'13px', fontWeight:'600', color:'var(--text-primary)'}}>{u.nom || 'Sans nom'}</div>
              <div style={{fontSize:'11px', color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{u.email}</div>
              <div style={{fontSize:'10px', color:'var(--text-muted)', marginTop:'2px'}}>{u.dateInscription}</div>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
              <button
                onClick={() => approuver(u)}
                disabled={sending === u.id}
                style={{padding:'6px 10px', background:'#d4f4ee', color:'#0f766e', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'11px', fontWeight:'700', fontFamily:'inherit', opacity: sending === u.id ? 0.7 : 1}}
              >
                {sending === u.id ? '...' : 'Approuver'}
              </button>
              <button
                onClick={() => supprimer(u.id)}
                style={{padding:'6px 10px', background:'#fde8e8', color:'#be123c', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'11px', fontWeight:'700', fontFamily:'inherit'}}
              >
                Refuser
              </button>
            </div>
          </div>
        ))}

        <div style={sectionLabel}>
          Membres approuvés ({approuves.length})
        </div>

        {approuves.map(u => (
          <div key={u.id} style={{display:'flex', alignItems:'center', gap:'10px', padding:'12px', background:'var(--surface-alt)', borderRadius:'12px', marginBottom:'8px'}}>
            <div style={{width:'36px', height:'36px', borderRadius:'50%', background:'var(--input-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', fontSize:'12px', color:'var(--text-primary)', flexShrink:0}}>
              {(u.nom || u.email || '?')[0].toUpperCase()}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:'13px', fontWeight:'600', color:'var(--text-primary)'}}>{u.nom || 'Sans nom'}</div>
              <div style={{fontSize:'11px', color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{u.email}</div>
            </div>
            <button
              onClick={() => supprimer(u.id)}
              style={{padding:'6px 10px', background:'#fde8e8', color:'#be123c', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'11px', fontWeight:'700', fontFamily:'inherit'}}
            >
              Supprimer
            </button>
          </div>
        ))}

        <div style={{marginTop:'1rem', padding:'12px', background:'var(--surface-alt)', borderRadius:'12px', fontSize:'12px', color:'var(--text-secondary)', lineHeight:'1.5'}}>
          Un email est automatiquement envoyé lors de l'approbation d'un membre.
        </div>
      </div>
    </div>
  )
}
