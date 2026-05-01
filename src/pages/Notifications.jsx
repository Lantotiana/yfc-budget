import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { arrayUnion, collection, doc, onSnapshot, orderBy, query, writeBatch } from 'firebase/firestore'
import { Bell, CalendarCheck, CalendarDays, FolderOpen, Settings, Users, UserRound, Wallet } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

const typeIcon = {
  budget: Wallet,
  membre: Users,
  presence: CalendarCheck,
  evenement: CalendarDays,
  document: FolderOpen,
  profil: Settings,
  admin: UserRound,
}

const typeColor = {
  dashboard: '#2563eb',
  stats: '#2563eb',
  budget: '#10b981',
  presence: '#7c3aed',
  presences: '#7c3aed',
  membre: '#f43f5e',
  membres: '#f43f5e',
  evenement: '#f59e0b',
  evenements: '#f59e0b',
  document: '#06b6d4',
  documents: '#06b6d4',
  profil: '#64748b',
  admin: '#64748b',
}

function getNotificationColor(type) {
  return typeColor[type] || '#10b981'
}

const TITLE_FIXES = {
  'Nouvelle entree budget': 'Nouvelle entrée budget',
  'Nouvelle depense budget': 'Nouvelle dépense budget',
  'Transaction modifiee': 'Transaction modifiée',
  'Transaction supprimee': 'Transaction supprimée',
  'Motif ajoute': 'Motif ajouté',
  'Motif supprime': 'Motif supprimé',
  'Nouveau membre ajoute': 'Nouveau membre ajouté',
  'Membre modifie': 'Membre modifié',
  'Membre supprime': 'Membre supprimé',
  'Presence marquee': 'Présence marquée',
  'Presence retiree': 'Présence retirée',
  'Nouveau culte cree': 'Nouveau culte créé',
  'Nouvel evenement cree': 'Nouvel événement créé',
  'Evenement modifie': 'Événement modifié',
  'Evenement supprime': 'Événement supprimé',
  'Document ajoute': 'Document ajouté',
  'Document supprime': 'Document supprimé',
  'Profil mis a jour': 'Profil mis à jour',
  'Photo de profil modifiee': 'Photo de profil modifiée',
  'Mot de passe modifie': 'Mot de passe modifié',
  'Utilisateur approuve': 'Utilisateur approuvé',
  'Utilisateur supprime': 'Utilisateur supprimé',
}

function cleanText(text) {
  if (!text) return ''
  return (TITLE_FIXES[text] || text)
    .replaceAll('â€™', "'")
    .replaceAll('â€¢', '•')
    .replaceAll('â€¹', '‹')
}

function formatTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now - date) / 60000)
  if (diff < 1) return "À l'instant"
  if (diff < 60) return `Il y a ${diff} min`
  if (diff < 1440) return `Il y a ${Math.floor(diff / 60)} h`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function groupLabel(iso) {
  if (!iso) return 'Plus ancien'
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return "Aujourd'hui"
  if (date.toDateString() === yesterday.toDateString()) return 'Hier'
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function Notifications({ user }) {
  const navigate = useNavigate()
  const { C } = useTheme()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!user?.uid || notifications.length === 0) return

    const unread = notifications.filter(notif => !(notif.readBy || []).includes(user.uid))
    if (unread.length === 0) return

    const batch = writeBatch(db)
    unread.forEach(notif => {
      batch.update(doc(db, 'notifications', notif.id), {
        readBy: arrayUnion(user.uid),
      })
    })
    batch.commit().catch(err => console.warn('Notifications non marquées comme lues', err))
  }, [notifications, user?.uid])

  const grouped = useMemo(() => {
    return notifications.reduce((acc, notif) => {
      const label = groupLabel(notif.createdAt)
      if (!acc[label]) acc[label] = []
      acc[label].push(notif)
      return acc
    }, {})
  }, [notifications])

  return (
    <div className="page-container-locked sin" style={{ background: C.bg }}>

      {/* Header */}
      <div className="textured-page-header" style={{ '--header-color': '#7c3aed', padding: '20px 20px 16px', paddingTop: 'max(20px, env(safe-area-inset-top))', borderBottom: `1px solid ${C.bord}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>Notifications</div>
          <div style={{ fontSize: 12, color: C.t2, marginTop: 2 }}>
            {notifications.length} activité{notifications.length !== 1 ? 's' : ''} récente{notifications.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="header-action" style={{ width: 36, height: 36, borderRadius: 12, background: C.violetD, color: C.violet, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bell size={18} />
        </div>
      </div>

      <div className="page-content" style={{ paddingBottom: '5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: C.t2, padding: '2rem', fontSize: 13 }}>Chargement...</div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.t2, padding: '2rem', fontSize: 13 }}>
            Aucune notification pour le moment.
          </div>
        ) : Object.entries(grouped).map(([label, items]) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 8px' }}>{label}</div>
            {items.map(notif => {
              const Icon = typeIcon[notif.type] || Bell
              const color = getNotificationColor(notif.type)
              return (
                <button
                  key={notif.id}
                  onClick={() => notif.route && navigate(notif.route)}
                  type="button"
                  style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 14, padding: '13px 14px', marginBottom: 8, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `${color}1F`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 2 }}>{cleanText(notif.titre)}</div>
                    {notif.detail && <div style={{ fontSize: 12, color: C.t2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanText(notif.detail)}</div>}
                    <div style={{ fontSize: 11, color: C.t3, marginTop: 4, display: 'flex', gap: 6 }}>
                      <span>{cleanText(notif.actor?.nom) || 'Utilisateur'}</span>
                      <span>·</span>
                      <span>{formatTime(notif.createdAt)}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
