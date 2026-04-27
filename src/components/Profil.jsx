import { useState, useRef } from 'react'
import { auth } from '../auth'
import { db } from '../firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { updatePassword, updateEmail, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'

const CLOUD_NAME = 'dtthz84ie'
const UPLOAD_PRESET = 'yfc_profiles'

export default function Profil({ user, userData, onBack, onUpdated }) {
  const [nom, setNom] = useState(userData?.nom || '')
  const [email, setEmail] = useState(user?.email || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [photo, setPhoto] = useState(userData?.photoURL || '')
  const [photoPreview, setPhotoPreview] = useState(userData?.photoURL || '')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  function showMsg(msg, type = 'success') {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 4000)
  }

  async function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showMsg('Veuillez choisir une image.', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showMsg('Image trop lourde (maximum 5MB).', 'error')
      return
    }

    setPhotoPreview(URL.createObjectURL(file))
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', UPLOAD_PRESET)
      formData.append('folder', 'yfc_profiles')

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      if (data.secure_url) {
        const url = data.secure_url
        setPhoto(url)
        await updateDoc(doc(db, 'users', user.uid), { photoURL: url })
        onUpdated({ photoURL: url })
        showMsg('Photo mise à jour !')
      } else {
        showMsg('Erreur lors de l\'upload.', 'error')
        setPhotoPreview(photo)
      }
    } catch(e) {
      showMsg('Erreur réseau lors de l\'upload.', 'error')
      setPhotoPreview(photo)
    }
    setUploading(false)
  }

  async function reauth() {
    const cred = EmailAuthProvider.credential(user.email, currentPassword)
    await reauthenticateWithCredential(auth.currentUser, cred)
  }

  async function handleSave() {
    if (!currentPassword) {
      showMsg('Veuillez entrer votre mot de passe actuel pour confirmer.', 'error')
      return
    }
    if (newPassword && newPassword !== confirmPassword) {
      showMsg('Les nouveaux mots de passe ne correspondent pas.', 'error')
      return
    }
    if (newPassword && newPassword.length < 6) {
      showMsg('Le nouveau mot de passe doit faire au moins 6 caractères.', 'error')
      return
    }

    setSaving(true)
    try {
      await reauth()

      await updateDoc(doc(db, 'users', user.uid), {
        nom: nom.trim(),
        photoURL: photo
      })

      if (email !== user.email) {
        await updateEmail(auth.currentUser, email)
        await updateDoc(doc(db, 'users', user.uid), { email: email.trim() })
      }

      if (newPassword) {
        await updatePassword(auth.currentUser, newPassword)
      }

      onUpdated({ nom: nom.trim(), photoURL: photo })
      showMsg('Profil mis à jour avec succès !')
      setNewPassword('')
      setConfirmPassword('')
      setCurrentPassword('')
    } catch(e) {
      if (e.code === 'auth/wrong-password') showMsg('Mot de passe actuel incorrect.', 'error')
      else if (e.code === 'auth/email-already-in-use') showMsg('Cet email est déjà utilisé.', 'error')
      else showMsg('Erreur : ' + e.message, 'error')
    }
    setSaving(false)
  }

  const inp = {
    width: '100%',
    padding: '11px 14px',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    background: 'var(--input-bg)',
    color: 'var(--text-primary)',
    marginBottom: '12px'
  }

  const label = {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    display: 'block',
    marginBottom: '4px'
  }

  const initiales = (nom || user?.email || '?').slice(0, 2).toUpperCase()

  return (
    <div className="page-container">

      <div style={{background:'var(--hero-bg)', padding:'20px 16px 32px'}}>
        <div style={{display:'flex', alignItems:'center', gap:'12px', maxWidth:'480px', margin:'0 auto'}}>
          <button onClick={onBack} style={{background:'rgba(255,255,255,0.1)', border:'none', color:'white', borderRadius:'10px', padding:'8px 12px', cursor:'pointer', fontSize:'13px', fontFamily:'inherit'}}>
            ← Retour
          </button>
          <h1 style={{fontSize:'16px', fontWeight:'700', color:'white', flex:1}}>Mon profil</h1>
        </div>

        <div style={{display:'flex', flexDirection:'column', alignItems:'center', marginTop:'20px'}}>
          <div style={{position:'relative'}}>
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="avatar"
                style={{width:'80px', height:'80px', borderRadius:'50%', objectFit:'cover', border:'3px solid #5eead4'}}
              />
            ) : (
              <div style={{width:'80px', height:'80px', borderRadius:'50%', background:'#5eead4', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', fontSize:'24px', color:'#1a1040'}}>
                {initiales}
              </div>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{position:'absolute', bottom:0, right:0, width:'28px', height:'28px', borderRadius:'50%', background:'#5eead4', border:'2px solid #2d1f6e', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', padding:0}}
            >
              {uploading ? '⏳' : '📷'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{display:'none'}}
            />
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{marginTop:'12px', padding:'7px 16px', background:'rgba(94,234,212,0.15)', border:'1px solid rgba(94,234,212,0.3)', color:'#5eead4', borderRadius:'10px', cursor:'pointer', fontSize:'12px', fontWeight:'600', fontFamily:'inherit', opacity: uploading ? 0.7 : 1}}
          >
            {uploading ? 'Upload en cours...' : 'Changer la photo'}
          </button>

          <div style={{marginTop:'10px', display:'flex', alignItems:'center', gap:'6px'}}>
            <span style={{fontSize:'20px', fontWeight:'700', color:'white'}}>{nom || user?.email}</span>
            <div style={{width:'15px', height:'15px', borderRadius:'50%', background:'#5eead4', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#1a1040" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div style={{fontSize:'12px', color:'rgba(255,255,255,0.5)', marginTop:'2px'}}>{user?.email}</div>
        </div>
      </div>

      <div style={{maxWidth:'480px', margin:'0 auto', padding:'1.25rem 1rem 2rem'}}>

        {message && (
          <div style={{padding:'12px 16px', borderRadius:'12px', marginBottom:'1rem', fontSize:'13px', fontWeight:'500', background: messageType === 'success' ? '#d4f4ee' : '#fde8e8', color: messageType === 'success' ? '#0f766e' : '#be123c'}}>
            {message}
          </div>
        )}

        <div style={{background:'var(--card-bg)', borderRadius:'16px', padding:'1.25rem', marginBottom:'1rem'}}>
          <div style={{fontSize:'10px', fontWeight:'700', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'1rem'}}>
            Informations personnelles
          </div>

          <label style={label}>Nom complet</label>
          <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ton nom..." style={inp} />

          <label style={label}>Adresse email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{...inp, marginBottom:0}} />
        </div>

        <div style={{background:'var(--card-bg)', borderRadius:'16px', padding:'1.25rem', marginBottom:'1rem'}}>
          <div style={{fontSize:'10px', fontWeight:'700', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'1rem'}}>
            Changer le mot de passe
          </div>

          <label style={label}>Nouveau mot de passe</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Laisser vide pour ne pas changer" style={inp} />

          <label style={label}>Confirmer le nouveau mot de passe</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••" style={{...inp, marginBottom:0}} />
        </div>

        <div style={{background:'var(--card-bg)', borderRadius:'16px', padding:'1.25rem', marginBottom:'1.25rem'}}>
          <div style={{fontSize:'10px', fontWeight:'700', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'1rem'}}>
            Confirmation
          </div>
          <label style={label}>Mot de passe actuel (requis pour sauvegarder)</label>
          <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••" style={{...inp, marginBottom:0}} />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || uploading}
          style={{width:'100%', padding:'14px', fontWeight:'700', fontSize:'14px', cursor:'pointer', background:'var(--btn-primary-bg)', color:'white', border:'none', borderRadius:'14px', fontFamily:'inherit', opacity: saving || uploading ? 0.7 : 1}}
        >
          {saving ? 'Enregistrement...' : 'Sauvegarder les modifications'}
        </button>
      </div>
    </div>
  )
}
