import { CalendarPlus, FileSpreadsheet, Plus, Receipt, UserPlus } from 'lucide-react'

const actions = [
  { label: 'Ajouter un membre', path: '/membres', Icon: UserPlus },
  { label: 'Budget', path: '/budget', Icon: Receipt },
  { label: 'Nouvelle presence', path: '/presences', Icon: CalendarPlus },
  { label: 'Google Sheets', path: '/admin', Icon: FileSpreadsheet },
]

export default function DesktopQuickActions({ open, onClose }) {
  if (!open) return null
  return (
    <div className="desktop-quick-menu">
      {actions.map(action => (
        <a key={action.path + action.label} href={action.path} onClick={onClose}>
          <action.Icon size={16} />
          {action.label}
        </a>
      ))}
      <button type="button" onClick={onClose}>
        <Plus size={16} />
        Fermer
      </button>
    </div>
  )
}
