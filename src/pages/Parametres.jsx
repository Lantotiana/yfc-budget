import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Trash2, Share2, Check, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { auth } from '../auth'
import { db } from '../firebase'
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import { collection, doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { useTheme } from '../context/ThemeContext'
import { createNotification } from '../notifications'
import { normalizeAccessText, sameEmail } from '../utils/access'
import { ADMIN_EMAIL, DEFAULT_MEMBRE_TAGS } from '../constants'

const CLOUDINARY_CLOUD = 'dtthz84ie'
const CLOUDINARY_PRESET = 'yfc_profiles'
const SHEET_SYNC_ROLES = ['president', 'vice president', 'vice-president', 'responsable financier', 'tresorier', 'admin']

export default function Parametres({ user, userData, setUserData }) {
  const navigate = useNavigate()
  const { dark, toggle, C } = useTheme()
  const fileRef = useRef()

  const [nom, setNom] = useState(userData?.nom || '')
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoURL, setPhotoURL] = useState(userData?.photoURL || '')
  const [memberRole, setMemberRole] = useState({ staff: false, staffRole: '' })
  const [msg, setMsg] = useState({ text: '', ok: true })

  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [availableTags, setAvailableTags] = useState(DEFAULT_MEMBRE_TAGS)
  const [newTagInput, setNewTagInput] = useState('')
  const [confirmDeleteTag, setConfirmDeleteTag] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const appUrl = 'https://young-for-christ.com/'

  const isAdmin = user?.email === ADMIN_EMAIL
  const canOpenAdminTools = isAdmin || SHEET_SYNC_ROLES.includes(normalizeAccessText(memberRole.staffRole))

  function flash(text, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg({ text: '', ok: true }), 3000)
  }

  useEffect(() => {
    if (!user?.email) return
    const unsub = onSnapshot(collection(db, 'membres'), snap => {
      const member = snap.docs.map(d => d.data()).find(m => sameEmail(m.email, user.email))
      setMemberRole({
        staff: member?.staff === true,
        staffRole: member?.staffRole || '',
      })
    })
    return () => unsub()
  }, [user?.email])

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'appSettings', 'membreTags'), snap => {
      const raw = snap.exists() && Array.isArray(snap.data().list) ? snap.data().list : []
      setAvailableTags(['Membre', ...raw.filter(t => t !== 'Membre')])
    })
    return () => unsub()
  }, [])

  async function addNewTag() {
    const tag = newTagInput.trim()
    if (!tag || availableTags.includes(tag)) return
    const next = ['Membre', ...availableTags.filter(t => t !== 'Membre'), tag]
    setNewTagInput('')
    await setDoc(doc(db, 'appSettings', 'membreTags'), { list: next })
  }

  async function shareAppLink() {
    if (navigator.share) {
      try { await navigator.share({ title: 'YFC Budget', url: appUrl }) } catch {}
    } else {
      await navigator.clipboard.writeText(appUrl)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  async function removeTag(tag) {
    if (tag === 'Membre') return
    const next = availableTags.filter(t => t !== tag)
    setConfirmDeleteTag(null)
    await setDoc(doc(db, 'appSettings', 'membreTags'), { list: next })
  }

  async function saveProfile() {
    if (!nom.trim()) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), { nom: nom.trim(), photoURL })
      setUserData(prev => ({ ...prev, nom: nom.trim(), photoURL }))
      await createNotification({
        type: 'profil',
        titre: 'Profil mis à jour',
        detail: nom.trim(),
        cible: user.uid,
        route: '/parametres',
      })
      flash('Profil mis à jour !')
    } catch { flash('Erreur lors de la sauvegarde.', false) }
    setSaving(false)
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('upload_preset', CLOUDINARY_PRESET)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.secure_url) {
        setPhotoURL(data.secure_url)
        await updateDoc(doc(db, 'users', user.uid), { photoURL: data.secure_url })
        setUserData(prev => ({ ...prev, photoURL: data.secure_url }))
        await createNotification({
          type: 'profil',
          titre: 'Photo de profil modifiée',
          detail: userData?.nom || user.email,
          cible: user.uid,
          route: '/parametres',
        })
        flash('Photo mise à jour !')
      } else { flash('Erreur upload photo.', false) }
    } catch { flash('Erreur upload photo.', false) }
    setUploadingPhoto(false)
  }

  async function savePassword() {
    if (newPwd.length < 6) { flash('Mot de passe trop court (6 caractères min).', false); return }
    if (newPwd !== confirmPwd) { flash('Les mots de passe ne correspondent pas.', false); return }
    setSavingPwd(true)
    try {
      const cred = EmailAuthProvider.credential(user.email, oldPwd)
      await reauthenticateWithCredential(auth.currentUser, cred)
      await updatePassword(auth.currentUser, newPwd)
      setOldPwd(''); setNewPwd(''); setConfirmPwd('')
      await createNotification({
        type: 'profil',
        titre: 'Mot de passe modifié',
        detail: userData?.nom || user.email,
        cible: user.uid,
        route: '/parametres',
      })
      flash('Mot de passe modifié !')
    } catch(e) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        flash('Mot de passe actuel incorrect.', false)
      } else { flash('Erreur : ' + e.message, false) }
    }
    setSavingPwd(false)
  }

  const inp = {
    width: '100%', padding: '11px 14px',
    border: `1.5px solid ${C.bord2}`, borderRadius: 12,
    fontSize: 'var(--font-sm)', background: C.surf2, color: C.t1,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }

  const section = {
    background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16,
    padding: '1.25rem', marginBottom: 12,
  }

  const sectionLabel = {
    fontSize: 'var(--font-xs)', fontWeight: 700, color: C.t3,
    textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14,
  }

  const roleLabel = memberRole.staffRole || (memberRole.staff ? 'Staff sans rôle attribué' : 'Membre')

  return (
    <div className="page-container-locked sin" style={{ background: C.bg }}>

      {/* Header */}
      <div className="textured-page-header desktop-hide-page-header" style={{ '--header-color': '#64748b', padding: '20px 20px 16px', paddingTop: 'max(20px, env(safe-area-inset-top))', borderBottom: `1px solid ${C.bord}`, flexShrink: 0 }}>
        <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>Paramètres</div>
      </div>

      <div className="page-content" style={{ padding: '16px 20px', paddingBottom: 'max(5rem, env(safe-area-inset-bottom))' }}>

        {/* Flash */}
        {msg.text && (
          <div style={{ padding: '10px 14px', borderRadius: 12, marginBottom: 12, fontSize: 'var(--font-sm)', fontWeight: 600, background: msg.ok ? C.tealD : C.coralD, color: msg.ok ? C.teal : C.coral }}>
            {msg.text}
          </div>
        )}

        {/* Application */}
        <div style={section}>
          <div style={sectionLabel}>Application</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, background: C.surf2, border: `1px solid ${C.bord}` }}>
            <span style={{ flex: 1, fontSize: 'var(--font-xs)', color: C.t2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appUrl}</span>
            <button
              onClick={() => setShowQR(true)}
              style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.bord2}`, background: C.surf, color: C.t2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <QrCode size={15} />
            </button>
            <button
              onClick={shareAppLink}
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, border: 'none', background: C.teal, color: '#fff', fontWeight: 700, fontSize: 'var(--font-xs)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {linkCopied ? <Check size={13} /> : <Share2 size={13} />}
              {linkCopied ? 'Copié !' : 'Partager'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 8 }}>
            {[
              {
                label: 'YouTube',
                url: 'https://www.youtube.com/@YFCTanora_hoani_KristyJMItaosy',
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
                    <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
                  </svg>
                ),
              },
              {
                label: 'Facebook',
                url: 'https://www.facebook.com/groups/1877840085786311',
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                  </svg>
                ),
              },
            ].map(({ label, url, icon }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, color: C.t3, textDecoration: 'none', fontSize: 'var(--font-sm)' }}
              >
                <span style={{ flexShrink: 0, color: C.t3 }}>{icon}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.4 }}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            ))}
          </div>

          {showQR && (
            <div className="modal-overlay" onClick={() => setShowQR(false)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 280, textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: C.t1, marginBottom: 16 }}>Scanner pour accéder à l'app</div>
                <div style={{ display: 'inline-block', padding: 12, borderRadius: 16, background: '#fff' }}>
                  <QRCodeSVG value={appUrl} size={180} fgColor="#0f172a" bgColor="#ffffff" />
                </div>
                <div style={{ marginTop: 12, fontSize: 'var(--font-xs)', color: C.t3 }}>{appUrl}</div>
                <button onClick={() => setShowQR(false)} style={{ marginTop: 16, width: '100%', padding: 12, borderRadius: 12, border: `1.5px solid ${C.bord2}`, background: 'transparent', color: C.t2, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Fermer</button>
              </div>
            </div>
          )}
        </div>

        {/* Apparence */}
        <div style={section}>
          <div style={sectionLabel}>Apparence</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1 }}>Mode sombre</div>
              <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 1 }}>{dark ? 'Activé' : 'Désactivé'}</div>
            </div>
            <button
              onClick={toggle}
              style={{ width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', padding: 0, background: dark ? C.amber : C.bord2, position: 'relative', transition: 'background 0.2s' }}
            >
              <span style={{ position: 'absolute', top: 3, left: dark ? 27 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
            </button>
          </div>
        </div>

        {/* Profil */}
        <div style={section}>
          <div style={sectionLabel}>Profil</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{ width: 64, height: 64, borderRadius: '50%', background: C.surf2, overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--font-md)', color: C.t1, flexShrink: 0 }}
            >
              {uploadingPhoto ? '...' : photoURL
                ? <img src={photoURL} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (nom || user?.email || '?').slice(0, 2).toUpperCase()
              }
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1, marginBottom: 2 }}>Photo de profil</div>
              <button
                onClick={() => fileRef.current?.click()}
                style={{ fontSize: 'var(--font-xs)', color: C.amber, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: 600 }}
              >
                {uploadingPhoto ? 'Envoi en cours...' : 'Modifier la photo'}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="form-label">Nom complet</label>
            <input type="text" value={nom} onChange={e => setNom(e.target.value)} placeholder="Ton nom" style={inp} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Email</label>
            <input type="email" value={user?.email || ''} disabled style={{ ...inp, opacity: 0.5, cursor: 'not-allowed' }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Rôle</label>
            <input type="text" value={roleLabel} disabled style={{ ...inp, opacity: 0.5, cursor: 'not-allowed' }} />
          </div>

          <button
            onClick={saveProfile}
            disabled={saving || !nom.trim()}
            style={{ width: '100%', padding: 13, border: 'none', borderRadius: 12, background: C.teal, color: '#fff', fontWeight: 700, fontSize: 'var(--font-sm)', cursor: 'pointer', fontFamily: 'inherit', opacity: (saving || !nom.trim()) ? 0.6 : 1 }}
          >
            {saving ? 'Enregistrement...' : 'Sauvegarder le profil'}
          </button>
        </div>

        {/* Mot de passe */}
        {canOpenAdminTools && (
          <div style={section}>
            <div style={sectionLabel}>Administration</div>
            <button
              onClick={() => navigate('/admin')}
              style={{ width: '100%', padding: 13, border: 'none', borderRadius: 12, background: C.teal, color: '#fff', fontWeight: 700, fontSize: 'var(--font-sm)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Ouvrir la page admin
            </button>
          </div>
        )}

        {/* Tags des membres */}
        {isAdmin && (
          <div style={section}>
            <div style={sectionLabel}>Tags des membres</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {availableTags.map(tag => (
                <div key={tag} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: C.surf2, border: `1px solid ${C.bord}` }}>
                  <span style={{ fontSize: 'var(--font-sm)', color: C.t1 }}>{tag}</span>
                  {tag !== 'Membre' ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteTag(confirmDeleteTag === tag ? null : tag)}
                      style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', color: C.coral, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <span style={{ fontSize: 10, color: C.t3, fontStyle: 'italic' }}>protégé</span>
                  )}
                </div>
              ))}
            </div>

            {confirmDeleteTag && (
              <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 12, background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)' }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1, marginBottom: 4 }}>
                  Supprimer «&nbsp;{confirmDeleteTag}&nbsp;» ?
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginBottom: 12 }}>
                  Les membres qui ont ce tag conserveront leur donnée existante.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmDeleteTag(null)} style={{ flex: 1, padding: '9px', borderRadius: 10, border: `1.5px solid ${C.bord2}`, background: 'transparent', color: C.t2, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--font-xs)' }}>Annuler</button>
                  <button onClick={() => removeTag(confirmDeleteTag)} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: C.coral, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--font-xs)' }}>Supprimer</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNewTag())}
                placeholder="Nouveau tag..."
                style={{ ...inp, flex: 1 }}
              />
              <button
                type="button"
                onClick={addNewTag}
                disabled={!newTagInput.trim() || availableTags.includes(newTagInput.trim())}
                style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: C.teal, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--font-sm)', opacity: (newTagInput.trim() && !availableTags.includes(newTagInput.trim())) ? 1 : 0.5, whiteSpace: 'nowrap' }}
              >
                + Ajouter
              </button>
            </div>
          </div>
        )}

        {/* Mot de passe */}
        <div style={section}>
          <div style={sectionLabel}>Changer le mot de passe</div>

          {[
            { label: 'Mot de passe actuel',  val: oldPwd,     set: setOldPwd,     show: showOld, toggleShow: () => setShowOld(p => !p) },
            { label: 'Nouveau mot de passe', val: newPwd,     set: setNewPwd,     show: showNew, toggleShow: () => setShowNew(p => !p) },
            { label: 'Confirmer le nouveau', val: confirmPwd, set: setConfirmPwd, show: showNew, toggleShow: null },
          ].map((f, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <label className="form-label">{f.label}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={f.show ? 'text' : 'password'}
                  value={f.val}
                  onChange={e => f.set(e.target.value)}
                  placeholder="••••••"
                  style={{ ...inp, paddingRight: f.toggleShow ? 44 : 14 }}
                />
                {f.toggleShow && (
                  <button
                    onClick={f.toggleShow}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.t3, padding: 0, display: 'flex', alignItems: 'center' }}
                  >
                    {f.show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={savePassword}
            disabled={savingPwd || !oldPwd || !newPwd || !confirmPwd}
            style={{ width: '100%', padding: 13, border: 'none', borderRadius: 12, background: C.teal, color: '#fff', fontWeight: 700, fontSize: 'var(--font-sm)', cursor: 'pointer', fontFamily: 'inherit', opacity: (savingPwd || !oldPwd || !newPwd || !confirmPwd) ? 0.6 : 1 }}
          >
            {savingPwd ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </div>

        {/* Déconnexion */}
        <button
          onClick={() => signOut(auth)}
          style={{ width: '100%', padding: 13, border: `1.5px solid ${C.coralD}`, borderRadius: 12, background: C.coralD, color: C.coral, fontWeight: 700, fontSize: 'var(--font-sm)', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
