import { useState } from 'react'
import { auth } from '../auth'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth'
import { db } from '../firebase'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { Eye, EyeOff, CheckCircle, Clock, Mail } from 'lucide-react'

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

  const inp = {
    width: '100%',
    padding: '11px 14px',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    fontFamily: 'inherit',
    outline: 'none',
    marginBottom: '12px'
  }

  if (inscriptionReussie) return (
    <div className="login-page">
      <div className="login-container">
        <div className="mb-16">
          <div className="success-icon">
            <img src="/Yfc_icone.png" alt="YFC" className="w-h-full object-cover" />
          </div>
          <div style={{fontSize:'11px', fontWeight:'600', color:'#5eead4', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:'12px'}}>
            Demande envoyée
          </div>
          <h1 style={{fontSize:'26px', fontWeight:'700', color:'white', lineHeight:1.3, marginBottom:'12px'}}>
            Merci {nomInscrit},<br/>
            <span style={{color:'#5eead4'}}>nous avons bien reçu<br/>votre demande !</span>
          </h1>
        </div>

        <div className="success-message">
          <div className="success-message-item">
            <div className="icon-circle-32 bg-teal-15"><CheckCircle size={16} color="#5eead4" /></div>
            <div>
              <div style={{fontSize:'13px', fontWeight:'600', color:'white', marginBottom:'3px'}}>Compte créé avec succès</div>
              <div style={{fontSize:'12px', color:'rgba(255,255,255,0.45)', lineHeight:1.5}}>Vos informations ont bien été enregistrées dans notre système.</div>
            </div>
          </div>
          <div className="success-message-item">
            <div className="icon-circle-32 bg-teal-15"><Clock size={16} color="#5eead4" /></div>
            <div>
              <div style={{fontSize:'13px', fontWeight:'600', color:'white', marginBottom:'3px'}}>En attente d'approbation</div>
              <div style={{fontSize:'12px', color:'rgba(255,255,255,0.45)', lineHeight:1.5}}>L'administrateur va examiner votre demande et l'approuver très prochainement.</div>
            </div>
          </div>
          <div style={{display:'flex', gap:'14px', alignItems:'flex-start'}}>
            <div style={{width:'32px', height:'32px', borderRadius:'50%', background:'rgba(94,234,212,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}><Mail size={16} color="#5eead4" /></div>
            <div>
              <div style={{fontSize:'13px', fontWeight:'600', color:'white', marginBottom:'3px'}}>Notification par email</div>
              <div style={{fontSize:'12px', color:'rgba(255,255,255,0.45)', lineHeight:1.5}}>Vous recevrez un email dès que votre compte sera approuvé.</div>
            </div>
          </div>
        </div>

        <div style={{background:'rgba(94,234,212,0.08)', border:'1px solid rgba(94,234,212,0.2)', borderRadius:'14px', padding:'14px 18px', marginBottom:'1.5rem'}}>
          <p style={{fontSize:'13px', color:'rgba(255,255,255,0.6)', margin:0, lineHeight:1.6}}>
            <span style={{color:'#5eead4', fontWeight:'600'}}>Que Dieu vous bénisse !</span><br/>
            L'équipe Young For Christ vous accueille chaleureusement.
          </p>
        </div>

        <button
          onClick={() => { setInscriptionReussie(false); setMode('login'); setEmail(''); setPassword(''); setNom('') }}
          style={{width:'100%', padding:'13px', fontWeight:'700', fontSize:'14px', cursor:'pointer', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.7)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'12px', fontFamily:'inherit'}}
        >
          Retour à la connexion
        </button>
      </div>
    </div>
  )

  if (showForgot) return (
    <div style={{minHeight:'100vh', background:'#1a1040', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem'}}>
      <div style={{width:'100%', maxWidth:'360px'}}>

        <div style={{textAlign:'center', marginBottom:'2rem'}}>
          <div style={{width:'56px', height:'56px', borderRadius:'50%', overflow:'hidden', margin:'0 auto 16px'}}>
            <img src="/Yfc_icone.png" alt="YFC" style={{width:'100%', height:'100%', objectFit:'cover'}} />
          </div>
          <h1 style={{fontSize:'22px', fontWeight:'700', color:'#fff', lineHeight:1.2, marginBottom:'8px'}}>
            Mot de passe<br/><span style={{color:'#5eead4'}}>oublié ?</span>
          </h1>
          <p style={{fontSize:'13px', color:'rgba(255,255,255,0.4)'}}>
            On va vous envoyer un lien de réinitialisation
          </p>
        </div>

        <div style={{background:'rgba(255,255,255,0.06)', borderRadius:'20px', padding:'1.5rem'}}>
          {forgotSent ? (
            <div style={{textAlign:'center'}}>
              <div style={{marginBottom:'16px', display:'flex', justifyContent:'center'}}><Mail size={36} color="#5eead4" /></div>
              <div style={{fontSize:'15px', fontWeight:'700', color:'#5eead4', marginBottom:'8px'}}>Email envoyé !</div>
              <div style={{fontSize:'13px', color:'rgba(255,255,255,0.5)', lineHeight:1.6, marginBottom:'24px'}}>
                Vérifiez votre boîte mail et cliquez sur le lien pour réinitialiser votre mot de passe.
              </div>
              <button
                onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail('') }}
                style={{width:'100%', padding:'13px', fontWeight:'700', fontSize:'14px', cursor:'pointer', background:'#5eead4', color:'#1a1040', border:'none', borderRadius:'12px', fontFamily:'inherit'}}
              >
                Retour à la connexion
              </button>
            </div>
          ) : (
            <>
              {message && (
                <div style={{padding:'10px 14px', borderRadius:'10px', marginBottom:'12px', fontSize:'12px', background:'rgba(251,158,160,0.15)', color:'#fb9ea0'}}>
                  {message}
                </div>
              )}
              <label style={{fontSize:'11px', color:'rgba(255,255,255,0.5)', display:'block', marginBottom:'4px', fontWeight:'600'}}>Votre email</label>
              <input
                type="email"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                placeholder="ton@email.com"
                style={{...inp, marginBottom:'16px'}}
              />
              <button
                onClick={handleForgotPassword}
                disabled={forgotLoading}
                style={{width:'100%', padding:'13px', fontWeight:'700', fontSize:'14px', cursor:'pointer', background:'#5eead4', color:'#1a1040', border:'none', borderRadius:'12px', fontFamily:'inherit', opacity: forgotLoading ? 0.7 : 1, marginBottom:'12px'}}
              >
                {forgotLoading ? 'Envoi...' : 'Envoyer le lien'}
              </button>
              <button
                onClick={() => { setShowForgot(false); setMessage('') }}
                style={{width:'100%', padding:'11px', fontWeight:'600', fontSize:'13px', cursor:'pointer', background:'transparent', color:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'12px', fontFamily:'inherit'}}
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
    <div style={{minHeight:'100vh', background:'#1a1040', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem'}}>
      <div style={{width:'100%', maxWidth:'360px'}}>

        <div style={{textAlign:'center', marginBottom:'2rem'}}>
          <div style={{width:'56px', height:'56px', borderRadius:'50%', overflow:'hidden', margin:'0 auto 16px'}}>
            <img src="/Yfc_icone.png" alt="YFC" style={{width:'100%', height:'100%', objectFit:'cover'}} />
          </div>
          <div style={{fontSize:'11px', fontWeight:'600', color:'#5eead4', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:'8px'}}>
            Tanora ho an'i Kristy
          </div>
          <h1 style={{fontSize:'28px', fontWeight:'700', color:'#fff', lineHeight:1.2, marginBottom:'8px'}}>
            Gestion<br/><span style={{color:'#5eead4'}}>Budget</span>
          </h1>
          <p style={{fontSize:'13px', color:'rgba(255,255,255,0.4)'}}>
            Finances de l'association YFC
          </p>
        </div>

        <div style={{background:'rgba(255,255,255,0.06)', borderRadius:'20px', padding:'1.5rem'}}>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', background:'rgba(255,255,255,0.08)', borderRadius:'12px', padding:'3px', marginBottom:'1.5rem'}}>
            <button onClick={() => { setMode('login'); setMessage('') }} style={{padding:'9px', border:'none', cursor:'pointer', fontWeight:'700', fontSize:'13px', borderRadius:'9px', fontFamily:'inherit', background: mode==='login' ? '#2d1f6e' : 'transparent', color: mode==='login' ? '#fff' : 'rgba(255,255,255,0.4)'}}>
              Connexion
            </button>
            <button onClick={() => { setMode('register'); setMessage('') }} style={{padding:'9px', border:'none', cursor:'pointer', fontWeight:'700', fontSize:'13px', borderRadius:'9px', fontFamily:'inherit', background: mode==='register' ? '#2d1f6e' : 'transparent', color: mode==='register' ? '#fff' : 'rgba(255,255,255,0.4)'}}>
              Inscription
            </button>
          </div>

          {mode === 'register' && (
            <div>
              <label style={{fontSize:'11px', color:'rgba(255,255,255,0.5)', display:'block', marginBottom:'4px', fontWeight:'600'}}>Nom complet</label>
              <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ton nom..." style={inp} />
            </div>
          )}

          <label style={{fontSize:'11px', color:'rgba(255,255,255,0.5)', display:'block', marginBottom:'4px', fontWeight:'600'}}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ton@email.com" style={inp} />

          <label style={{fontSize:'11px', color:'rgba(255,255,255,0.5)', display:'block', marginBottom:'4px', fontWeight:'600'}}>Mot de passe</label>
          <div style={{position:'relative', marginBottom:'4px'}}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••"
              style={{...inp, marginBottom:0, paddingRight:'44px'}}
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              style={{position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.4)', padding:'0', display:'flex', alignItems:'center'}}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {mode === 'login' && (
            <div style={{textAlign:'right', marginBottom:'14px'}}>
              <button
                onClick={() => { setShowForgot(true); setForgotEmail(email); setMessage('') }}
                style={{background:'none', border:'none', cursor:'pointer', color:'rgba(94,234,212,0.7)', fontSize:'12px', fontFamily:'inherit', padding:0}}
              >
                Mot de passe oublié ?
              </button>
            </div>
          )}

          {message && (
            <div style={{padding:'10px 14px', borderRadius:'10px', marginBottom:'12px', fontSize:'12px', background: messageType === 'success' ? 'rgba(94,234,212,0.15)' : 'rgba(251,158,160,0.15)', color: messageType === 'success' ? '#5eead4' : '#fb9ea0'}}>
              {message}
            </div>
          )}

          <button
            onClick={mode === 'login' ? handleLogin : handleRegister}
            disabled={loading}
            style={{width:'100%', padding:'13px', fontWeight:'700', fontSize:'14px', cursor:'pointer', background:'#5eead4', color:'#1a1040', border:'none', borderRadius:'12px', fontFamily:'inherit', opacity: loading ? 0.7 : 1, marginTop: mode === 'register' ? '4px' : '0'}}
          >
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </div>
      </div>
    </div>
  )
}