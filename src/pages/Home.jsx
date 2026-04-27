import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../auth'
import Admin from '../components/Admin'
import { ADMIN_EMAIL } from '../constants'
import { LogOut, Settings, ChevronRight, Wallet, CalendarCheck, Users, CalendarDays } from 'lucide-react'

function getPrenom(fullName) {
  if (!fullName) return null
  return fullName.trim().split(' ')[0]
}

const modules = [
  { path: '/budget',      Icon: Wallet,        label: 'Budget',               desc: 'Entrées, dépenses & solde',       color: '#5eead4' },
  { path: '/presences',   Icon: CalendarCheck, label: 'Présence Alimbavaka',  desc: 'Suivi des présences aux cultes',  color: '#a78bfa' },
  { path: '/membres',     Icon: Users,         label: 'Membres',              desc: 'Gestion de la liste des membres', color: '#fb923c' },
  { path: '/evenements',  Icon: CalendarDays,  label: 'Événements',           desc: 'Agenda & suivi des événements',   color: '#38bdf8' },
]

export default function Home({ user, userData }) {
  const navigate = useNavigate()
  const [showAdmin, setShowAdmin] = useState(false)
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
      <div style={{background:'var(--hero-bg)', padding:'1rem', paddingTop:'max(1rem, env(safe-area-inset-top))'}}>
        <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
          <div style={avatarStyle} onClick={() => navigate('/parametres')}>
            {userData?.photoURL
              ? <img src={userData.photoURL} alt="avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} />
              : (userData?.nom || user?.email || '?').slice(0, 2).toUpperCase()
            }
          </div>

          <div style={{flex:1, minWidth:0}}>
            <h1 style={{margin:0, fontSize:'17px', fontWeight:'700', color:'#fff', lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
              Bonjour, <span style={{color:'#5eead4'}}>{prenom}</span>
            </h1>
            <p style={{margin:0, fontSize:'11px', color:'rgba(255,255,255,0.45)', marginTop:'2px'}}>Young For Christ</p>
          </div>

          <div style={{display:'flex', gap:'6px', alignItems:'center', flexShrink:0}}>
            {user.email === ADMIN_EMAIL && (
              <button
                onClick={() => setShowAdmin(true)}
                style={{background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'10px', padding:'7px 10px', cursor:'pointer', color:'#fff', fontSize:'11px', fontWeight:'700', fontFamily:'inherit'}}
              >
                Admin
              </button>
            )}
            <button
              onClick={() => navigate('/parametres')}
              style={{background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'10px', padding:'8px', cursor:'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center'}}
              title="Paramètres"
            >
              <Settings size={17} />
            </button>
            <button
              onClick={() => signOut(auth)}
              style={{background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'10px', padding:'8px', cursor:'pointer', color:'rgba(255,255,255,0.7)', display:'flex', alignItems:'center', justifyContent:'center'}}
              title="Déconnexion"
            >
              <LogOut size={17} />
            </button>
          </div>
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
              flexShrink:0,
            }}>
              <m.Icon size={24} color={m.color} />
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:'15px', fontWeight:'700', color:'var(--text-primary)', marginBottom:'2px'}}>
                {m.label}
              </div>
              <div style={{fontSize:'12px', color:'var(--text-secondary)'}}>
                {m.desc}
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-muted)" style={{flexShrink:0}} />
          </button>
        ))}
      </div>

      {/* Footer */}
      <div style={{position:'fixed', bottom:0, left:0, right:0, textAlign:'center', padding:'10px 1rem', paddingBottom:'max(10px, env(safe-area-inset-bottom))', color:'var(--text-muted)', fontSize:'11px', background:'var(--bg-body)'}}>
        Young For Christ · Tanora ho an'i Kristy · {new Date().getFullYear()}
      </div>

      {showAdmin && <Admin onClose={() => setShowAdmin(false)} />}
    </div>
  )
}
