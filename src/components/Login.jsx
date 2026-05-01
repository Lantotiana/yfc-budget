import { useState } from 'react'
import { auth } from '../auth'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth'
import { db } from '../firebase'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { Eye, EyeOff, CheckCircle, Clock, Mail } from 'lucide-react'
import { createNotification } from '../notifications'
import { ADMIN_EMAIL } from '../constants'

const hero = '/hero.webp'

export default function Login() {
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

  async function handleLogin() {
    setLoading(true)
    setMessage('')
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const snap = await getDoc(doc(db, 'users', cred.user.uid))
      if (!snap.exists()) {
        await signOut(auth)
        showMsg('Compte introuvable. Veuillez vous inscrire.')
      } else if (snap.data().approuve !== true) {
        await signOut(auth)
        showMsg('Votre compte est en attente d\'approbation par l\'administrateur.')
      }
    } catch(e) {
      showMsg('Email ou mot de passe incorrect.')
    }
    setLoading(false)
  }

  async function handleRegister() {
    if (!nom.trim()) { showMsg('Veuillez entrer votre nom.'); return }
    if (!email.trim()) { showMsg('Veuillez entrer votre email.'); return }
    if (password.length < 6) { showMsg('Mot de passe trop court (minimum 6 caractères).'); return }
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
              showMsg('Votre demande est déjà en attente d\'approbation.')
            } else {
              showMsg('Cet email est déjà utilisé. Connectez-vous.')
            }
          } else {
            // Doc absent : compte supprimé par admin → on recycle l'uid
            cred = existing
            // Continuer vers l'étape 2 (setDoc)
          }
        } catch {
          await signOut(auth).catch(() => {})
          showMsg('Cet email est déjà utilisé.')
        }
        if (!cred) { setLoading(false); return }
      } else if (e.code === 'auth/weak-password') {
        showMsg('Mot de passe trop court (minimum 6 caractères).')
        setLoading(false)
        return
      } else {
        showMsg('Erreur lors de la création du compte.')
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
      showMsg('Connexion trop lente. Réessayez avec une meilleure connexion.', false)
      setLoading(false)
      return
    }

    // Succès — afficher l'écran de confirmation puis déconnecter
    await createNotification({
      type: 'admin',
      titre: 'Nouvelle demande d’approbation',
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
    showMsg('Veuillez entrer votre email.')
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
      showMsg('Aucun compte trouvé avec cet email.')
    } else if (e.code === 'auth/invalid-email') {
      showMsg('Email invalide.')
    } else if (e.code === 'auth/too-many-requests') {
      showMsg('Trop de tentatives. Réessayez plus tard.')
    } else {
      showMsg('Erreur : ' + e.code + ' - ' + e.message)
    }
  }
  setForgotLoading(false)
}

  if (inscriptionReussie) return (
    <div className="login-page login-centered">
      <div className="login-container">
        <div className="mb-16">
          <div className="success-icon">
            <img src="/Yfc_icone.png" alt="YFC" className="w-h-full object-cover" />
          </div>
          <div className="login-eyebrow mb-12">
            Demande envoyée
          </div>
          <h1 className="text-26 font-700 text-white mb-12" style={{lineHeight:1.3}}>
            Merci {nomInscrit},<br/>
            <span style={{color:'#5eead4'}}>nous avons bien reçu<br/>votre demande !</span>
          </h1>
        </div>

        <div className="success-message">
          <div className="success-message-item">
            <div className="icon-circle-32 bg-teal-15"><CheckCircle size={16} color="#5eead4" /></div>
            <div>
              <div className="login-msg-title">Compte créé avec succès</div>
              <div className="login-msg-desc">Vos informations ont bien été enregistrées dans notre système.</div>
            </div>
          </div>
          <div className="success-message-item">
            <div className="icon-circle-32 bg-teal-15"><Clock size={16} color="#5eead4" /></div>
            <div>
              <div className="login-msg-title">En attente d'approbation</div>
              <div className="login-msg-desc">L'administrateur va examiner votre demande et l'approuver très prochainement.</div>
            </div>
          </div>
          <div className="flex-start gap-14">
            <div className="icon-circle-32 bg-teal-15"><Mail size={16} color="#5eead4" /></div>
            <div>
              <div className="login-msg-title">Notification par email</div>
              <div className="login-msg-desc">Vous recevrez un email dès que votre compte sera approuvé.</div>
            </div>
          </div>
        </div>

        <div className="login-blessing">
          <p className="text-13" style={{color:'rgba(255,255,255,0.6)', margin:0, lineHeight:1.6}}>
            <span className="font-600" style={{color:'#5eead4'}}>Que Dieu vous bénisse !</span><br/>
            L'équipe Young For Christ vous accueille chaleureusement.
          </p>
        </div>

        <button
          onClick={() => { setInscriptionReussie(false); setMode('login'); setEmail(''); setPassword(''); setNom('') }}
          className="login-btn-secondary"
        >
          Retour à la connexion
        </button>
      </div>
    </div>
  )

  if (showForgot) return (
    <div className="login-page login-centered">
      <div className="login-container" style={{ maxWidth: '360px' }}>

        <div className="text-center mb-16">
          <div className="w-56-h-56 rounded-50 m-0-auto-16 overflow-hidden">
            <img src="/Yfc_icone.png" alt="YFC" className="w-h-full object-cover" />
          </div>
          <h1 className="text-22 font-700 text-white leading-tight mb-8">
            Mot de passe<br/><span style={{color:'#5eead4'}}>oublié ?</span>
          </h1>
          <p className="text-13" style={{color:'rgba(255,255,255,0.4)'}}>
            On va vous envoyer un lien de réinitialisation
          </p>
        </div>

        <div className="rounded-20 p-12" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {forgotSent ? (
            <div className="text-center">
              <div className="flex-center mb-16"><Mail size={36} color="#5eead4" /></div>
              <div className="text-15 font-700 mb-8" style={{color:'#5eead4'}}>Email envoyé !</div>
              <div className="text-13 mb-16" style={{color:'rgba(255,255,255,0.5)', lineHeight:1.6, marginBottom:'24px'}}>
                Vérifiez votre boîte mail et cliquez sur le lien pour réinitialiser votre mot de passe.
              </div>
              <button
                onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail('') }}
                className="login-btn-primary"
              >
                Retour à la connexion
              </button>
            </div>
          ) : (
            <>
              {message && (
                <div className="login-alert login-alert-error">
                  {message}
                </div>
              )}
              <label className="login-label">Votre email</label>
              <input
                type="email"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                placeholder="ton@email.com"
                className="login-input"
                style={{marginBottom:'16px'}}
              />
              <button
                onClick={handleForgotPassword}
                disabled={forgotLoading}
                className="login-btn-primary mb-12"
                style={{opacity: forgotLoading ? 0.7 : 1}}
              >
                {forgotLoading ? 'Envoi...' : 'Envoyer le lien'}
              </button>
              <button
                onClick={() => { setShowForgot(false); setMessage('') }}
                className="login-btn-back"
              >
                ← Retour
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
            <p className="login-hero-subtitle">Young For Christ</p>
            <h1 className="login-hero-title">
              YFC app
              <span className="login-verified-badge" aria-label="Vérifié" />
            </h1>
          </div>
        </div>

        <div className="login-container" style={{ maxWidth: '360px' }}>
          <div className="rounded-20 p-12 login-form-card">

          <div className="login-tab-row">
            <button onClick={() => { setMode('login'); setMessage('') }} className={`login-tab ${mode === 'login' ? 'login-tab-active' : ''}`}>
              Connexion
            </button>
            <button onClick={() => { setMode('register'); setMessage('') }} className={`login-tab ${mode === 'register' ? 'login-tab-active' : ''}`}>
              Inscription
            </button>
          </div>

          {mode === 'register' && (
            <div>
              <label className="login-label">Nom complet</label>
              <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ton nom..." className="login-input" />
            </div>
          )}

          <label className="login-label">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ton@email.com" className="login-input" />

          <label className="login-label">Mot de passe</label>
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
                Mot de passe oublié ?
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
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}
