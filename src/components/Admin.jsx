import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import emailjs from '@emailjs/browser'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { db } from '../firebase'
import { ADMIN_EMAIL } from '../constants'
import { useTheme } from '../context/ThemeContext'

const EMAILJS_SERVICE_ID = 'service_q55ivrp'
const EMAILJS_TEMPLATE_ID = 'template_wgibd9k'
const EMAILJS_PUBLIC_KEY = 'DBkP2rCi6WMgXW9kq'
const APP_URL = 'https://yfc-budget.vercel.app'

export default function Admin({ user }) {
  const navigate = useNavigate()
  const { dark, C } = useTheme()
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
          app_url: APP_URL,
        },
        EMAILJS_PUBLIC_KEY
      )
    } catch (e) {
      console.error('Erreur approbation:', e)
    }
    setSending(null)
  }

  async function supprimer(id) {
    if (!window.confirm('Supprimer cet utilisateur ?')) return
    await deleteDoc(doc(db, 'users', id))
  }

  const enAttente = users.filter(u => u.approuve !== true)
  const approuves = users.filter(u => u.approuve === true)

  const pendingItemBg = dark ? 'rgba(180,83,9,0.12)' : '#fef9ec'
  const pendingAvatarBg = dark ? 'rgba(180,83,9,0.2)' : '#fef3c7'
  const pendingColor = dark ? '#f59e0b' : '#b45309'

  if (user?.email !== ADMIN_EMAIL) {
    return (
      <div className="page-container-locked sin" style={{ background: C.bg }}>
        <div className="textured-page-header" style={{ '--header-color': '#10b981', padding: '20px', paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.t1 }}>Administration</div>
        </div>
        <div className="page-content">
          <div style={{ textAlign: 'center', color: C.t2, padding: '2rem', fontSize: 13 }}>
            Cette page est réservée à l'admin.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container-locked sin" style={{ background: C.bg }}>
      <div className="textured-page-header" style={{ '--header-color': '#10b981', padding: '20px 20px 16px', paddingTop: 'max(20px, env(safe-area-inset-top))', borderBottom: `1px solid ${C.bord}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/parametres')} className="header-action" style={{ width: 38, height: 38, borderRadius: 12, border: `1px solid ${C.bord}`, background: C.surf, color: C.t2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>Administration</div>
            <div style={{ fontSize: 12, color: C.t2, marginTop: 2 }}>Gestion des demandes et des comptes</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: C.tealD, color: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={18} />
          </div>
        </div>
      </div>

      <div className="page-content" style={{ paddingBottom: '5rem' }}>
        <section style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div className="card-title mt-0">En attente ({enAttente.length})</div>

          {enAttente.length === 0 ? (
            <div className="text-13 text-secondary p-12 mb-8">Aucune demande en attente</div>
          ) : enAttente.map(u => (
            <div key={u.id} className="flex-center gap-10 p-12 rounded-12 mb-8" style={{ background: pendingItemBg }}>
              <div className="avatar-circle" style={{ background: pendingAvatarBg, color: pendingColor }}>
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
                  style={{ padding: '6px 10px', background: '#d4f4ee', color: '#0f766e', opacity: sending === u.id ? 0.7 : 1 }}
                >
                  {sending === u.id ? '...' : 'Approuver'}
                </button>
                <button onClick={() => supprimer(u.id)} className="btn-danger text-11 px-12">
                  Refuser
                </button>
              </div>
            </div>
          ))}
        </section>

        <section style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div className="card-title mt-0">Membres approuvés ({approuves.length})</div>

          {approuves.map(u => (
            <div key={u.id} className="flex-center gap-10 p-12 rounded-12 mb-8" style={{ background: 'var(--surface-alt)' }}>
              <div className="avatar-circle" style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
                {(u.nom || u.email || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1-min">
                <div className="text-13 font-600 text-primary">{u.nom || 'Sans nom'}</div>
                <div className="text-11 text-secondary text-ellipsis">{u.email}</div>
              </div>
              <button onClick={() => supprimer(u.id)} className="btn-danger flex-shrink-0">
                Supprimer
              </button>
            </div>
          ))}

          <div className="p-12 rounded-12 text-12 text-secondary leading-relaxed mt-16" style={{ background: 'var(--surface-alt)' }}>
            Un email est automatiquement envoyé lors de l'approbation d'un membre.
          </div>
        </section>
      </div>
    </div>
  )
}
