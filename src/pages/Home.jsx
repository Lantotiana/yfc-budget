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
  { path: '/dashboard', Icon: LayoutDashboard, label: 'Tableau de bord', desc: 'Vue globale',          color: '#2563eb' },
  { path: '/budget',    Icon: Wallet,          label: 'Budget YFC',      desc: 'Entrées & dépenses',   color: '#10b981' },
  { path: '/presences', Icon: CalendarCheck,   label: 'Présences',       desc: 'Suivi Alimbavaka',     color: '#7c3aed' },
  { path: '/membres',   Icon: Users,           label: 'Membres',         desc: 'Liste des membres',    color: '#f43f5e' },
  { path: '/evenements',Icon: CalendarDays,    label: 'Événements',      desc: 'Agenda YFC',           color: '#f59e0b' },
  { path: '/documents', Icon: FolderOpen,      label: 'Documents',       desc: 'Ressources partagées', color: '#06b6d4' },
]

const dailyVerses = [
  { text: "L'Éternel est mon berger: je ne manquerai de rien.", ref: 'Psaume 23:1' },
  { text: 'Je puis tout par celui qui me fortifie.', ref: 'Philippiens 4:13' },
  { text: 'Ta parole est une lampe à mes pieds, et une lumière sur mon sentier.', ref: 'Psaume 119:105' },
  { text: "Recommande ton sort à l'Éternel, mets en lui ta confiance, et il agira.", ref: 'Psaume 37:5' },
  { text: 'Ne crains rien, car je suis avec toi.', ref: 'Ésaïe 41:10' },
  { text: 'Que tout ce que vous faites se fasse avec amour.', ref: '1 Corinthiens 16:14' },
  { text: "L'Éternel combattra pour vous; et vous, gardez le silence.", ref: 'Exode 14:14' },
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

  const initials = (userData?.nom || user?.email || '?').slice(0, 2).toUpperCase()
  const dailyVerse = dailyVerses[Math.floor(Date.now() / 86400000) % dailyVerses.length]
  const currentHour = new Date().getHours()
  const isNight = currentHour >= 18 || currentHour < 6

  return (
    <div className="page-container sin" style={{ paddingBottom: 'calc(86px + env(safe-area-inset-bottom))', background: C.bg }}>
      {/* Header */}
      <div className="f1" style={{ padding: '20px 20px 24px', paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Avatar */}
          <div
            onClick={() => navigate('/parametres')}
            style={{
              width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
              background: C.surf2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 19, fontWeight: 700, color: '#fff', cursor: 'pointer',
              overflow: 'hidden',
              boxShadow: C.shadow,
            }}
          >
            {userData?.photoURL
              ? <img src={userData.photoURL} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials
            }
          </div>

          {/* Greeting */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: C.t2, marginBottom: 2 }}>Bonjour</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.t1, lineHeight: 1.1, letterSpacing: '-.4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {prenom}
            </div>
            <div style={{ fontSize: 10, color: C.t2, fontWeight: 700, letterSpacing: '1px', marginTop: 2, textTransform: 'uppercase' }}>
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

      {/* Daily verse */}
      <div className="f2" style={{ padding: '0 20px 16px' }}>
        <div className={`daily-verse-card ${isNight ? 'night' : 'day'}`}>
          <div className="daily-sky">
            <div className="daily-stars" />
            <div className="daily-sun" />
            <div className="daily-cloud daily-cloud-one" />
            <div className="daily-cloud daily-cloud-two" />
            <div className="daily-hill daily-hill-back" />
            <div className="daily-hill daily-hill-front" />
          </div>
          <div className="daily-verse-content">
            <div className="daily-verse-label">Verset du jour</div>
            <div className="daily-verse-text">“{dailyVerse.text}”</div>
            <div className="daily-verse-ref">{dailyVerse.ref}</div>
          </div>
        </div>
      </div>

      {/* Modules grid */}
      <div className="f3" style={{ padding: '0 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {modules.map((m, i) => (
              <button
                key={m.path}
                className={`f${i + 1}`}
                onClick={() => navigate(m.path)}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(.96)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onTouchStart={e => e.currentTarget.style.transform = 'scale(.96)'}
                onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
                style={{
                  background: m.color,
                  border: '0',
                  borderRadius: 20,
                  padding: '18px 16px',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform .15s',
                  textAlign: 'left',
                  boxShadow: `0 14px 30px ${m.color}33`,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: 'radial-gradient(circle at 12px 12px, rgba(255,255,255,.24) 0 2px, transparent 2.5px), linear-gradient(135deg, rgba(255,255,255,.16) 0 1px, transparent 1px)',
                    backgroundSize: '28px 28px, 18px 18px',
                    opacity: .55,
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
                  <m.Icon size={18} color="#fff" />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3, lineHeight: 1.3, position: 'relative' }}>{m.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.78)', position: 'relative' }}>{m.desc}</div>
              </button>
          ))}
        </div>
      </div>

{showAdmin && <Admin onClose={() => setShowAdmin(false)} />}
    </div>
  )
}
