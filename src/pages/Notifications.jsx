import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { arrayUnion, collection, doc, onSnapshot, orderBy, query, writeBatch } from 'firebase/firestore'
import { Bell, CalendarCheck, FileText, Settings, UserRound, Wallet } from 'lucide-react'

const C = '#5B4FCF'

const typeIcon = {
  budget: Wallet,
  membre: UserRound,
  presence: CalendarCheck,
  evenement: CalendarCheck,
  document: FileText,
  profil: Settings,
  admin: UserRound,
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
    <div className="page-container">
      <div className="page-header" style={{ background: C, paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className="flex-center gap-10">
          <button onClick={() => navigate('/')} className="page-back-btn">‹</button>
          <div className="flex-1">
            <h1 className="page-title">Notifications</h1>
            <p className="page-subtitle">
              {notifications.length} activité{notifications.length !== 1 ? 's' : ''} récente{notifications.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="w-36-h-36 rounded-12 flex-center" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}>
            <Bell size={18} />
          </div>
        </div>
      </div>

      <div style={{ padding: '1rem', paddingBottom: '2rem' }}>
        {loading ? (
          <div className="empty-state">Chargement...</div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            Aucune notification pour le moment.
          </div>
        ) : Object.entries(grouped).map(([label, items]) => (
          <div key={label} className="mb-16">
            <div className="card-title" style={{ margin: '0 0 8px' }}>{label}</div>
            {items.map(notif => {
              const Icon = typeIcon[notif.type] || Bell
              return (
                <button
                  key={notif.id}
                  onClick={() => notif.route && navigate(notif.route)}
                  className="notification-item"
                  type="button"
                >
                  <div className="notification-icon">
                    <Icon size={18} />
                  </div>
                  <div className="flex-1-min text-left">
                    <div className="notification-title">{cleanText(notif.titre)}</div>
                    {notif.detail && <div className="notification-detail">{cleanText(notif.detail)}</div>}
                    <div className="notification-meta">
                      <span>{cleanText(notif.actor?.nom) || 'Utilisateur'}</span>
                      <span>•</span>
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
