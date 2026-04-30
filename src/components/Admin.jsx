import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import emailjs from '@emailjs/browser'
import { useTheme } from '../context/ThemeContext'
import { X } from 'lucide-react'
import { createNotification } from '../notifications'

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
      await createNotification({
        type: 'admin',
        titre: 'Utilisateur approuvé',
        detail: u.nom || u.email,
        cible: u.id,
        route: '/',
      })

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
      const user = users.find(u => u.id === id)
      await deleteDoc(doc(db, 'users', id))
      await createNotification({
        type: 'admin',
        titre: 'Utilisateur supprimé',
        detail: user?.nom || user?.email || '',
        cible: id,
        route: '/',
      })
    }
  }

  const enAttente = users.filter(u => u.approuve !== true)
  const approuves = users.filter(u => u.approuve === true)

  const pendingItemBg = dark ? 'rgba(180,83,9,0.12)' : '#fef9ec'
  const pendingAvatarBg = dark ? 'rgba(180,83,9,0.2)' : '#fef3c7'
  const pendingColor = dark ? '#f59e0b' : '#b45309'

  return (
    <div className="modal-overlay">
      <div className="modal" style={{width:'420px'}}>

        <div className="dialog-header">
          <h2 className="dialog-title">Gestion des membres</h2>
          <button onClick={onClose} className="dialog-close-btn"><X size={18} /></button>
        </div>

        <div className="card-title mt-0">
          En attente ({enAttente.length})
        </div>

        {enAttente.length === 0 ? (
          <div className="text-13 text-secondary p-12 mb-8">
            Aucune demande en attente
          </div>
        ) : enAttente.map(u => (
          <div key={u.id} className="flex-center gap-10 p-12 rounded-12 mb-8" style={{background:pendingItemBg}}>
            <div className="avatar-circle" style={{background:pendingAvatarBg, color:pendingColor}}>
              {(u.nom || u.email || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1-min">
              <div className="text-13 font-600 text-primary">{u.nom || 'Sans nom'}</div>
              <div className="text-11 text-secondary text-ellipsis">{u.email}</div>
              <div className="text-10 text-muted mt-2">{u.dateInscription}</div>
            </div>
            <div className="flex-col gap-6 flex-shrink-0">
              <button
                onClick={() => approuver(u)}
                disabled={sending === u.id}
                className="rounded-8 text-11 font-700 text-white border-none cursor-pointer"
                style={{padding:'6px 10px', background:'#d4f4ee', color:'#0f766e', opacity: sending === u.id ? 0.7 : 1}}
              >
                {sending === u.id ? '...' : 'Approuver'}
              </button>
              <button
                onClick={() => supprimer(u.id)}
                className="btn-danger text-11 px-12"
              >
                Refuser
              </button>
            </div>
          </div>
        ))}

        <div className="card-title">
          Membres approuvés ({approuves.length})
        </div>

        {approuves.map(u => (
          <div key={u.id} className="flex-center gap-10 p-12 rounded-12 mb-8" style={{background:'var(--surface-alt)'}}>
            <div className="avatar-circle" style={{background:'var(--input-bg)', color:'var(--text-primary)'}}>
              {(u.nom || u.email || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1-min">
              <div className="text-13 font-600 text-primary">{u.nom || 'Sans nom'}</div>
              <div className="text-11 text-secondary text-ellipsis">{u.email}</div>
            </div>
            <button
              onClick={() => supprimer(u.id)}
              className="btn-danger flex-shrink-0"
            >
              Supprimer
            </button>
          </div>
        ))}

        <div className="p-12 rounded-12 text-12 text-secondary leading-relaxed mt-16" style={{background:'var(--surface-alt)'}}>
          Un email est automatiquement envoyé lors de l'approbation d'un membre.
        </div>
      </div>
    </div>
  )
}
