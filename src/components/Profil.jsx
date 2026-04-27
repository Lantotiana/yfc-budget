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

  const initiales = (nom || user?.email || '?').slice(0, 2).toUpperCase()

  return (
    <div className="page-container">

      <div style={{background:'var(--hero-bg)', padding:'20px 16px 32px'}}>
        <div className="flex-center gap-12" style={{maxWidth:'480px', margin:'0 auto'}}>
          <button onClick={onBack} className="rounded-10 text-13 text-white border-none cursor-pointer bg-white-10 flex-shrink-0" style={{padding:'8px 12px'}}>
            ← Retour
          </button>
          <h1 className="flex-1 text-16 font-700 text-white">Mon profil</h1>
        </div>

        <div className="flex-col-center mt-20">
          <div className="relative">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="avatar"
                className="w-80-h-80 rounded-50 object-cover flex-shrink-0"
                style={{border:'3px solid #5eead4'}}
              />
            ) : (
              <div className="w-80-h-80 rounded-50 flex-center font-700 text-24 flex-shrink-0" style={{background:'#5eead4', color:'#1a1040'}}>
                {initiales}
              </div>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute flex-center rounded-50 flex-shrink-0 text-14 border-none cursor-pointer"
              style={{bottom:0, right:0, width:'28px', height:'28px', background:'#5eead4', border:'2px solid #2d1f6e', padding:0}}
            >
              {uploading ? '⏳' : '📷'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="none"
            />
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-10 text-12 font-600 mt-12"
            style={{padding:'7px 16px', background:'rgba(94,234,212,0.15)', border:'1px solid rgba(94,234,212,0.3)', color:'#5eead4', cursor:'pointer', opacity: uploading ? 0.7 : 1}}
          >
            {uploading ? 'Upload en cours...' : 'Changer la photo'}
          </button>

          <div className="flex-center gap-6 mt-10">
            <span className="text-20 font-700 text-white">{nom || user?.email}</span>
            <div className="w-15-h-15 rounded-50 flex-center flex-shrink-0" style={{background:'#5eead4'}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#1a1040" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div className="text-12 text-white-50 mt-2">{user?.email}</div>
        </div>
      </div>

      <div style={{maxWidth:'480px', margin:'0 auto', padding:'1.25rem 1rem 2rem'}}>

        {message && (
          <div className="rounded-12 mb-16 text-13 font-500" style={{padding:'12px 16px', background: messageType === 'success' ? '#d4f4ee' : '#fde8e8', color: messageType === 'success' ? '#0f766e' : '#be123c'}}>
            {message}
          </div>
        )}

        <div className="card mb-16">
          <div className="card-title">
            Informations personnelles
          </div>

          <label className="form-label">Nom complet</label>
          <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ton nom..." className="form-input mb-12" />

          <label className="form-label">Adresse email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="form-input" style={{marginBottom:0}} />
        </div>

        <div className="card mb-16">
          <div className="card-title">
            Changer le mot de passe
          </div>

          <label className="form-label">Nouveau mot de passe</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Laisser vide pour ne pas changer" className="form-input mb-12" />

          <label className="form-label">Confirmer le nouveau mot de passe</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••" className="form-input" style={{marginBottom:0}} />
        </div>

        <div className="card mb-16">
          <div className="card-title">
            Confirmation
          </div>
          <label className="form-label">Mot de passe actuel (requis pour sauvegarder)</label>
          <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••" className="form-input" style={{marginBottom:0}} />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="w-full rounded-14 font-700 text-14 text-white border-none cursor-pointer"
          style={{padding:'14px', background:'var(--btn-primary-bg)', opacity: saving || uploading ? 0.7 : 1}}
        >
          {saving ? 'Enregistrement...' : 'Sauvegarder les modifications'}
        </button>
      </div>
    </div>
  )
}
