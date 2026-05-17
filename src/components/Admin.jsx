import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { sendBrevoEmail } from '../services/brevoService'
import { ArrowLeft, Check, ExternalLink, FileSpreadsheet, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { db } from '../firebase'
import { cloudFunctions } from '../firebaseFunctions'
import { ADMIN_EMAIL, STAFF_ROLES } from '../constants'
import { useTheme } from '../context/ThemeContext'
import { normalizeAccessText, sameEmail } from '../utils/access'

const APP_URL = 'https://young-for-christ.com'
const LOGO_URL = 'https://young-for-christ.com/logo_yfc.png'
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1bmvdcxi8NS4_RTPPT4cXusAVMgORMqB08RtxvNBOqz8/edit?gid=0#gid=0'
const SHEET_SYNC_ROLES = ['president', 'vice president', 'vice-president', 'responsable financier', 'tresorier', 'admin']

function buildApprovalHtml(nom) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px 48px;background:#F4F5FB;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto">
<tr><td>

  <!-- Header -->
  <div style="text-align:center;margin-bottom:24px">
    <img src="${LOGO_URL}" width="60" height="60"
      style="display:block;margin:0 auto 10px;object-fit:contain;border-radius:50%;background:#fff;border:2px solid rgba(0,0,0,0.08)" alt="YFC">
    <p style="margin:0;font-size:10px;font-weight:700;color:#A0A4BE;letter-spacing:2.5px;text-transform:uppercase">
      YOUNG FOR CHRIST ITAOSY
    </p>
  </div>

  <table width="100%" cellpadding="0" cellspacing="0"
    style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.10)">

    <!-- top bar -->
    <tr><td height="7" style="background:#0CC0DF;font-size:0">&nbsp;</td></tr>

    <!-- badge -->
    <tr><td style="background:linear-gradient(135deg,#0CC0DF,#0891b2);padding:28px 24px;text-align:center">
      <div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.2);
        margin:0 auto 14px;display:flex;align-items:center;justify-content:center;
        font-size:28px;line-height:56px;text-align:center">✓</div>
      <p style="margin:0;font-size:18px;font-weight:800;color:#fff;letter-spacing:0.3px">
        Compte approuvé !
      </p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85)">
        Bienvenue dans l'équipe YFC
      </p>
    </td></tr>

    <!-- body -->
    <tr><td style="padding:28px 28px 8px">
      <p style="margin:0 0 14px;font-size:15px;color:#1A1C2E;font-weight:600">
        Bonjour ${nom || 'ami(e)'} 👋
      </p>
      <p style="margin:0 0 14px;font-size:13px;color:#6B6F8A;line-height:1.7">
        Ton compte a été vérifié et approuvé par l'administration de
        <strong style="color:#1A1C2E">Young For Christ Itaosy</strong>.
        Tu peux maintenant accéder à l'application de gestion.
      </p>
    </td></tr>

    <!-- button -->
    <tr><td style="padding:8px 28px 28px;text-align:center">
      <a href="${APP_URL}"
        style="display:inline-block;padding:13px 32px;border-radius:12px;
          background:#0CC0DF;color:#fff;font-size:14px;font-weight:700;
          text-decoration:none;letter-spacing:0.3px">
        Accéder à l'application
      </a>
    </td></tr>

    <!-- divider -->
    <tr><td style="padding:0 28px"><div style="border-top:1px solid rgba(0,0,0,0.07)"></div></td></tr>

    <!-- attestation -->
    <tr><td style="background:#F9FAFB;padding:16px 28px">
      <p style="margin:0;font-size:11px;color:#6B6F8A;font-style:italic;line-height:1.65;
        border-left:3px solid #0CC0DF;padding-left:10px">
        Ce message a été envoyé automatiquement suite à l'approbation de ton compte.
        Si tu n'as pas fait de demande, contacte-nous à
        <a href="mailto:contact@young-for-christ.com" style="color:#0CC0DF">contact@young-for-christ.com</a>.
      </p>
    </td></tr>

    <!-- footer -->
    <tr><td style="background:#F9FAFB;padding:14px 28px;text-align:center;border-top:1px solid rgba(0,0,0,0.07)">
      <p style="margin:0;font-size:9px;font-weight:600;color:#6B6F8A">Young For Christ Itaosy</p>
      <p style="margin:3px 0 0;font-size:8px;color:#A0A4BE">contact@young-for-christ.com</p>
    </td></tr>

    <!-- bottom bar -->
    <tr><td height="5" style="background:#0CC0DF;font-size:0">&nbsp;</td></tr>

  </table>
</td></tr></table>
</body></html>`
}


function isOnline(u) {
  if (!u.lastSeen?.toDate) return false
  return Date.now() - u.lastSeen.toDate().getTime() < 2 * 60_000
}

function Avatar({ u, size = 38, online = false }) {
  const dot = online ? (
    <span style={{
      position: 'absolute', bottom: 1, right: 1,
      width: size * 0.28, height: size * 0.28,
      borderRadius: '50%', background: '#10b981',
      border: '2px solid var(--bg, #fff)',
      flexShrink: 0,
    }} />
  ) : null

  if (u.photoURL) {
    return (
      <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
        <img
          src={u.photoURL}
          alt=""
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
        />
        {dot}
      </span>
    )
  }
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <span style={{
        width: size, height: size, borderRadius: '50%',
        background: 'rgba(16,185,129,0.14)', color: '#10b981',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: size * 0.38,
      }}>
        {(u.nom || u.email || '?')[0].toUpperCase()}
      </span>
      {dot}
    </span>
  )
}

function UserSheet({ u, onClose, onSave, C }) {
  const { t } = useTranslation()
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
            {t('common.delete')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '12px', borderRadius: 14, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, fontSize: 'var(--font-sm)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}
          >
            <Check size={16} />{saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function canUseSheetSync(role) {
  return SHEET_SYNC_ROLES.includes(normalizeAccessText(role))
}

function GoogleSheetsSyncPanel({ C, canSync }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState({ state: 'idle', message: 'Pas encore synchronise', data: null })
  const [busy, setBusy] = useState(null)

  async function callFunction(name, label) {
    if (!canSync || busy) return
    setBusy(name)
    setStatus(prev => ({ ...prev, state: 'loading', message: `${label}...` }))
    try {
      const callable = httpsCallable(cloudFunctions, name)
      const result = await callable({})
      setStatus({ state: 'success', message: 'Succes', data: result.data || {} })
    } catch (e) {
      console.error(e)
      setStatus(prev => ({ ...prev, state: 'error', message: e.message || 'Erreur de synchronisation' }))
    } finally {
      setBusy(null)
    }
  }

  const data = status.data || {}
  const badgeColor = status.state === 'error' ? '#f43f5e' : status.state === 'success' ? '#10b981' : C.t3

  return (
    <section style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(12,192,223,0.14)', color: '#0cc0df', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileSpreadsheet size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card-title mt-0" style={{ marginBottom: 2 }}>{t('admin.synchroniser')}</div>
          <div style={{ fontSize: 'var(--font-xs)', color: C.t2 }}>Firebase reste la source officielle des donnees.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <button
          type="button"
          disabled={!canSync || busy}
          onClick={() => callFunction('syncAllToGoogleSheets', t('admin.synchronisation'))}
          style={{ padding: '11px 10px', borderRadius: 12, border: 'none', background: '#0cc0df', color: '#fff', fontWeight: 800, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: 'var(--font-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: !canSync || busy ? 0.65 : 1 }}
        >
          <RefreshCw size={14} /> {busy === 'syncAllToGoogleSheets' ? t('admin.synchronisation') : t('admin.synchroniser')}
        </button>
        <button
          type="button"
          disabled={!canSync || busy}
          onClick={() => callFunction('prepareGoogleSheets', 'Preparation du fichier')}
          style={{ padding: '11px 10px', borderRadius: 12, border: `1px solid ${C.bord}`, background: C.surf2, color: C.t1, fontWeight: 800, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: 'var(--font-xs)', opacity: !canSync || busy ? 0.65 : 1 }}
        >
          Preparer
        </button>
      </div>

      <a
        href={GOOGLE_SHEET_URL}
        target="_blank"
        rel="noreferrer"
        style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 12, border: `1px solid ${C.bord}`, background: C.surf2, color: C.t1, fontWeight: 700, textDecoration: 'none', fontSize: 'var(--font-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
      >
        <ExternalLink size={14} /> Voir le Google Sheet
      </a>

      <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: C.surf2, border: `1px solid ${C.bord}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 'var(--font-xs)', color: C.t2, fontWeight: 700 }}>Statut</span>
          <span style={{ fontSize: 'var(--font-xs)', color: badgeColor, fontWeight: 800 }}>{status.message}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 'var(--font-xs)', color: C.t2 }}>
          <div>Derniere synchro<br /><strong style={{ color: C.t1 }}>{data.lastSync ? new Date(data.lastSync).toLocaleString('fr-FR') : '-'}</strong></div>
          <div>Membres<br /><strong style={{ color: C.t1 }}>{data.membres ?? '-'}</strong></div>
          <div>Operations budget<br /><strong style={{ color: C.t1 }}>{data.transactions ?? '-'}</strong></div>
          <div>Evenements<br /><strong style={{ color: C.t1 }}>{data.events ?? '-'}</strong></div>
        </div>
      </div>
    </section>
  )
}

export default function Admin({ user, userData }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { dark, C } = useTheme()
  const [users, setUsers] = useState([])
  const [membres, setMembres] = useState([])
  const [sending, setSending] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'membres'), snap => {
      setMembres(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  async function approuver(u) {
    setSending(u.id)
    try {
      await updateDoc(doc(db, 'users', u.id), { approuve: true })
      await sendBrevoEmail({
        to: u.email,
        subject: '✅ Ton compte Young For Christ a été approuvé',
        htmlContent: buildApprovalHtml(u.nom),
      })
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
  const currentMember = membres.find(m => sameEmail(m.email, user?.email))
  const canSyncSheets = user?.email === ADMIN_EMAIL || canUseSheetSync(userData?.staffRole || userData?.role || currentMember?.staffRole)

  const pendingItemBg = dark ? 'rgba(180,83,9,0.12)' : '#fef9ec'
  const pendingAvatarBg = dark ? 'rgba(180,83,9,0.2)' : '#fef3c7'
  const pendingColor = dark ? '#f59e0b' : '#b45309'

  if (user?.email !== ADMIN_EMAIL && !canSyncSheets) {
    return (
      <div className="page-container-locked sin" style={{ background: C.bg }}>
        <div className="textured-page-header desktop-hide-page-header" style={{ '--header-color': '#10b981', padding: '20px', paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
          <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: C.t1 }}>{t('admin.title')}</div>
        </div>
        <div className="page-content">
          <div style={{ textAlign: 'center', color: C.t2, padding: '2rem', fontSize: 'var(--font-sm)' }}>
            Cette page est reservee a l'administration.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container-locked sin" style={{ background: C.bg }}>
      <div className="textured-page-header desktop-hide-page-header" style={{ '--header-color': '#10b981', padding: '20px 20px 16px', paddingTop: 'max(20px, env(safe-area-inset-top))', borderBottom: `1px solid ${C.bord}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/parametres')} className="header-action" style={{ width: 38, height: 38, borderRadius: 12, border: `1px solid ${C.bord}`, background: C.surf, color: C.t2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>{t('admin.title')}</div>
            <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 2 }}>Gestion des demandes et des comptes</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: C.tealD, color: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={18} />
          </div>
        </div>
      </div>

      <div className="page-content" style={{ paddingBottom: '5rem' }}>
        <GoogleSheetsSyncPanel C={C} canSync={canSyncSheets} />

        {user?.email === ADMIN_EMAIL && (
        <>
        <section style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div className="card-title mt-0">{t('admin.enAttente')} ({enAttente.length})</div>
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
                  {sending === u.id ? '...' : t('admin.approuver')}
                </button>
                <button onClick={() => supprimer(u.id)} className="btn-danger text-11 px-12">{t('admin.rejeter')}</button>
              </div>
            </div>
          ))}
        </section>

        <section style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div className="card-title mt-0">{t('admin.approuve')} ({approuves.length})</div>
          {approuves.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelectedUser(u)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, marginBottom: 8, background: C.surf2, border: `1px solid ${C.bord}`, cursor: 'pointer', textAlign: 'left' }}
            >
              <Avatar u={u} size={40} online={isOnline(u)} />
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
        </>
        )}
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
