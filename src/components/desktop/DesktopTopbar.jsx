import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  Bot,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  MessageCircle,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase'
import { ADMIN_EMAIL } from '../../constants'
import { countUnseenNotifications, getNotificationSeenAt } from '../../utils/notificationUtils'
import { normalizeAccessText } from '../../utils/access'
import MessagesStaff from '../../pages/MessagesStaff'
import Fampaherezana from '../../pages/Fampaherezana'

const adminRoles = ['president', 'vice president', 'vice-president', 'responsable financier', 'tresorier', 'admin']

const searchableItems = [
  { label: 'Dashboard', path: '/dashboard', Icon: LayoutDashboard, keywords: 'stats statistiques accueil tableau de bord' },
  { label: 'Membres', path: '/membres', Icon: Users, keywords: 'membre staff role telephone email inscription' },
  { label: 'Budget', path: '/budget', Icon: Wallet, keywords: 'argent entree sortie depense transaction solde' },
  { label: 'Présences', path: '/presences', Icon: CalendarCheck, keywords: 'presence réunion absent présent événement présence' },
  { label: 'Événements', path: '/evenements', Icon: CalendarDays, keywords: 'agenda calendrier date lieu planning' },
  { label: 'Tâches', path: '/tasks', Icon: ClipboardList, keywords: 'kanban tache todo deadline priorite assigne' },
  { label: 'Documents et matériels', path: '/documents', Icon: FileText, keywords: 'fichier document upload pdf image materiel stock emprunt retour inventaire' },
  { label: 'Paramètres', path: '/parametres', Icon: Settings, keywords: 'profil thème mot de passe réglages' },
  { label: 'Administration', path: '/admin', Icon: ShieldCheck, keywords: 'admin approbation utilisateurs roles' },
  { label: 'Synchronisation Google Sheets', path: '/admin', Icon: FileSpreadsheet, keywords: 'sheet sheets google synchroniser sync spreadsheet' },
]

function norm(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function dateLabel(value) {
  if (!value) return ''
  try {
    return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR')
  } catch {
    return String(value)
  }
}

export default function DesktopTopbar({ user, userData, currentMember, searchData, toolbar }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [notifCount, setNotifCount] = useState(0)
  const [showMessages, setShowMessages] = useState(false)
  const [showAssistant, setShowAssistant] = useState(false)

  const displayName = userData?.nom || user?.displayName || user?.email || 'Staff'
  const initials = displayName.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase()
  const canAdmin = user?.email === ADMIN_EMAIL || adminRoles.includes(normalizeAccessText(currentMember?.staffRole || userData?.staffRole || userData?.role))
  const pageTitle = useMemo(() => {
    const path = location.pathname
    if (path.startsWith('/membres')) return 'Membres'
    if (path.startsWith('/budget')) return 'Budget'
    if (path.startsWith('/presences')) return 'Présences'
    if (path.startsWith('/evenements')) return 'Événements'
    if (path.startsWith('/tasks')) return 'Tâches'
    if (path.startsWith('/messages')) return 'Messages'
    if (path.startsWith('/documents')) return 'Documents et matériels'
    if (path.startsWith('/assistant')) return 'Assistant IA'
    if (path.startsWith('/parametres')) return 'Paramètres'
    if (path.startsWith('/admin')) return 'Administration'
    if (path.startsWith('/notifications')) return 'Notifications'
    return 'Dashboard'
  }, [location.pathname])

  useEffect(() => {
    if (!user?.uid) return
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(150))
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setNotifCount(countUnseenNotifications(items, user, getNotificationSeenAt(user.uid)))
    }, () => setNotifCount(0))
  }, [user?.uid, user?.email])

  useEffect(() => {
    if (location.pathname.startsWith('/notifications')) {
      setNotifCount(0)
    }
  }, [location.pathname])

  const results = useMemo(() => {
    const term = norm(search)
    if (!term) return []

    const menuResults = searchableItems
      .filter(item => canAdmin || item.path !== '/admin')
      .filter(item => norm(`${item.label} ${item.keywords}`).includes(term))
      .map(item => ({ ...item, type: 'Module', detail: item.path }))

    const dataResults = [
      ...(searchData?.membres || []).map(m => ({
        label: `${m.nom || ''} ${m.prenoms || ''}`.trim() || m.email || 'Membre',
        detail: [m.nomPrefere, m.telephone, m.email, m.staffRole].filter(Boolean).join(' · '),
        path: '/membres',
        Icon: Users,
        type: 'Membre',
        haystack: `${m.nom} ${m.prenoms} ${m.nomPrefere} ${m.telephone} ${m.email} ${m.staffRole} ${Array.isArray(m.tags) ? m.tags.join(' ') : ''}`,
      })),
      ...(searchData?.transactions || []).map(t => ({
        label: t.motif || t.note || 'Transaction budget',
        detail: `${t.type === 'entree' ? 'Entrée' : 'Sortie'} · ${Number(t.montant || 0).toLocaleString('fr-FR')} Ar · ${dateLabel(t.date)}`,
        path: '/budget',
        Icon: Wallet,
        type: 'Budget',
        haystack: `${t.motif} ${t.note} ${t.type} ${t.montant} ${t.date} ${t.createdBy?.nom || ''} ${t.createdBy?.email || ''}`,
      })),
      ...(searchData?.presenceEvents || []).map(e => ({
        label: e.titre || e.nom || 'Présence',
        detail: `Présence · ${dateLabel(e.date)}`,
        path: `/presences/${e.id}`,
        Icon: CalendarCheck,
        type: 'Presence',
        haystack: `${e.titre} ${e.nom} ${e.date} ${Array.isArray(e.tags) ? e.tags.join(' ') : ''}`,
      })),
      ...(searchData?.agendaEvents || []).map(e => ({
        label: e.nom || 'Événement',
        detail: `Agenda · ${dateLabel(e.dateDebut)} ${e.lieu || ''}`,
        path: '/evenements',
        Icon: CalendarDays,
        type: 'Evenement',
        haystack: `${e.nom} ${e.lieu} ${e.dateDebut} ${e.dateFin}`,
      })),
      ...(searchData?.documents || []).map(d => ({
        label: d.nom || 'Document',
        detail: `${d.uploadedBy || 'Document'} · ${dateLabel(d.uploadedAt)}`,
        path: '/documents',
        Icon: FileText,
        type: 'Document',
        haystack: `${d.nom} ${d.type} ${d.uploadedBy} ${d.uploadedAt}`,
      })),
      ...(searchData?.messages || []).filter(m => !m.deleted).map(m => ({
        label: m.title || m.text || m.details || 'Message',
        detail: `${m.senderName || 'Message'} · ${dateLabel(m.createdAt)}`,
        path: '/messages',
        Icon: MessageCircle,
        type: m.type === 'announcement' ? 'Annonce' : 'Message',
        haystack: `${m.title} ${m.text} ${m.details} ${m.senderName}`,
      })),
    ].filter(item => norm(`${item.label} ${item.detail} ${item.haystack}`).includes(term))

    return [...dataResults, ...menuResults].slice(0, 8)
  }, [canAdmin, search, searchData])

  function openResult(item) {
    setSearch('')
    navigate(item.path)
  }

  function onSearchKeyDown(e) {
    if (e.key === 'Enter' && results[0]) openResult(results[0])
    if (e.key === 'Escape') setSearch('')
  }

  return (
    <header className="desktop-topbar">
      <div className="desktop-topbar-primary">
        <div className="desktop-topbar-title">
          <strong>{toolbar?.title || pageTitle}</strong>
          {toolbar?.subtitle && <div className="desktop-topbar-subtitle">{toolbar.subtitle}</div>}
        </div>

        {toolbar?.search && <div className="desktop-page-search">{toolbar.search}</div>}

        {toolbar?.actions && <div className="desktop-page-actions">{toolbar.actions}</div>}
      </div>

      <div className="desktop-top-actions">
        <button type="button" className={`desktop-icon-btn${showAssistant ? ' active' : ''}`} onClick={() => { setShowAssistant(v => !v); setShowMessages(false) }} aria-label="Assistant IA">
          <Bot size={18} />
        </button>
        <button type="button" className="desktop-icon-btn" onClick={() => navigate('/parametres')} aria-label="Paramètres">
          <Settings size={18} />
        </button>
        <button type="button" className={`desktop-icon-btn${showMessages ? ' active' : ''}`} onClick={() => { setShowMessages(v => !v); setShowAssistant(false) }} aria-label="Messages">
          <MessageCircle size={18} />
        </button>
        <button type="button" className="desktop-icon-btn" onClick={() => navigate('/notifications')} aria-label="Notifications" style={{ position: 'relative' }}>
          <Bell size={18} />
          {notifCount > 0 && (
            <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999, background: '#f43f5e', color: '#fff', fontSize: 10, fontWeight: 900, lineHeight: '17px', textAlign: 'center', border: '2px solid var(--surf)' }}>
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>
        <button type="button" onClick={() => navigate('/parametres')} aria-label="Mon profil" style={{ padding: 0, width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid var(--bord)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {userData?.photoURL || user?.photoURL ? (
            <img src={userData?.photoURL || user?.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }} />
          ) : (
            <span style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, borderRadius: '50%' }}>
              {initials || 'YF'}
            </span>
          )}
        </button>
      </div>
      {showMessages && createPortal((
        <div className="desktop-message-modal" role="dialog" aria-label="Messages">
          <button type="button" className="desktop-message-close" onClick={() => setShowMessages(false)} aria-label="Fermer les messages">
            <X size={16} />
          </button>
          <MessagesStaff user={user} userData={userData} embedded />
        </div>
      ), document.body)}
      {showAssistant && createPortal((
        <div className="desktop-message-modal desktop-assistant-modal" role="dialog" aria-label="Assistant IA">
          <button type="button" className="desktop-message-close" onClick={() => setShowAssistant(false)} aria-label="Fermer l'assistant">
            <X size={16} />
          </button>
          <Fampaherezana user={user} embedded />
        </div>
      ), document.body)}
    </header>
  )
}
