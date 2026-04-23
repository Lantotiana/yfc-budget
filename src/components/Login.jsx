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
  const [inscriptionReussie, setInscriptionReussie] = useState(false)
  const [nomInscrit, setNomInscrit] = useState('')

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
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await setDoc(doc(db, 'users', cred.user.uid), {
        nom: nom.trim(),
        email: email.trim(),
        approuve: false,
        dateInscription: new Date().toISOString().slice(0, 10)
      })
      await signOut(auth)
      setNomInscrit(nom.trim().split(' ')[0])
      setInscriptionReussie(true)
    } catch(e) {
      if (e.code === 'auth/email-already-in-use') setMessage('Cet email est déjà utilisé.')
      else if (e.code === 'auth/weak-password') setMessage('Mot de passe trop court (minimum 6 caractères).')
      else setMessage('Erreur lors de la création du compte.')
    }
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

  if (inscriptionReussie) return (
    <div style={{minHeight:'100vh', background:'#1a1040', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem'}}>
      <div style={{width:'100%', maxWidth:'400px', textAlign:'center'}}>

        <div style={{marginBottom:'2rem'}}>
          <div style={{width:'80px', height:'80px', borderRadius:'50%', background:'rgba(94,234,212,0.15)', border:'2px solid #5eead4', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px', fontSize:'36px'}}>
            🕊️
          </div>
          <div style={{fontSize:'11px', fontWeight:'600', color:'#5eead4', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:'12px'}}>
            Demande envoyée
          </div>
          <h1 style={{fontSize:'26px', fontWeight:'700', color:'white', lineHeight:1.3, marginBottom:'12px'}}>
            Merci {nomInscrit},<br/>
            <span style={{color:'#5eead4'}}>nous avons bien reçu<br/>votre demande !</span>
          </h1>
        </div>

        <div style={{background:'rgba(255,255,255,0.06)', borderRadius:'20px', padding:'1.5rem', marginBottom:'1.5rem', textAlign:'left'}}>
          <div style={{display:'flex', gap:'14px', alignItems:'flex-start', marginBottom:'16px'}}>
            <div style={{width:'32px', height:'32px', borderRadius:'50%', background:'rgba(94,234,212,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'14px'}}>
              ✅
            </div>
            <div>
              <div style={{fontSize:'13px', fontWeight:'600', color:'white', marginBottom:'3px'}}>Compte créé avec succès</div>
              <div style={{fontSize:'12px', color:'rgba(255,255,255,0.45)', lineHeight:1.5}}>Vos informations ont bien été enregistrées dans notre système.</div>
            </div>
          </div>

          <div style={{display:'flex', gap:'14px', alignItems:'flex-start', marginBottom:'16px'}}>
            <div style={{width:'32px', height:'32px', borderRadius:'50%', background:'rgba(94,234,212,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'14px'}}>
              ⏳
            </div>
            <div>
              <div style={{fontSize:'13px', fontWeight:'600', color:'white', marginBottom:'3px'}}>En attente d'approbation</div>
              <div style={{fontSize:'12px', color:'rgba(255,255,255,0.45)', lineHeight:1.5}}>L'administrateur va examiner votre demande et l'approuver très prochainement.</div>
            </div>
          </div>

          <div style={{display:'flex', gap:'14px', alignItems:'flex-start'}}>
            <div style={{width:'32px', height:'32px', borderRadius:'50%', background:'rgba(94,234,212,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'14px'}}>
              📧
            </div>
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
            <div style={{padding:'10px 14px', borderRadius:'10px', marginBottom:'12px', fontSize:'12px', background:'rgba(251,158,160,0.15)', color:'#fb9ea0'}}>
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