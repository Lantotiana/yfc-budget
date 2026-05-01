import { useState, useRef, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { auth } from '../auth'
import { db } from '../firebase'
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { useTheme } from '../context/ThemeContext'
import { createNotification } from '../notifications'
import { sameEmail } from '../utils/access'

const CLOUDINARY_CLOUD = 'dtthz84ie'
const CLOUDINARY_PRESET = 'yfc_profiles'

export default function Parametres({ user, userData, setUserData }) {
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
    fontSize: 14, background: C.surf2, color: C.t1,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }

  const section = {
    background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16,
    padding: '1.25rem', marginBottom: 12,
  }

  const sectionLabel = {
    fontSize: 11, fontWeight: 700, color: C.t3,
    textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14,
  }

  const roleLabel = memberRole.staffRole || (memberRole.staff ? 'Staff sans rôle attribué' : 'Membre')

  return (
    <div className="page-container-locked sin" style={{ background: C.bg }}>

      {/* Header */}
      <div className="textured-page-header" style={{ '--header-color': '#64748b', padding: '20px 20px 16px', paddingTop: 'max(20px, env(safe-area-inset-top))', borderBottom: `1px solid ${C.bord}`, flexShrink: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>Paramètres</div>
      </div>

      <div className="page-content" style={{ padding: '16px 20px', paddingBottom: 'max(5rem, env(safe-area-inset-bottom))' }}>

        {/* Flash */}
        {msg.text && (
          <div style={{ padding: '10px 14px', borderRadius: 12, marginBottom: 12, fontSize: 13, fontWeight: 600, background: msg.ok ? C.tealD : C.coralD, color: msg.ok ? C.teal : C.coral }}>
            {msg.text}
          </div>
        )}

        {/* Apparence */}
        <div style={section}>
          <div style={sectionLabel}>Apparence</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>Mode sombre</div>
              <div style={{ fontSize: 12, color: C.t2, marginTop: 1 }}>{dark ? 'Activé' : 'Désactivé'}</div>
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
              style={{ width: 64, height: 64, borderRadius: '50%', background: C.surf2, overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20, color: C.t1, flexShrink: 0 }}
            >
              {uploadingPhoto ? '...' : photoURL
                ? <img src={photoURL} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (nom || user?.email || '?').slice(0, 2).toUpperCase()
              }
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 2 }}>Photo de profil</div>
              <button
                onClick={() => fileRef.current?.click()}
                style={{ fontSize: 12, color: C.amber, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: 600 }}
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
            style={{ width: '100%', padding: 13, border: 'none', borderRadius: 12, background: C.teal, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', opacity: (saving || !nom.trim()) ? 0.6 : 1 }}
          >
            {saving ? 'Enregistrement...' : 'Sauvegarder le profil'}
          </button>
        </div>

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
            style={{ width: '100%', padding: 13, border: 'none', borderRadius: 12, background: C.teal, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', opacity: (savingPwd || !oldPwd || !newPwd || !confirmPwd) ? 0.6 : 1 }}
          >
            {savingPwd ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </div>

        {/* Déconnexion */}
        <button
          onClick={() => signOut(auth)}
          style={{ width: '100%', padding: 13, border: `1.5px solid ${C.coralD}`, borderRadius: 12, background: C.coralD, color: C.coral, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
