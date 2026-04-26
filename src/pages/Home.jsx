import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../auth'

function getPrenom(fullName) {
  if (!fullName) return null
  return fullName.trim().split(' ')[0]
}

const modules = [
  {
    path: '/budget',
    icon: '💰',
    label: 'Budget',
    desc: 'Entrées, dépenses & solde',
    color: '#5eead4',
  },
  {
    path: '/presences',
    icon: '✅',
    label: 'Présence Alimbavaka',
    desc: 'Suivi des présences aux cultes',
    color: '#a78bfa',
  },
  {
    path: '/membres',
    icon: '👥',
    label: 'Membres',
    desc: 'Gestion de la liste des membres',
    color: '#fb923c',
  },
]

export default function Home({ user, userData }) {
  const navigate = useNavigate()
  const prenom = getPrenom(userData?.nom) || user?.email?.split('@')[0]

  const avatarStyle = {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    background: '#5eead4',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '13px',
    color: '#1a1040',
    flexShrink: 0,
    overflow: 'hidden',
    cursor: 'pointer',
    border: userData?.photoURL ? '2px solid #5eead4' : 'none',
  }

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-body)'}}>
      {/* Header */}
      <div style={{background:'var(--hero-bg)', padding:'1rem 1rem 1.5rem', paddingTop:'max(1rem, env(safe-area-inset-top))'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem'}}>
          <div style={avatarStyle} onClick={() => navigate('/parametres')}>
            {userData?.photoURL
              ? <img src={userData.photoURL} alt="avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} />
              : (userData?.nom || user?.email || '?').slice(0, 2).toUpperCase()
            }
          </div>

          <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
            <button
              onClick={() => navigate('/parametres')}
              style={{background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'10px', padding:'8px 10px', cursor:'pointer', color:'#fff', fontSize:'16px', fontFamily:'inherit'}}
              title="Paramètres"
            >
              ⚙
            </button>
            <button
              onClick={() => signOut(auth)}
              style={{background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'10px', padding:'8px 12px', cursor:'pointer', color:'rgba(255,255,255,0.7)', fontSize:'12px', fontWeight:'600', fontFamily:'inherit'}}
            >
              Déco
            </button>
          </div>
        </div>

        <div>
          <div style={{fontSize:'11px', fontWeight:'600', color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'4px'}}>
            Young For Christ · Tanora ho an'i Kristy
          </div>
          <h1 style={{fontSize:'26px', fontWeight:'700', color:'#fff', lineHeight:1.2, margin:0}}>
            Bonjour, <span style={{color:'#5eead4'}}>{prenom}</span> 👋
          </h1>
        </div>
      </div>

      {/* Module cards */}
      <div style={{padding:'1.5rem 1rem', display:'flex', flexDirection:'column', gap:'12px'}}>
        <div style={{fontSize:'11px', fontWeight:'700', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'4px'}}>
          Modules
        </div>

        {modules.map(m => (
          <button
            key={m.path}
            onClick={() => navigate(m.path)}
            style={{
              display:'flex', alignItems:'center', gap:'16px',
              background:'var(--card-bg)', border:'none', borderRadius:'16px',
              padding:'16px', cursor:'pointer', textAlign:'left', width:'100%',
              boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{
              width:'52px', height:'52px', borderRadius:'14px',
              background:`${m.color}18`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'24px', flexShrink:0,
            }}>
              {m.icon}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:'15px', fontWeight:'700', color:'var(--text-primary)', marginBottom:'2px'}}>
                {m.label}
              </div>
              <div style={{fontSize:'12px', color:'var(--text-secondary)'}}>
                {m.desc}
              </div>
            </div>
            <div style={{color:'var(--text-muted)', fontSize:'18px', flexShrink:0}}>›</div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div style={{textAlign:'center', padding:'0 1rem 2rem', color:'var(--text-muted)', fontSize:'11px'}}>
        YFC Budget · {new Date().getFullYear()}
      </div>
    </div>
  )
}
