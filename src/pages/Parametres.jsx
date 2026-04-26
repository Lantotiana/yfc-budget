import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../auth'
import { db } from '../firebase'
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, updateEmail } from 'firebase/auth'
import { doc, updateDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { useTheme } from '../context/ThemeContext'

const CLOUDINARY_CLOUD = 'dvtyebpmr'
const CLOUDINARY_PRESET = 'yfc_avatars'

export default function Parametres({ user, userData, setUserData }) {
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()
  const fileRef = useRef()

  const [nom, setNom] = useState(userData?.nom || '')
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoURL, setPhotoURL] = useState(userData?.photoURL || '')
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

  async function saveProfile() {
    if (!nom.trim()) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), { nom: nom.trim(), photoURL })
      setUserData(prev => ({ ...prev, nom: nom.trim(), photoURL }))
      flash('Profil mis à jour !')
    } catch {
      flash('Erreur lors de la sauvegarde.', false)
    }
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
        flash('Photo mise à jour !')
      } else {
        flash('Erreur upload photo.', false)
      }
    } catch {
      flash('Erreur upload photo.', false)
    }
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
      flash('Mot de passe modifié !')
    } catch(e) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        flash('Mot de passe actuel incorrect.', false)
      } else {
        flash('Erreur : ' + e.message, false)
      }
    }
    setSavingPwd(false)
  }

  const inp = {
    width: '100%',
    padding: '11px 14px',
    border: '1.5px solid var(--border-input)',
    borderRadius: '12px',
    fontSize: '14px',
    background: 'var(--input-bg)',
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const card = {
    background: 'var(--card-bg)',
    borderRadius: '16px',
    padding: '1.25rem',
    marginBottom: '12px',
  }

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-body)'}}>
      {/* Header */}
      <div style={{background:'var(--hero-bg)', padding:'1rem 1rem 1.5rem', paddingTop:'max(1rem, env(safe-area-inset-top))'}}>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
          <button
            onClick={() => navigate('/')}
            style={{background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'10px', padding:'8px 12px', cursor:'pointer', color:'#fff', fontSize:'16px', fontFamily:'inherit', flexShrink:0}}
          >
            ‹
          </button>
          <h1 style={{margin:0, fontSize:'18px', fontWeight:'700', color:'#fff', flex:1}}>Paramètres</h1>
        </div>
      </div>

      <div style={{padding:'1rem'}}>
        {msg.text && (
          <div style={{padding:'10px 14px', borderRadius:'12px', marginBottom:'12px', fontSize:'13px', fontWeight:'600', background: msg.ok ? 'rgba(94,234,212,0.15)' : 'rgba(251,158,160,0.15)', color: msg.ok ? '#5eead4' : '#fb9ea0'}}>
            {msg.text}
          </div>
        )}

        {/* Appearance */}
        <div style={card}>
          <div style={{fontSize:'11px', fontWeight:'700', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'12px'}}>
            Apparence
          </div>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:'14px', fontWeight:'600', color:'var(--text-primary)'}}>Mode sombre</div>
              <div style={{fontSize:'12px', color:'var(--text-secondary)'}}>
                {dark ? 'Activé' : 'Désactivé'}
              </div>
            </div>
            <button
              onClick={toggle}
              style={{
                width:'52px', height:'28px', borderRadius:'14px', border:'none', cursor:'pointer', padding:0,
                background: dark ? '#5eead4' : 'var(--border-input)',
                position:'relative', transition:'background 0.2s',
              }}
            >
              <span style={{
                position:'absolute', top:'3px',
                left: dark ? '27px' : '3px',
                width:'22px', height:'22px', borderRadius:'50%',
                background:'#fff',
                transition:'left 0.2s',
                display:'block',
              }} />
            </button>
          </div>
        </div>

        {/* Profile */}
        <div style={card}>
          <div style={{fontSize:'11px', fontWeight:'700', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'12px'}}>
            Profil
          </div>

          {/* Avatar */}
          <div style={{display:'flex', alignItems:'center', gap:'14px', marginBottom:'16px'}}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{width:'60px', height:'60px', borderRadius:'50%', background:'var(--input-bg)', overflow:'hidden', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', fontSize:'18px', color:'var(--text-primary)', flexShrink:0, border:'2px solid var(--border-input)'}}
            >
              {uploadingPhoto ? '...' : photoURL
                ? <img src={photoURL} alt="avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} />
                : (nom || user?.email || '?').slice(0, 2).toUpperCase()
              }
            </div>
            <div>
              <div style={{fontSize:'13px', fontWeight:'600', color:'var(--text-primary)', marginBottom:'2px'}}>Photo de profil</div>
              <button
                onClick={() => fileRef.current?.click()}
                style={{fontSize:'12px', color:'#5eead4', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit'}}
              >
                {uploadingPhoto ? 'Envoi en cours...' : 'Modifier la photo'}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{display:'none'}} />
          </div>

          <div style={{marginBottom:'12px'}}>
            <label style={{fontSize:'11px', fontWeight:'600', color:'var(--text-secondary)', display:'block', marginBottom:'4px'}}>Nom complet</label>
            <input type="text" value={nom} onChange={e => setNom(e.target.value)} placeholder="Ton nom" style={inp} />
          </div>

          <div style={{marginBottom:'16px'}}>
            <label style={{fontSize:'11px', fontWeight:'600', color:'var(--text-secondary)', display:'block', marginBottom:'4px'}}>Email</label>
            <input type="email" value={user?.email || ''} disabled style={{...inp, opacity:0.5, cursor:'not-allowed'}} />
          </div>

          <button
            onClick={saveProfile}
            disabled={saving || !nom.trim()}
            style={{width:'100%', padding:'13px', border:'none', borderRadius:'12px', background:'var(--btn-primary-bg)', color:'#fff', fontWeight:'700', fontSize:'14px', cursor:'pointer', fontFamily:'inherit', opacity: (saving || !nom.trim()) ? 0.6 : 1}}
          >
            {saving ? 'Enregistrement...' : 'Sauvegarder le profil'}
          </button>
        </div>

        {/* Password */}
        <div style={card}>
          <div style={{fontSize:'11px', fontWeight:'700', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'12px'}}>
            Changer le mot de passe
          </div>

          {[
            { label: 'Mot de passe actuel', val: oldPwd, set: setOldPwd, show: showOld, toggleShow: () => setShowOld(p=>!p) },
            { label: 'Nouveau mot de passe', val: newPwd, set: setNewPwd, show: showNew, toggleShow: () => setShowNew(p=>!p) },
            { label: 'Confirmer le nouveau', val: confirmPwd, set: setConfirmPwd, show: showNew, toggleShow: null },
          ].map((f, i) => (
            <div key={i} style={{marginBottom:'12px'}}>
              <label style={{fontSize:'11px', fontWeight:'600', color:'var(--text-secondary)', display:'block', marginBottom:'4px'}}>{f.label}</label>
              <div style={{position:'relative'}}>
                <input
                  type={f.show ? 'text' : 'password'}
                  value={f.val}
                  onChange={e => f.set(e.target.value)}
                  placeholder="••••••"
                  style={{...inp, paddingRight: f.toggleShow ? '44px' : '14px'}}
                />
                {f.toggleShow && (
                  <button onClick={f.toggleShow} style={{position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'15px', padding:0, lineHeight:1}}>
                    {f.show ? '🙈' : '👁️'}
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={savePassword}
            disabled={savingPwd || !oldPwd || !newPwd || !confirmPwd}
            style={{width:'100%', padding:'13px', border:'none', borderRadius:'12px', background:'var(--btn-primary-bg)', color:'#fff', fontWeight:'700', fontSize:'14px', cursor:'pointer', fontFamily:'inherit', opacity: (savingPwd || !oldPwd || !newPwd || !confirmPwd) ? 0.6 : 1}}
          >
            {savingPwd ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={() => signOut(auth)}
          style={{width:'100%', padding:'13px', border:'1.5px solid rgba(190,18,60,0.3)', borderRadius:'12px', background:'rgba(190,18,60,0.08)', color:'#be123c', fontWeight:'700', fontSize:'14px', cursor:'pointer', fontFamily:'inherit'}}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
