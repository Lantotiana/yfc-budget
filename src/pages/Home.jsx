import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Admin from '../components/Admin'
import { ADMIN_EMAIL } from '../constants'
import { Settings, ChevronRight, Wallet, CalendarCheck, Users, CalendarDays, LayoutDashboard } from 'lucide-react'

function getPrenom(fullName) {
  if (!fullName) return null
  return fullName.trim().split(' ')[0]
}

const modules = [
  { path: '/dashboard',  Icon: LayoutDashboard, label: 'Tableau de bord',    desc: 'Budget, membres & événements',   bg: '#4338CA' },
  { path: '/budget',     Icon: Wallet,          label: 'Budget YFC',          desc: 'Entrées, dépenses & solde',      bg: '#5B4FCF' },
  { path: '/presences',  Icon: CalendarCheck,   label: 'Présence Alimbavaka', desc: 'Suivi des présences aux cultes', bg: '#2EC4A9' },
  { path: '/membres',    Icon: Users,           label: 'Membres',             desc: 'Gestion de la liste des membres',bg: '#2F80ED' },
  { path: '/evenements', Icon: CalendarDays,    label: 'Événements',          desc: 'Agenda & suivi des événements',  bg: '#E8445A' },
]

export default function Home({ user, userData }) {
  const navigate = useNavigate()
  const [showAdmin, setShowAdmin] = useState(false)
  const prenom = getPrenom(userData?.nom) || user?.email?.split('@')[0]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-body)' }}>

      {/* Header */}
      <div style={{
        background: 'var(--card-bg)',
        padding: '1.25rem 1rem',
        paddingTop: 'max(1.25rem, env(safe-area-inset-top))',
        borderBottom: '1px solid var(--border-light)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            onClick={() => navigate('/parametres')}
            style={{
              width: '46px', height: '46px', borderRadius: '50%',
              background: '#5B4FCF', flexShrink: 0, overflow: 'hidden',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: '700', fontSize: '15px', color: '#fff',
              border: userData?.photoURL ? '2px solid #5B4FCF' : 'none',
            }}
          >
            {userData?.photoURL
              ? <img src={userData.photoURL} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (userData?.nom || user?.email || '?').slice(0, 2).toUpperCase()
            }
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>Bonjour,</div>
            <div style={{ fontSize: '19px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {prenom}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            {user.email === ADMIN_EMAIL && (
              <button
                onClick={() => setShowAdmin(true)}
                style={{ background: 'rgba(91,79,207,0.1)', border: 'none', borderRadius: '10px', padding: '7px 10px', cursor: 'pointer', color: '#5B4FCF', fontSize: '11px', fontWeight: '700', fontFamily: 'inherit' }}
              >
                Admin
              </button>
            )}
            <button
              onClick={() => navigate('/parametres')}
              style={{ background: 'var(--input-bg)', border: 'none', borderRadius: '10px', padding: '9px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Module cards */}
      <div style={{ padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '2px' }}>
          Modules
        </div>

        {modules.map(m => (
          <button
            key={m.path}
            onClick={() => navigate(m.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              background: m.bg,
              border: 'none', borderRadius: '18px',
              padding: '16px', cursor: 'pointer', textAlign: 'left', width: '100%',
              boxShadow: `0 4px 18px ${m.bg}50`,
              transition: 'opacity 0.15s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <m.Icon size={24} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '2px' }}>
                {m.label}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)' }}>
                {m.desc}
              </div>
            </div>
            <ChevronRight size={20} color="rgba(255,255,255,0.5)" style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        padding: '0.5rem 1rem',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        color: 'var(--text-muted)',
        fontSize: '11px',
      }}>
        Young For Christ · Tanora ho an'i Kristy · {new Date().getFullYear()}
      </div>

      {showAdmin && <Admin onClose={() => setShowAdmin(false)} />}
    </div>
  )
}
