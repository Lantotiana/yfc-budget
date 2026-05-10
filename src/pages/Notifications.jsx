import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { arrayUnion, collection, doc, onSnapshot, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore'
import { Bell, CalendarCheck, CalendarDays, ClipboardList, FolderOpen, MessageCircle, Settings, Users, UserRound, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { db } from '../firebase'
import { useTheme } from '../context/ThemeContext'
import { isNotificationVisibleForUser, setNotificationSeenAt } from '../utils/notificationUtils'

const typeIcon = {
  budget: Wallet,
  membre: Users,
  presence: CalendarCheck,
  evenement: CalendarDays,
  document: FolderOpen,
  message: MessageCircle,
  mention: MessageCircle,
  task: ClipboardList,
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
  message: '#10b981',
  mention: '#10b981',
  task: '#16b5a3',
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
    .replaceAll('Ã¢â‚¬â„¢', "'")
    .replaceAll('Ã¢â‚¬Â¢', '•')
    .replaceAll('Ã¢â‚¬Â¹', '‹')
    .replaceAll('Ã€', 'À')
    .replaceAll('Â·', '·')
    .replaceAll('activitÃ©', 'activité')
    .replaceAll('rÃ©cente', 'récente')
    .replaceAll('marquÃ©e', 'marquée')
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
  const { t } = useTranslation()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [])

  const visibleNotifications = useMemo(
    () => notifications.filter(notif => isNotificationVisibleForUser(notif, user)),
    [notifications, user?.uid, user?.email]
  )

  useEffect(() => {
    if (!user?.uid || loading) return

    setNotificationSeenAt(user.uid)

    const unread = visibleNotifications.filter(notif => !(notif.readBy || []).includes(user.uid))
    if (unread.length === 0) return

    const batch = writeBatch(db)
    unread.forEach(notif => {
      batch.update(doc(db, 'notifications', notif.id), {
        readBy: arrayUnion(user.uid),
      })
    })
    batch.commit().catch(err => console.warn('Notifications non marquees comme lues', err))
  }, [visibleNotifications, loading, user?.uid])

  const grouped = useMemo(() => {
    return visibleNotifications.reduce((acc, notif) => {
      const label = groupLabel(notif.createdAt)
      if (!acc[label]) acc[label] = []
      acc[label].push(notif)
      return acc
    }, {})
  }, [visibleNotifications])

  function getNotificationRoute(notif) {
    if (!notif.route) return ''
    const taskId = notif.metadata?.taskId
    if (notif.route === '/tasks' && taskId) return `/tasks?task=${encodeURIComponent(taskId)}`
    const eventId = notif.metadata?.eventId
    if (notif.route === '/evenements' && eventId) return `/evenements?event=${eventId}`
    const membreId = notif.metadata?.membreId
    if (notif.route === '/membres' && membreId) return `/membres?membre=${membreId}`
    const docId = notif.metadata?.docId
    if (notif.route === '/documents' && docId) return `/documents?doc=${docId}`
    const lienId = notif.metadata?.lienId
    if (notif.route === '/documents' && lienId) return `/documents?lien=${lienId}`
    return notif.route
  }

  async function openNotification(notif) {
    const route = getNotificationRoute(notif)

    if (user?.uid && !(notif.readBy || []).includes(user.uid)) {
      try {
        await updateDoc(doc(db, 'notifications', notif.id), {
          readBy: arrayUnion(user.uid),
        })
      } catch (err) {
        console.warn('Notification non marquee comme lue', err)
      }
    }

    if (route) navigate(route)
  }

  return (
    <div className="page-container-locked sin" style={{ background: C.bg }}>
      <div
        className="textured-page-header desktop-hide-page-header"
        style={{
          '--header-color': '#7c3aed',
          padding: '20px 20px 16px',
          paddingTop: 'max(20px, env(safe-area-inset-top))',
          borderBottom: `1px solid ${C.bord}`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>
            {t('notifications.title')}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 2 }}>
            {visibleNotifications.length} activité{visibleNotifications.length !== 1 ? 's' : ''} récente{visibleNotifications.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div
          className="header-action"
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: C.violetD,
            color: C.violet,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bell size={18} />
        </div>
      </div>

      <div className="page-content" style={{ paddingBottom: '5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: C.t2, padding: '2rem', fontSize: 'var(--font-sm)' }}>
            {t('common.loading')}
          </div>
        ) : visibleNotifications.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.t2, padding: '2rem', fontSize: 'var(--font-sm)' }}>
            {t('notifications.aucune')}
          </div>
        ) : Object.entries(grouped).map(([label, items]) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 'var(--font-xs)',
                fontWeight: 700,
                color: C.t3,
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                margin: '0 0 8px',
              }}
            >
              {label}
            </div>
            {items.map(notif => {
              const Icon = typeIcon[notif.type] || Bell
              const color = getNotificationColor(notif.type)

              return (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => openNotification(notif)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    background: C.surf,
                    border: `1px solid ${C.bord}`,
                    borderRadius: 14,
                    padding: '13px 14px',
                    marginBottom: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      flexShrink: 0,
                      background: `${color}1F`,
                      color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1, marginBottom: 2 }}>
                      {cleanText(notif.titre)}
                    </div>
                    {notif.detail && (
                      <div
                        style={{
                          fontSize: 'var(--font-xs)',
                          color: C.t2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {cleanText(notif.detail)}
                      </div>
                    )}
                    <div style={{ fontSize: 'var(--font-xs)', color: C.t3, marginTop: 4, display: 'flex', gap: 6 }}>
                      <span>{cleanText(notif.actor?.nom) || t('notifications.utilisateurInconnu')}</span>
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
