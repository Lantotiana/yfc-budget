import { useSearchParams } from 'react-router-dom'
import { Bell, KeyRound, Link2, Moon, ShieldCheck, Tag, User } from 'lucide-react'
import { ADMIN_EMAIL } from '../../constants'
import { normalizeAccessText } from '../../utils/access'

const SHEET_SYNC_ROLES = ['president', 'vice president', 'vice-president', 'responsable financier', 'tresorier', 'admin']
const adminRoles = ['president', 'vice president', 'vice-president', 'responsable financier', 'tresorier', 'admin']

export const SETTINGS_SECTIONS = [
  { key: 'profil',          label: 'Profil',          Icon: User },
  { key: 'apparence',       label: 'Apparence',        Icon: Moon },
  { key: 'securite',        label: 'Mot de passe',     Icon: KeyRound },
  { key: 'notifications',   label: 'Notifications',    Icon: Bell },
  { key: 'application',     label: 'Application',      Icon: Link2 },
  { key: 'administration',  label: 'Administration',   Icon: ShieldCheck, adminOnly: true },
  { key: 'tags',            label: 'Tags membres',     Icon: Tag,         superAdminOnly: true },
]

export default function SettingsSubPanel({ user, currentMember }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSection = searchParams.get('section') || 'profil'

  const role = normalizeAccessText(currentMember?.staffRole)
  const isAdmin = user?.email === ADMIN_EMAIL
  const canAdmin = isAdmin || adminRoles.includes(role) || SHEET_SYNC_ROLES.includes(role)

  const visibleSections = SETTINGS_SECTIONS.filter(s => {
    if (s.superAdminOnly) return isAdmin
    if (s.adminOnly) return canAdmin
    return true
  })

  const activeIndex = Math.max(0, visibleSections.findIndex(s => s.key === activeSection))

  function setSection(key) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('section', key)
      return next
    }, { replace: true })
  }

  return (
    <div className="settings-sub-panel">
      <nav className="settings-sub-nav" style={{ '--active-index': activeIndex }}>
        {visibleSections.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            className={`settings-sub-item${activeSection === key ? ' active' : ''}`}
            onClick={() => setSection(key)}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
