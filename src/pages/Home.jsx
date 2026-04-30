import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Bell, CalendarCheck, CalendarDays, FolderOpen, LayoutDashboard, Settings, Users, Wallet } from 'lucide-react'
import Admin from '../components/Admin'
import { ADMIN_EMAIL } from '../constants'
import { db } from '../firebase'
import { useTheme } from '../context/ThemeContext'

function getPrenom(fullName) {
  if (!fullName) return null
  return fullName.trim().split(' ')[0]
}

const modules = [
  { path: '/dashboard', Icon: LayoutDashboard, label: 'Tableau de bord', desc: 'Vue globale',           col: 'amber',  ik: 'stats' },
  { path: '/budget',    Icon: Wallet,           label: 'Budget YFC',      desc: 'Entrées & dépenses',    col: 'teal',   ik: 'budget' },
  { path: '/presences', Icon: CalendarCheck,    label: 'Présences',        desc: 'Suivi Alimbavaka',      col: 'violet', ik: 'presence' },
  { path: '/membres',   Icon: Users,            label: 'Membres',          desc: 'Liste des membres',     col: 'coral',  ik: 'membres' },
  { path: '/evenements',Icon: CalendarDays,     label: 'Événements',       desc: 'Agenda YFC',            col: 'amber',  ik: 'events' },
  { path: '/documents', Icon: FolderOpen,       label: 'Documents',        desc: 'Ressources partagées',  col: 'teal',   ik: 'docs' },
]

export default function Home({ user, userData }) {
  const navigate = useNavigate()
  const { C } = useTheme()
  const [showAdmin, setShowAdmin] = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const prenom = getPrenom(userData?.nom) || user?.email?.split('@')[0]

  useEffect(() => {
    if (!user?.uid) return
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(20))
    return onSnapshot(q, snap => {
      const unread = snap.docs.filter(d => {
        const readBy = d.data().readBy || []
        return !readBy.includes(user.uid)
      })
      setNotifCount(unread.length)
    }, () => setNotifCount(0))
  }, [user?.uid])

  function getModColor(col) {
    return { amber: C.amber, teal: C.teal, violet: C.violet, coral: C.coral }[col]
  }
  function getModBg(col) {
    return { amber: C.amberD, teal: C.tealD, violet: C.violetD, coral: C.coralD }[col]
  }

  const initials = (userData?.nom || user?.email || '?').slice(0, 2).toUpperCase()

  return (
    <div className="page-container sin" style={{ paddingBottom: 'calc(86px + env(safe-area-inset-bottom))', background: C.bg }}>
      {/* Header */}
      <div className="f1" style={{ padding: '20px 20px 24px', paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Avatar */}
          <div
            onClick={() => navigate('/parametres')}
            style={{
              width: 52, height: 52, borderRadius: 18, flexShrink: 0,
              background: `linear-gradient(135deg, ${C.amber}, ${C.teal})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 19, fontWeight: 700, color: '#fff', cursor: 'pointer',
              overflow: 'hidden',
              boxShadow: `0 8px 24px ${C.amberD.replace('0.13','0.4').replace('0.12','0.4')}`,
            }}
          >
            {userData?.photoURL
              ? <img src={userData.photoURL} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials
            }
          </div>

          {/* Greeting */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: C.t2, marginBottom: 2 }}>Bonjour 👋</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.t1, lineHeight: 1.1, letterSpacing: '-.4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {prenom}
            </div>
            <div style={{ fontSize: 10, color: C.amber, fontWeight: 600, letterSpacing: '1px', marginTop: 2, textTransform: 'uppercase' }}>
              Young For Christ
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            {user.email === ADMIN_EMAIL && (
              <button
                onClick={() => setShowAdmin(true)}
                style={{ height: 40, padding: '0 12px', borderRadius: 14, border: `1px solid ${C.bord}`, background: C.surf, color: C.t2, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
              >
                Admin
              </button>
            )}

            {/* Notifications */}
            <button
              onClick={() => navigate('/notifications')}
              style={{ width: 40, height: 40, borderRadius: 14, border: `1px solid ${C.bord}`, background: C.surf, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.t2, position: 'relative' }}
              aria-label="Notifications"
            >
              <Bell size={17} />
              {notifCount > 0 && (
                <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999, background: C.coral, color: '#fff', border: `2px solid ${C.bg}`, fontSize: 9, fontWeight: 800, lineHeight: '13px', textAlign: 'center' }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>

            {/* Paramètres */}
            <button
              onClick={() => navigate('/parametres')}
              style={{ width: 40, height: 40, borderRadius: 14, border: `1px solid ${C.bord}`, background: C.surf, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.t2 }}
              aria-label="Paramètres"
            >
              <Settings size={17} />
            </button>
          </div>
        </div>
      </div>

      {/* Modules grid */}
      <div className="f2" style={{ padding: '0 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.t3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 14 }}>Modules</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {modules.map((m, i) => {
            const col = getModColor(m.col)
            const bg  = getModBg(m.col)
            return (
              <button
                key={m.path}
                className={`f${i + 1}`}
                onClick={() => navigate(m.path)}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(.96)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onTouchStart={e => e.currentTarget.style.transform = 'scale(.96)'}
                onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
                style={{
                  background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 20,
                  padding: '18px 16px', cursor: 'pointer', position: 'relative', overflow: 'hidden',
                  transition: 'transform .15s', textAlign: 'left',
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: col, borderRadius: '0 0 4px 4px' }} />
                <div style={{ width: 38, height: 38, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <m.Icon size={18} color={col} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 3, lineHeight: 1.3 }}>{m.label}</div>
                <div style={{ fontSize: 11, color: C.t2 }}>{m.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

{showAdmin && <Admin onClose={() => setShowAdmin(false)} />}
    </div>
  )
}
