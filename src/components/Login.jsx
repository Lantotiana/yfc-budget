import { useState } from 'react'
import { auth } from '../auth'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
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
      if (!snap.exists() || !snap.data().approuve) {
        await auth.signOut()
        setMessage('Votre compte est en attente d\'approbation par l\'administrateur.')
      }
    } catch(e) {
      setMessage('Email ou mot de passe incorrect.')
    }
    setLoading(false)
  }

  async function handleRegister() {
    if (!nom.trim()) { setMessage('Veuillez entrer votre nom.'); return }
    setLoading(true)
    setMessage('')
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await setDoc(doc(db, 'users', cred.user.uid), {
        nom,
        email,
        approuve: false,
        dateInscription: new Date().toISOString()
      })
      await auth.signOut()
      setMessage('Compte créé ! En attente d\'approbation par l\'administrateur.')
      setMode('login')
    } catch(e) {
      if (e.code === 'auth/email-already-in-use') setMessage('Cet email est déjà utilisé.')
      else if (e.code === 'auth/weak-password') setMessage('Mot de passe trop court (minimum 6 caractères).')
      else setMessage('Erreur lors de la création du compte.')
    }
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f5f0'}}>
      <div style={{background:'white', border:'1px solid #e5e5e5', borderRadius:'16px', padding:'2rem', width:'360px'}}>
        <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'1.5rem'}}>
          <div style={{width:'44px', height:'44px', borderRadius:'50%', background:'#dbeafe', color:'#1d4ed8', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'600', fontSize:'13px'}}>YFC</div>
          <div>
            <div style={{fontSize:'18px', fontWeight:'600'}}>Gestion Budget</div>
            <div style={{fontSize:'12px', color:'#888'}}>Young For Christ</div>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', border:'1px solid #e5e5e5', borderRadius:'8px', overflow:'hidden', marginBottom:'1.5rem'}}>
          <button onClick={() => setMode('login')} style={{padding:'9px', border:'none', cursor:'pointer', fontWeight:'600', fontSize:'13px', background: mode==='login' ? '#dbeafe' : 'white', color: mode==='login' ? '#1d4ed8' : '#888'}}>Connexion</button>
          <button onClick={() => setMode('register')} style={{padding:'9px', border:'none', cursor:'pointer', fontWeight:'600', fontSize:'13px', background: mode==='register' ? '#dbeafe' : 'white', color: mode==='register' ? '#1d4ed8' : '#888'}}>Inscription</button>
        </div>

        {mode === 'register' && (
          <div style={{marginBottom:'12px'}}>
            <label style={{fontSize:'12px', color:'#666', display:'block', marginBottom:'4px'}}>Nom complet</label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ton nom..." style={{width:'100%', padding:'8px 10px', border:'1px solid #e5e5e5', borderRadius:'8px', fontSize:'14px', color:'#1a1a1a'}} />
          </div>
        )}

        <div style={{marginBottom:'12px'}}>
          <label style={{fontSize:'12px', color:'#666', display:'block', marginBottom:'4px'}}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ton@email.com" style={{width:'100%', padding:'8px 10px', border:'1px solid #e5e5e5', borderRadius:'8px', fontSize:'14px', color:'#1a1a1a'}} />
        </div>

        <div style={{marginBottom:'1rem'}}>
          <label style={{fontSize:'12px', color:'#666', display:'block', marginBottom:'4px'}}>Mot de passe</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" style={{width:'100%', padding:'8px 10px', border:'1px solid #e5e5e5', borderRadius:'8px', fontSize:'14px', color:'#1a1a1a'}} />
        </div>

        {message && (
          <div style={{padding:'10px', borderRadius:'8px', marginBottom:'1rem', fontSize:'13px', background: message.includes('attente') ? '#dcfce7' : '#fee2e2', color: message.includes('attente') ? '#16a34a' : '#dc2626'}}>
            {message}
          </div>
        )}

        <button
          onClick={mode === 'login' ? handleLogin : handleRegister}
          disabled={loading}
          style={{width:'100%', padding:'10px', fontWeight:'600', fontSize:'14px', cursor:'pointer', background:'#dbeafe', color:'#1d4ed8', border:'1px solid #bfdbfe', borderRadius:'8px', opacity: loading ? 0.7 : 1}}
        >
          {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </button>
      </div>
    </div>
  )
}