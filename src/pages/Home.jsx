import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import Admin from '../components/Admin'
import { db } from '../firebase'
import { ADMIN_EMAIL } from '../constants'
import { Bell, Settings, ChevronRight, Wallet, CalendarCheck, Users, CalendarDays, LayoutDashboard, FolderOpen } from 'lucide-react'

function getPrenom(fullName) {
  if (!fullName) return null
  return fullName.trim().split(' ')[0]
}

const modules = [
  { path: '/dashboard',  Icon: LayoutDashboard, label: 'Tableau de bord',          desc: 'Budget, membres & événements',   bg: '#4338CA' },
  { path: '/budget',     Icon: Wallet,          label: 'Budget YFC',                desc: 'Entrées, dépenses & solde',      bg: '#5B4FCF' },
  { path: '/presences',  Icon: CalendarCheck,   label: 'Présence Alimbavaka',       desc: 'Suivi des présences aux cultes', bg: '#2EC4A9' },
  { path: '/membres',    Icon: Users,           label: 'Membres',                   desc: 'Gestion de la liste des membres',bg: '#2F80ED' },
  { path: '/evenements', Icon: CalendarDays,    label: 'Événements',                desc: 'Agenda & suivi des événements',  bg: '#E8445A' },
  { path: '/documents',  Icon: FolderOpen,      label: 'Documents indispensables',  desc: 'Fichiers & ressources partagés', bg: '#7C3AED' },
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
    <div className="page-container" style={{ paddingBottom: '3rem' }}>

      {/* Header Facebook style */}
      <div style={{background: 'var(--bg-body)', paddingTop: 'env(safe-area-inset-top)', position: 'relative'}}>
        {/* Boutons haut droite */}
        <div className="absolute flex-center gap-6" style={{ top: 'max(1rem, env(safe-area-inset-top))', right: '1rem', zIndex: 10 }}>
          {user.email === ADMIN_EMAIL && (
            <button
              onClick={() => setShowAdmin(true)}
              className="rounded-10 text-11 font-700 cursor-pointer flex-center"
              style={{ background: 'transparent', border: '1.5px solid var(--input-bg)', padding: '9px 10px', color: 'var(--input-bg)' }}
            >
              Admin
            </button>
          )}
          <button
            onClick={() => navigate('/notifications')}
            className="home-icon-btn"
            aria-label="Notifications"
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
            aria-label="Parametres"
          >
            <Settings size={18} />
          </button>
        </div>

        {/* Cover image */}
        <div style={{height: '110px', background: 'linear-gradient(135deg, #5B4FCF 0%, #4338CA 100%)', position: 'relative'}} />

        {/* Avatar qui chevauche */}
        <div className="relative flex-col-center" style={{paddingBottom: '1.5rem', paddingTop: '-40px', marginTop: '-50px'}}>
          <div
            onClick={() => navigate('/parametres')}
            className="w-90-h-90 rounded-50 flex-center font-700 text-28 text-white cursor-pointer overflow-hidden flex-shrink-0"
            style={{background: '#5B4FCF', border: '4px solid var(--card-bg)', boxShadow: 'var(--card-shadow)'}}
          >
            {userData?.photoURL
              ? <img src={userData.photoURL} alt="avatar" className="w-h-full object-cover" />
              : (userData?.nom || user?.email || '?').slice(0, 2).toUpperCase()
            }
          </div>

          {/* Texte centré */}
          <div className="text-center mt-16">
            <div className="text-13 text-secondary font-500">Bonjour,</div>
            <div className="text-24 font-700 text-primary leading-tight">
              {prenom}
            </div>
          </div>
        </div>
      </div>

      {/* Module cards */}
      <div style={{ padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {modules.map(m => (
          <button
            key={m.path}
            onClick={() => navigate(m.path)}
            className="flex-center gap-14 border-none rounded-18 p-16 cursor-pointer text-left w-full transition-opacity"
            style={{
              background: m.bg,
              boxShadow: `0 4px 18px ${m.bg}50`,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div className="w-48-h-48 rounded-14 flex-center flex-shrink-0" style={{background: 'rgba(255,255,255,0.18)'}}>
              <m.Icon size={24} color="#fff" />
            </div>
            <div className="flex-1-min">
              <div className="text-15 font-700 text-white mb-2">
                {m.label}
              </div>
              <div className="text-12 text-white-65">
                {m.desc}
              </div>
            </div>
            <ChevronRight size={20} color="rgba(255,255,255,0.5)" style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>

      {/* Footer sticky bas */}
      <div className="fixed bottom-0 left-0 right-0 text-center text-11 text-muted" style={{padding: '0.6rem 1rem', paddingBottom: 'max(0.6rem, env(safe-area-inset-bottom))', background: 'var(--bg-body)', borderTop: '1px solid var(--border-light)'}}>
        Young For Christ · Tanora ho an'i Kristy · {new Date().getFullYear()}
      </div>

      {showAdmin && <Admin onClose={() => setShowAdmin(false)} />}
    </div>
  )
}
