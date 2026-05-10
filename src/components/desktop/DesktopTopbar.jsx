import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  MessageCircle,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase'
import { ADMIN_EMAIL } from '../../constants'
import { countUnseenNotifications, getNotificationSeenAt } from '../../utils/notificationUtils'
import { normalizeAccessText } from '../../utils/access'

const adminRoles = ['president', 'vice president', 'vice-president', 'responsable financier', 'tresorier', 'admin']

const searchableItems = [
  { label: 'Dashboard', path: '/dashboard', Icon: LayoutDashboard, keywords: 'stats statistiques accueil tableau de bord' },
  { label: 'Membres', path: '/membres', Icon: Users, keywords: 'membre staff role telephone email inscription' },
  { label: 'Budget', path: '/budget', Icon: Wallet, keywords: 'argent entree sortie depense transaction solde' },
  { label: 'Présences', path: '/presences', Icon: CalendarCheck, keywords: 'presence réunion absent présent événement présence' },
  { label: 'Événements', path: '/evenements', Icon: CalendarDays, keywords: 'agenda calendrier date lieu planning' },
  { label: 'Tâches', path: '/tasks', Icon: ClipboardList, keywords: 'kanban tache todo deadline priorite assigne' },
  { label: 'Messages staff', path: '/messages', Icon: MessageCircle, keywords: 'message annonce discussion mention' },
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
        </div>

        <div className="desktop-search-wrap">
          <div className="desktop-search">
            <Search size={17} />
            <input
              type="search"
              placeholder="Rechercher membre, budget, présence, document..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
            />
          </div>
          {search.trim() && (
            <div className="desktop-search-results">
              {results.length === 0 ? (
                <div className="desktop-search-empty">Aucun résultat</div>
              ) : results.map(item => (
                <button key={`${item.label}-${item.path}`} type="button" onClick={() => openResult(item)}>
                  <item.Icon size={16} />
                  <span>
                    {item.label}
                    <em>{item.type}</em>
                  </span>
                  <small>{item.detail}</small>
                </button>
              ))}
            </div>
          )}
        </div>

        {toolbar?.actions && <div className="desktop-page-actions">{toolbar.actions}</div>}
      </div>

      <div className="desktop-top-actions">
        <button type="button" className="desktop-icon-btn" onClick={() => navigate('/notifications')} aria-label="Notifications" style={{ position: 'relative' }}>
          <Bell size={18} />
          {notifCount > 0 && (
            <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999, background: '#f43f5e', color: '#fff', fontSize: 10, fontWeight: 900, lineHeight: '17px', textAlign: 'center', border: '2px solid var(--surf)' }}>
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>
        <button type="button" className="desktop-icon-btn" onClick={() => navigate('/messages')} aria-label="Messages">
          <MessageCircle size={18} />
        </button>
        <div className="desktop-user-chip">
          <span>
            {userData?.photoURL || user?.photoURL ? (
              <img src={userData?.photoURL || user?.photoURL} alt="" />
            ) : (
              initials || 'YF'
            )}
          </span>
          <div>
            <strong>{displayName}</strong>
            <small>{currentMember?.staffRole || userData?.role || 'Staff'}</small>
          </div>
        </div>
      </div>
    </header>
  )
}
