import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Bell, CalendarCheck, CalendarDays, FolderOpen, LayoutDashboard, Settings, Users, Wallet } from 'lucide-react'
import Admin from '../components/Admin'
import { ADMIN_EMAIL } from '../constants'
import { db } from '../firebase'

function getPrenom(fullName) {
  if (!fullName) return null
  return fullName.trim().split(' ')[0]
}

const modules = [
  { path: '/dashboard', Icon: LayoutDashboard, label: 'Tableau de bord', desc: 'Vue globale', bg: '#4338CA' },
  { path: '/budget', Icon: Wallet, label: 'Budget YFC', desc: 'Entrées, dépenses & solde', bg: '#5B4FCF' },
  { path: '/presences', Icon: CalendarCheck, label: 'Présences', desc: 'Suivi Alimbavaka', bg: '#2EC4A9' },
  { path: '/membres', Icon: Users, label: 'Membres', desc: 'Liste des membres', bg: '#2F80ED' },
  { path: '/evenements', Icon: CalendarDays, label: 'Événements', desc: 'Agenda YFC', bg: '#E8445A' },
  { path: '/documents', Icon: FolderOpen, label: 'Documents', desc: 'Ressources partagées', bg: '#7C3AED' },
]

export default function Home({ user, userData }) {
  const navigate = useNavigate()
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

  return (
    <div className="page-container" style={{ paddingBottom: 'calc(86px + env(safe-area-inset-bottom))' }}>
      <div style={{
        position: 'relative',
        padding: '18px 16px 56px',
        paddingTop: 'max(18px, env(safe-area-inset-top))',
        background: 'linear-gradient(135deg, #5B4FCF 0%, #4338CA 100%)',
        color: '#fff',
      }}>
        <div className="flex-between mb-20">
          <div className="flex-center gap-10">
            <div
              onClick={() => navigate('/parametres')}
              className="rounded-50 flex-center font-700 cursor-pointer overflow-hidden"
              style={{ width: '52px', height: '52px', background: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.34)', color: '#fff', flexShrink: 0 }}
            >
              {userData?.photoURL
                ? <img src={userData.photoURL} alt="avatar" className="w-h-full object-cover" />
                : (userData?.nom || user?.email || '?').slice(0, 2).toUpperCase()
              }
            </div>
            <div className="min-w-0">
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.68)', fontWeight: 600 }}>Bonjour</div>
              <div style={{ fontSize: '22px', fontWeight: 750, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {prenom}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.62)', fontWeight: 600, marginTop: '4px' }}>
                Young For Christ
              </div>
            </div>
          </div>

          <div className="flex-center gap-8">
            {user.email === ADMIN_EMAIL && (
              <button
                onClick={() => setShowAdmin(true)}
                className="border-none cursor-pointer text-11 font-700"
                style={{ height: '36px', padding: '0 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.16)', color: '#fff' }}
              >
                Admin
              </button>
            )}
            <button
              onClick={() => navigate('/notifications')}
              className="home-icon-btn"
              aria-label="Notifications"
              style={{ background: 'rgba(255,255,255,0.16)' }}
            >
              <Bell size={18} />
              {notifCount > 0 && (
                <span className="home-notification-badge">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/parametres')}
              className="home-icon-btn"
              aria-label="Paramètres"
              style={{ background: 'rgba(255,255,255,0.16)' }}
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </div>

      <div style={{
        padding: '16px',
        marginTop: '-32px',
        borderTopLeftRadius: '22px',
        borderTopRightRadius: '22px',
        background: 'var(--bg-body)',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {modules.map(m => (
            <button
              key={m.path}
              onClick={() => navigate(m.path)}
              className="border-none cursor-pointer text-left"
              style={{
                minHeight: '126px',
                borderRadius: '18px',
                padding: '16px',
                background: m.bg,
                color: '#fff',
                boxShadow: `0 10px 24px ${m.bg}42`,
              }}
            >
              <div className="w-42-h-42 rounded-14 flex-center mb-16" style={{ background: 'rgba(255,255,255,0.18)' }}>
                <m.Icon size={23} />
              </div>
              <div style={{ fontSize: '14px', fontWeight: 750, lineHeight: 1.15 }}>{m.label}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.68)', marginTop: '5px', lineHeight: 1.25 }}>{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {showAdmin && <Admin onClose={() => setShowAdmin(false)} />}
    </div>
  )
}
