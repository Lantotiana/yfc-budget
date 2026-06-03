import { useState } from 'react'
import { auth } from '../auth'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { db } from '../firebase'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { Eye, EyeOff } from 'lucide-react'
import PendingScreen from './PendingScreen'
import { createNotification } from '../notifications'
import { ADMIN_EMAIL } from '../constants'
import { useTranslation } from 'react-i18next'
import logoYfc from '../assets/logo_yfc.png'

const hero = '/hero.webp'

export default function Login({ onLoginSuccess }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nom, setNom] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('error')
  const [loading, setLoading] = useState(false)
  const [inscriptionReussie, setInscriptionReussie] = useState(false)
  const [nomInscrit, setNomInscrit] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  function showMsg(msg, type = 'error') {
    setMessage(msg)
    setMessageType(type)
  }

  async function verifyApprovedUser(currentUser) {
    if ((currentUser.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      return true
    }

    let snap
    try {
      snap = await getDoc(doc(db, 'users', currentUser.uid))
    } catch (e) {
      console.error('Erreur verification utilisateur:', e.code, e.message)
      await signOut(auth).catch(() => {})
      showMsg(`Connexion réussie, mais impossible de vérifier l'approbation du compte (${e.code || 'erreur inconnue'}). Réessayez ou contactez l'administrateur.`)
      return false
    }
    if (!snap.exists()) {
      await signOut(auth).catch(() => {})
      showMsg(t('login.errorAccountNotFound'))
      return false
    }
    if (snap.data().approuve !== true) {
      await signOut(auth).catch(() => {})
      showMsg(t('login.errorPendingApproval'))
      return false
    }
    return true
  }

  async function handleLogin() {
    const emailValue = email.trim()
    if (!emailValue || !password) {
      showMsg(t('login.errorInvalidCredentials'))
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const cred = await signInWithEmailAndPassword(auth, emailValue, password)
      const approved = await verifyApprovedUser(cred.user)
      if (approved) await onLoginSuccess?.(cred.user)
    } catch (e) {
      console.error('Erreur login:', e.code, e.message)
      if (e.code === 'auth/too-many-requests') {
        showMsg('Trop de tentatives. Réessayez dans quelques minutes ou utilisez “mot de passe oublié”.')
      } else if (e.code === 'auth/network-request-failed') {
        showMsg('Connexion réseau impossible. Vérifiez Internet puis réessayez.')
      } else {
        showMsg(t('login.errorInvalidCredentials'))
      }
    }
    setLoading(false)
  }

  async function handleRegister() {
    if (!nom.trim()) { showMsg(t('login.errorNameRequired')); return }
    if (!email.trim()) { showMsg(t('login.errorEmailRequired')); return }
    if (password.length < 6) { showMsg(t('login.errorPasswordTooShort')); return }
    setLoading(true)
    setMessage('')

    // Étape 1 : créer le compte Auth
    let cred
    try {
      cred = await createUserWithEmailAndPassword(auth, email, password)
    } catch(e) {
      if (e.code === 'auth/email-already-in-use') {
        // L'email existe déjà dans Auth — peut-être supprimé par l'admin (doc Firestore absent)
        // On tente une connexion pour vérifier
        try {
          const existing = await signInWithEmailAndPassword(auth, email, password)
          const snap = await getDoc(doc(db, 'users', existing.user.uid))
          if (snap.exists()) {
            // Doc présent : vrai compte existant
            await signOut(auth)
            if (snap.data().approuve === false) {
              showMsg(t('login.errorPendingAlready'))
            } else {
              showMsg(t('login.errorEmailInUse'))
            }
          } else {
            // Doc absent : compte supprimé par admin → on recycle l'uid
            cred = existing
            // Continuer vers l'étape 2 (setDoc)
          }
        } catch {
          await signOut(auth).catch(() => {})
          showMsg(t('login.errorEmailInUse'))
        }
        if (!cred) { setLoading(false); return }
      } else if (e.code === 'auth/weak-password') {
        showMsg(t('login.errorPasswordTooShort'))
        setLoading(false)
        return
      } else {
        showMsg(t('login.errorAccountCreation'))
        setLoading(false)
        return
      }
    }

    // Étape 2 : écrire dans Firestore avec timeout (réseau mobile instable)
    const userData = {
      nom: nom.trim(),
      email: email.trim(),
      approuve: false,
      dateInscription: new Date().toISOString().slice(0, 10)
    }

    const writeWithTimeout = () => Promise.race([
      setDoc(doc(db, 'users', cred.user.uid), userData),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000))
    ])

    let firestoreOk = false
    for (let attempt = 0; attempt < 3 && !firestoreOk; attempt++) {
      try {
        await writeWithTimeout()
        firestoreOk = true
      } catch {
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000))
      }
    }

    if (!firestoreOk) {
      await cred.user.delete().catch(() => {})
      showMsg(t('login.errorSlowConnection'), false)
      setLoading(false)
      return
    }

    // Succès — afficher l'écran de confirmation puis déconnecter
    await createNotification({
      type: 'admin',
      titre: t('notifications.approbationDemande'),
      detail: `${userData.nom} - ${userData.email}`,
      cible: cred.user.uid,
      route: '/admin',
      targetUserEmail: ADMIN_EMAIL,
      metadata: { source: 'approval-request' },
    })

    setNomInscrit(nom.trim().split(' ')[0])
    setInscriptionReussie(true)
    setLoading(false)
    signOut(auth)
  }

 async function handleForgotPassword() {
  if (!forgotEmail.trim()) {
    showMsg(t('login.errorEmailRequired'))
    return
  }
  setForgotLoading(true)
  setMessage('')
  try {
    await sendPasswordResetEmail(auth, forgotEmail.trim())
    setForgotSent(true)
  } catch(e) {
    console.error('Erreur reset password:', e.code, e.message)
    if (e.code === 'auth/user-not-found') {
      showMsg(t('login.errorUserNotFound'))
    } else if (e.code === 'auth/invalid-email') {
      showMsg(t('login.errorInvalidEmail'))
    } else if (e.code === 'auth/too-many-requests') {
      showMsg(t('login.errorTooManyRequests'))
    } else {
      showMsg(t('common.error') + ' : ' + e.code)
    }
  }
  setForgotLoading(false)
}

  if (inscriptionReussie) return (
    <PendingScreen
      nom={nomInscrit}
      onBack={() => { setInscriptionReussie(false); setMode('login'); setEmail(''); setPassword(''); setNom('') }}
    />
  )

  if (showForgot) return (
    <div className="login-page login-centered">
      <div className="login-container" style={{ maxWidth: '360px' }}>

        <div className="text-center mb-16">
          <div className="w-56-h-56 rounded-50 m-0-auto-16 overflow-hidden">
            <img src="/Yfc_icone.png" alt="YFC" className="w-h-full object-cover" />
          </div>
          <h1 className="text-22 font-700 text-white leading-tight mb-8">
            {t('login.forgotTitle')}
          </h1>
          <p className="text-13" style={{color:'rgba(255,255,255,0.4)'}}>
            {t('login.forgotSubtitle')}
          </p>
        </div>

        <div className="rounded-20 p-12" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {forgotSent ? (
            <div className="text-center">
              <div className="flex-center mb-16"><Mail size={36} color="#5eead4" /></div>
              <div className="text-15 font-700 mb-8" style={{color:'#5eead4'}}>{t('login.forgotSent')}</div>
              <div className="text-13 mb-16" style={{color:'rgba(255,255,255,0.5)', lineHeight:1.6, marginBottom:'24px'}}>
                {t('login.forgotSentDesc')}
              </div>
              <button
                onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail('') }}
                className="login-btn-primary"
              >
                {t('login.backToLogin')}
              </button>
            </div>
          ) : (
            <>
              {message && (
                <div className="login-alert login-alert-error">
                  {message}
                </div>
              )}
              <label className="login-label">{t('login.forgotEmailLabel')}</label>
              <input
                type="email"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                placeholder={t('login.emailPlaceholder')}
                className="login-input"
                style={{marginBottom:'16px'}}
              />
              <button
                onClick={handleForgotPassword}
                disabled={forgotLoading}
                className="login-btn-primary mb-12"
                style={{opacity: forgotLoading ? 0.7 : 1}}
              >
                {forgotLoading ? t('login.forgotSending') : t('login.forgotSendBtn')}
              </button>
              <button
                onClick={() => { setShowForgot(false); setMessage('') }}
                className="login-btn-back"
              >
                {t('login.backBtn')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="login-page">
      <div className="login-shell">
        <div className="login-hero" style={{ backgroundImage: `url(${hero})` }}>
          <div className="login-hero-overlay" />
          <div className="login-hero-inner">
            <p className="login-hero-subtitle">{t('login.subtitle')}</p>
            <h1 className="login-hero-title">
              {t('login.title')}
              <span className="login-verified-badge" aria-label="Vérifié" />
            </h1>
          </div>
        </div>

        <div className="login-container" style={{ maxWidth: '360px' }}>
          <div className="login-form-logo">
            <img src={logoYfc} alt="YFC" />
          </div>
          <div className="rounded-20 p-12 login-form-card">

          <div className="login-tab-row" data-active={mode}>
            <button onClick={() => { setMode('login'); setMessage('') }} className={`login-tab ${mode === 'login' ? 'login-tab-active' : ''}`}>
              {t('login.tabLogin')}
            </button>
            <button onClick={() => { setMode('register'); setMessage('') }} className={`login-tab ${mode === 'register' ? 'login-tab-active' : ''}`}>
              {t('login.tabRegister')}
            </button>
          </div>

          {mode === 'register' && (
            <div>
              <label className="login-label">{t('login.fullName')}</label>
              <input value={nom} onChange={e => setNom(e.target.value)} placeholder={t('login.namePlaceholder')} className="login-input" />
            </div>
          )}

          <label className="login-label">{t('login.email')}</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('login.emailPlaceholder')} className="login-input" />

          <label className="login-label">{t('login.password')}</label>
          <div className="relative mb-4">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••"
              className="login-input"
              style={{marginBottom:0, paddingRight:'44px'}}
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="login-eye-btn"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {mode === 'login' && (
            <div className="mb-14" style={{textAlign:'right'}}>
              <button
                onClick={() => { setShowForgot(true); setForgotEmail(email); setMessage('') }}
                className="login-forgot-btn"
              >
                {t('login.forgotPassword')}
              </button>
            </div>
          )}

          {message && (
            <div className={`login-alert ${messageType === 'success' ? 'login-alert-success' : 'login-alert-error'}`}>
              {message}
            </div>
          )}

          <button
            onClick={mode === 'login' ? handleLogin : handleRegister}
            disabled={loading}
            className="login-btn-primary"
            style={{opacity: loading ? 0.7 : 1, marginTop: mode === 'register' ? '4px' : '0'}}
          >
            {loading ? t('login.loadingBtn') : mode === 'login' ? t('login.loginBtn') : t('login.registerBtn')}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}
