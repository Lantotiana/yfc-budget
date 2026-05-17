import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import {
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react'
import { auth } from '../../auth'
import { ADMIN_EMAIL } from '../../constants'
import { normalizeAccessText } from '../../utils/access'
import logoYfc from '../../assets/logo_yfc.png'

const adminRoles = ['president', 'vice president', 'vice-president', 'responsable financier', 'tresorier', 'admin']

const baseItems = [
  { path: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { path: '/membres', label: 'Membres', Icon: Users },
  { path: '/budget', label: 'Budget', Icon: Wallet },
  { path: '/presences', label: 'Présences', Icon: CalendarCheck },
  { path: '/evenements', label: 'Événements', Icon: CalendarDays },
  { path: '/tasks', label: 'Tâches', Icon: ClipboardList },
  { path: '/documents', label: 'Documents et matériels', Icon: FileText },
  { path: '/parametres', label: 'Paramètres', Icon: Settings },
]

export default function DesktopSidebar({ user, currentMember, compact = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const role = normalizeAccessText(currentMember?.staffRole)
  const canAdmin = user?.email === ADMIN_EMAIL || adminRoles.includes(role)
  const items = canAdmin ? [...baseItems, { path: '/admin', label: 'Administration', Icon: ShieldCheck }] : baseItems
  const activeIndex = Math.max(0, items.findIndex(item => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)))

  const [visualCompact, setVisualCompact] = useState(compact)
  const [textHidden, setTextHidden] = useState(compact)
  const [expanding, setExpanding] = useState(false)
  const t1 = useRef(null), t2 = useRef(null), t3 = useRef(null)

  useEffect(() => {
    clearTimeout(t1.current)
    clearTimeout(t2.current)
    clearTimeout(t3.current)
    if (compact) {
      setVisualCompact(true)
      setTextHidden(true)
      setExpanding(false)
    } else {
      // Étape 1 : laisser le ::before glisser vers la nouvelle icône
      t1.current = setTimeout(() => {
        setVisualCompact(false)
        setExpanding(true)
        // Étape 2 : textes apparaissent en cours d'élargissement
        t2.current = setTimeout(() => {
          setTextHidden(false)
          t3.current = setTimeout(() => setExpanding(false), 200)
        }, 100)
      }, 50)
    }
    return () => { clearTimeout(t1.current); clearTimeout(t2.current); clearTimeout(t3.current) }
  }, [compact])

  async function logout() {
    await signOut(auth)
    navigate('/login', { replace: true })
  }

  return (
    <aside className={`desktop-sidebar${visualCompact ? ' compact' : ''}${textHidden ? ' text-hidden' : ''}${expanding ? ' is-expanding' : ''}`}>
      <div className="desktop-brand">
        <div className="desktop-brand-mark">
          <img src={logoYfc} alt="YFC" />
        </div>
        <div>
          <strong>Young For Christ</strong>
          <span>Back-office Staff</span>
        </div>
      </div>

      <nav className="desktop-nav" aria-label="Navigation desktop" style={{ '--active-index': activeIndex }}>
        {items.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `desktop-nav-item${isActive ? ' active' : ''}`}
          >
            <item.Icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <button type="button" className="desktop-logout" onClick={logout}>
        <LogOut size={18} />
        <span>Déconnexion</span>
      </button>
    </aside>
  )
}
