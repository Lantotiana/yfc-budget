import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import emailjs from '@emailjs/browser'
import { ArrowLeft, Check, ShieldCheck, X } from 'lucide-react'
import { db } from '../firebase'
import { ADMIN_EMAIL, STAFF_ROLES } from '../constants'
import { useTheme } from '../context/ThemeContext'

const EMAILJS_SERVICE_ID = 'service_q55ivrp'
const EMAILJS_TEMPLATE_ID = 'template_wgibd9k'
const EMAILJS_PUBLIC_KEY = 'DBkP2rCi6WMgXW9kq'
const APP_URL = 'https://yfc-budget.vercel.app'


function Avatar({ u, size = 38 }) {
  if (u.photoURL) {
    return (
      <img
        src={u.photoURL}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'rgba(16,185,129,0.14)', color: '#10b981',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.38,
    }}>
      {(u.nom || u.email || '?')[0].toUpperCase()}
    </div>
  )
}

function UserSheet({ u, onClose, onSave, C }) {
  const [form, setForm] = useState({
    nom: u.nom || '',
    photoURL: u.photoURL || '',
    staffRole: u.staffRole || '',
    approuve: u.approuve === true,
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', u.id), {
        nom: form.nom.trim(),
        photoURL: form.photoURL.trim(),
        staffRole: form.staffRole,
        approuve: form.approuve,
      })
      const memSnap = await getDocs(query(collection(db, 'membres'), where('email', '==', u.email)))
      if (!memSnap.empty) {
        await updateDoc(memSnap.docs[0].ref, { staffRole: form.staffRole })
      }
      onSave()
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!window.confirm(`Supprimer ${u.nom || u.email} ?`)) return
    await deleteDoc(doc(db, 'users', u.id))
    onClose()
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    border: `1px solid ${C.bord}`, borderRadius: 12,
    background: C.surf2, color: C.t1,
    padding: '10px 12px', fontSize: 'var(--font-sm)',
    fontFamily: 'inherit', outline: 'none',
  }

  const labelStyle = { fontSize: 'var(--font-xs)', color: C.t2, fontWeight: 600, marginBottom: 5, display: 'block' }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px', paddingBottom: 'calc(max(16px, env(safe-area-inset-bottom)) + 68px)' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto', background: C.surf, borderRadius: 24, padding: 20, boxShadow: '0 28px 70px rgba(0,0,0,0.28)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar u={{ ...u, photoURL: form.photoURL || u.photoURL }} size={44} />
            <div>
              <div style={{ fontSize: 'var(--font-base)', fontWeight: 700, color: C.t1 }}>{u.nom || 'Sans nom'}</div>
              <div style={{ fontSize: 'var(--font-xs)', color: C.t2 }}>{u.email}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.bord}`, background: C.surf2, color: C.t2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={labelStyle}>Nom complet</label>
            <input style={inputStyle} value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Nom" />
          </div>

          <div>
            <label style={labelStyle}>URL photo de profil</label>
            <input style={inputStyle} value={form.photoURL} onChange={e => setForm(f => ({ ...f, photoURL: e.target.value }))} placeholder="https://..." />
          </div>

          <div>
            <label style={labelStyle}>Rôle staff</label>
            <select style={{ ...inputStyle }} value={form.staffRole} onChange={e => setForm(f => ({ ...f, staffRole: e.target.value }))}>
              <option value="">— Aucun rôle —</option>
              {STAFF_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: C.surf2, borderRadius: 12, border: `1px solid ${C.bord}` }}>
            <span style={{ fontSize: 'var(--font-sm)', color: C.t1, fontWeight: 600 }}>Compte approuvé</span>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, approuve: !f.approuve }))}
              style={{ width: 44, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', background: form.approuve ? '#10b981' : C.bord, transition: 'background .2s', position: 'relative', flexShrink: 0 }}
            >
              <span style={{ position: 'absolute', top: 3, left: form.approuve ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginTop: 20 }}>
          <button
            onClick={handleDelete}
            style={{ padding: '12px', borderRadius: 14, border: 'none', background: 'rgba(244,63,94,0.12)', color: '#f43f5e', fontWeight: 700, fontSize: 'var(--font-sm)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Supprimer
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '12px', borderRadius: 14, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, fontSize: 'var(--font-sm)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}
          >
            <Check size={16} />{saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Admin({ user }) {
  const navigate = useNavigate()
  const { dark, C } = useTheme()
  const [users, setUsers] = useState([])
  const [sending, setSending] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)

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
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, { nom: u.nom || u.email, email: u.email, app_url: APP_URL }, EMAILJS_PUBLIC_KEY)
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
          <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: C.t1 }}>Administration</div>
        </div>
        <div className="page-content">
          <div style={{ textAlign: 'center', color: C.t2, padding: '2rem', fontSize: 'var(--font-sm)' }}>
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
            <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>Administration</div>
            <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 2 }}>Gestion des demandes et des comptes</div>
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
                <button onClick={() => supprimer(u.id)} className="btn-danger text-11 px-12">Refuser</button>
              </div>
            </div>
          ))}
        </section>

        <section style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div className="card-title mt-0">Membres approuvés ({approuves.length})</div>
          {approuves.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelectedUser(u)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, marginBottom: 8, background: C.surf2, border: `1px solid ${C.bord}`, cursor: 'pointer', textAlign: 'left' }}
            >
              <Avatar u={u} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1 }}>{u.nom || 'Sans nom'}</div>
                <div style={{ fontSize: 'var(--font-xs)', color: C.t2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                {u.staffRole && <div style={{ fontSize: 'var(--font-xs)', color: '#10b981', marginTop: 2, fontWeight: 600 }}>{u.staffRole}</div>}
              </div>
              <ArrowLeft size={14} style={{ color: C.t3, transform: 'rotate(180deg)', flexShrink: 0 }} />
            </button>
          ))}
          <div className="p-12 rounded-12 text-12 text-secondary leading-relaxed mt-16" style={{ background: C.surf2 }}>
            Un email est automatiquement envoyé lors de l'approbation d'un membre.
          </div>
        </section>
      </div>

      {selectedUser && (
        <UserSheet
          u={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSave={() => setSelectedUser(null)}
          C={C}
        />
      )}
    </div>
  )
}
