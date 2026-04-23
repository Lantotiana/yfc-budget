import { useState } from 'react'
import { auth } from '../auth'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { db } from '../firebase'
import { doc, setDoc, getDoc } from 'firebase/firestore'

export default function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nom, setNom] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    setMessage('')
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const snap = await getDoc(doc(db, 'users', cred.user.uid))
      if (!snap.exists()) {
        await signOut(auth)
        setMessage('Compte introuvable. Veuillez vous inscrire.')
      } else if (snap.data().approuve !== true) {
        await signOut(auth)
        setMessage('Votre compte est en attente d\'approbation par l\'administrateur.')
      }
    } catch(e) {
      setMessage('Email ou mot de passe incorrect.')
    }
    setLoading(false)
  }

  async function handleRegister() {
  if (!nom.trim()) { setMessage('Veuillez entrer votre nom.'); return }
  if (!email.trim()) { setMessage('Veuillez entrer votre email.'); return }
  if (password.length < 6) { setMessage('Mot de passe trop court (minimum 6 caractères).'); return }

  setLoading(true)
  setMessage('')

  let cred = null
  try {
    cred = await createUserWithEmailAndPassword(auth, email, password)
  } catch(e) {
    if (e.code === 'auth/email-already-in-use') setMessage('Cet email est déjà utilisé.')
    else if (e.code === 'auth/weak-password') setMessage('Mot de passe trop court (minimum 6 caractères).')
    else setMessage('Erreur lors de la création du compte : ' + e.message)
    setLoading(false)
    return
  }

  try {
    await setDoc(doc(db, 'users', cred.user.uid), {
      nom: nom.trim(),
      email: email.trim(),
      approuve: false,
      dateInscription: new Date().toISOString().slice(0, 10)
    })
  } catch(e) {
    setMessage('Erreur Firestore : ' + e.message)
    setLoading(false)
    return
  }

  await signOut(auth)
  setMessage('Compte créé ! En attente d\'approbation par l\'administrateur.')
  setMode('login')
  setEmail('')
  setPassword('')
  setNom('')
  setLoading(false)
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

  return (
    <div style={{minHeight:'100vh', background:'#1a1040', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem'}}>
      <div style={{width:'100%', maxWidth:'360px'}}>

        <div style={{textAlign:'center', marginBottom:'2rem'}}>
          <div style={{width:'56px', height:'56px', borderRadius:'50%', background:'#5eead4', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', fontSize:'14px', color:'#1a1040', margin:'0 auto 16px'}}>
            YFC
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
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" style={{...inp, marginBottom: message ? '12px' : '0'}} />

          {message && (
            <div style={{padding:'10px 14px', borderRadius:'10px', marginBottom:'12px', fontSize:'12px', background: message.includes('attente') || message.includes('créé') ? 'rgba(94,234,212,0.15)' : 'rgba(251,158,160,0.15)', color: message.includes('attente') || message.includes('créé') ? '#5eead4' : '#fb9ea0'}}>
              {message}
            </div>
          )}

          <button
            onClick={mode === 'login' ? handleLogin : handleRegister}
            disabled={loading}
            style={{width:'100%', padding:'13px', fontWeight:'700', fontSize:'14px', cursor:'pointer', background:'#5eead4', color:'#1a1040', border:'none', borderRadius:'12px', fontFamily:'inherit', opacity: loading ? 0.7 : 1, marginTop:'4px'}}
          >
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </div>
      </div>
    </div>
  )
}