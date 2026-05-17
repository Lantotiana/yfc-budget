import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../firebase'
import { addDoc, collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { ArrowLeft, Check, Lock, LockOpen, Pencil, Share2, Search, Tag, Trash2, X } from 'lucide-react'
import { toDisplayDate } from '../utils'
import { useTheme } from '../context/ThemeContext'
import { DEFAULT_MEMBRE_TAGS } from '../constants'
import Portal from '../components/Portal'
import { useDesktopToolbar } from '../context/DesktopToolbarContext'
import { createNotification } from '../notifications'
import { trackUserActivity } from '../utils/userActivity'

export default function PresenceDetail({ user, userData }) {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { C } = useTheme()
  const { setToolbar } = useDesktopToolbar()
  const [event, setEvent] = useState(null)
  const [allEvents, setAllEvents] = useState([])
  const [membres, setMembres] = useState([])
  const [presences, setPresences] = useState({})
  const [allPresences, setAllPresences] = useState({})
  const [availableTags, setAvailableTags] = useState(DEFAULT_MEMBRE_TAGS)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [isSharingReport, setIsSharingReport] = useState(false)
  const [desktopShareReport, setDesktopShareReport] = useState(null)
  const [publishPromptReport, setPublishPromptReport] = useState(null)
  const [presenceLocked, setPresenceLocked] = useState(true)

  useEffect(() => {
    return onSnapshot(doc(db, 'evenements', id), snap => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() }
        setEvent(data)
      }
    })
  }, [id])

  useEffect(() => {
    const q = query(collection(db, 'evenements'), orderBy('date', 'desc'))
    return onSnapshot(q, snap => setAllEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'membres'), orderBy('nom'))
    return onSnapshot(q, snap => setMembres(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'presences'), snap => {
      const currentMap = {}
      const fullMap = {}
      snap.docs.forEach(d => {
        const data = d.data()
        fullMap[`${data.eventId}_${data.membreId}`] = data.present
        if (data.eventId === id) currentMap[data.membreId] = data.present
      })
      setPresences(currentMap)
      setAllPresences(fullMap)
    })
  }, [id])

  useEffect(() => {
    return onSnapshot(doc(db, 'appSettings', 'membreTags'), snap => {
      if (snap.exists() && Array.isArray(snap.data().list) && snap.data().list.length > 0) {
        setAvailableTags(snap.data().list)
      }
    })
  }, [])

  const eventTags = event?.tags || []
  const tagFilteredMembres = eventTags.length === 0
    ? membres
    : membres.filter(m => Array.isArray(m.tags) && m.tags.some(t => eventTags.includes(t)))

  function normSearch(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  }
  const filteredMembres = search.trim()
    ? tagFilteredMembres.filter(m =>
        normSearch(m.nom).includes(normSearch(search)) ||
        normSearch(m.prenoms).includes(normSearch(search)) ||
        normSearch(m.nomPrefere).includes(normSearch(search))
      )
    : tagFilteredMembres

  const presentCount = tagFilteredMembres.filter(m => presences[m.id] === true).length
  const presencePercent = tagFilteredMembres.length ? Math.round((presentCount / tagFilteredMembres.length) * 100) : 0
  const progressColor = presencePercent < 40 ? C.coral : presencePercent < 75 ? C.amber : C.teal

  function normalizeTag(tag) {
    return String(tag || '').trim().toLowerCase()
  }

  function tagsMatchCurrent(candidate) {
    if (!eventTags.length) return true
    const candidateTags = Array.isArray(candidate?.tags) ? candidate.tags.map(normalizeTag) : []
    const currentTags = eventTags.map(normalizeTag)
    return candidateTags.some(tag => currentTags.includes(tag))
  }

  const lastSameTagEvents = useMemo(() => {
    if (!event) return []
    const byId = new Map()
    ;[event, ...allEvents].forEach(ev => {
      if (ev?.id && tagsMatchCurrent(ev)) byId.set(ev.id, ev)
    })
    return Array.from(byId.values())
      .sort((a, b) => {
        const dateDiff = String(b.date || '').localeCompare(String(a.date || ''))
        if (dateDiff !== 0) return dateDiff
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      })
      .slice(0, 5)
  }, [allEvents, event, eventTags.join('|')])

  function getMemberHistory(membreId) {
    const recentFirst = lastSameTagEvents.map(ev => {
      const value = allPresences[`${ev.id}_${membreId}`]
      return {
        eventId: ev.id,
        title: ev.titre || '',
        date: ev.date || '',
        present: value === true,
      }
    })
    let streak = 0
    for (const item of recentFirst) {
      if (item.present !== true) break
      streak += 1
    }
    const last5 = [...recentFirst].reverse()
    return { last5, streak }
  }

  function presenceSymbol(value) {
    if (value === true) return '✅'
    return '❌'
  }

  function BrandIcon({ type }) {
    if (type === 'whatsapp') {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#25D366" d="M12.04 2a9.84 9.84 0 0 0-8.53 14.75L2.4 21.8l5.17-1.08A9.84 9.84 0 1 0 12.04 2Z" />
          <path fill="#fff" d="M17.69 14.56c-.31-.15-1.82-.9-2.1-1-.28-.1-.49-.15-.69.15-.2.31-.79 1-.97 1.17-.18.2-.36.22-.67.07-.31-.15-1.31-.48-2.49-1.53-.92-.82-1.54-1.84-1.72-2.15-.18-.31-.02-.48.14-.63.14-.14.31-.36.46-.54.15-.18.2-.31.31-.51.1-.2.05-.38-.03-.54-.08-.15-.69-1.66-.95-2.28-.25-.6-.5-.51-.69-.52h-.59c-.2 0-.54.08-.82.38-.28.31-1.08 1.05-1.08 2.56s1.1 2.97 1.25 3.18c.15.2 2.17 3.31 5.26 4.64.73.32 1.3.51 1.75.65.74.23 1.41.2 1.94.12.59-.09 1.82-.74 2.08-1.46.26-.72.26-1.33.18-1.46-.08-.13-.28-.2-.59-.35Z" />
        </svg>
      )
    }
    if (type === 'facebook') {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#1877F2" d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.88 3.77-3.88 1.09 0 2.23.2 2.23.2v2.45h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" />
        </svg>
      )
    }
    if (type === 'email') {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#EA4335" d="M3.5 6.5A2.5 2.5 0 0 1 6 4h12a2.5 2.5 0 0 1 2.5 2.5v11A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5v-11Z" />
          <path fill="#fff" d="M5.2 7.1 12 12.2l6.8-5.1v2.1L12 14.3 5.2 9.2V7.1Z" />
        </svg>
      )
    }
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#6B6F8A" d="M8 7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-1v1a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3h1V7Zm2 1h3a3 3 0 0 1 3 3v3h1a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v1Zm-3 2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1H7Z" />
      </svg>
    )
  }

  function renderHistoryDot(item) {
    const bg = item.present === true ? '#22c55e' : '#ef4444'
    return (
      <span
        key={item.eventId}
        title={`${item.title || 'Evenement'}${item.date ? ` - ${toDisplayDate(item.date)}` : ''}`}
        style={{ width: 15, height: 15, borderRadius: '50%', background: bg, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        {item.present === true ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
      </span>
    )
  }

  useEffect(() => {
    setPresenceLocked(true)
    return () => setPresenceLocked(true)
  }, [id])

  function togglePresenceLock() {
    if (presenceLocked) {
      if (!window.confirm('Voulez-vous vraiment modifier la présence ?')) return
      trackUserActivity(user, 'Modifie les présences', `/presences/${id}`)
      setPresenceLocked(false)
      return
    }
    setPresenceLocked(true)
  }

  async function togglePresence(membre) {
    if (presenceLocked) return
    const docId = `${id}_${membre.id}`
    const nowPresent = !presences[membre.id]
    trackUserActivity(user, nowPresent ? 'Ajoute une présence' : 'Retire une présence', `/presences/${id}`)
    setSaving(membre.id)
    try {
      await setDoc(doc(db, 'presences', docId), {
        eventId: id,
        membreId: membre.id,
        membreNom: membre.nom,
        membrePrenoms: membre.prenoms || '',
        membreNomPrefere: membre.nomPrefere || '',
        present: nowPresent,
        updatedAt: new Date().toISOString(),
      })
      await createNotification({
        type: 'presence',
        titre: nowPresent ? 'Présence marquée' : 'Présence retirée',
        detail: `${membre.nom} ${membre.prenoms || ''} - ${event?.titre || ''}`.trim(),
        cible: membre.nom,
        route: `/presences/${id}`,
        metadata: { presenceId: id, membreId: membre.id },
      })
      setPresences(prev => ({ ...prev, [membre.id]: nowPresent }))
      setAllPresences(prev => ({ ...prev, [`${id}_${membre.id}`]: nowPresent }))
    } catch (e) { console.error(e) }
    setSaving(null)
  }

  function openEdit() {
    setEditForm({ titre: event.titre, date: event.date, tags: Array.isArray(event.tags) ? [...event.tags] : [] })
    setShowEdit(true)
  }

  function toggleEditTag(tag) {
    setEditForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }))
  }

  async function saveEdit() {
    if (!editForm.titre.trim()) return
    trackUserActivity(user, 'Modifie un événement de présence', `/presences/${id}`)
    setSavingEdit(true)
    try {
      await updateDoc(doc(db, 'evenements', id), {
        titre: editForm.titre.trim(),
        date: editForm.date,
        tags: editForm.tags,
      })
      await createNotification({
        type: 'presence',
        titre: 'Événement de présence modifié',
        detail: `${editForm.titre.trim()} - ${toDisplayDate(editForm.date)}`,
        cible: editForm.titre.trim(),
        route: `/presences?presence=${id}`,
        metadata: { presenceId: id },
      })
      setShowEdit(false)
    } catch (e) { console.error(e) }
    setSavingEdit(false)
  }

  async function deleteEvent() {
    if (!window.confirm(`Supprimer "${event.titre}" ? Les données de présence seront conservées.`)) return
    trackUserActivity(user, 'Supprime un événement de présence', `/presences/${id}`)
    await deleteDoc(doc(db, 'evenements', id))
    await createNotification({
      type: 'presence',
      titre: 'Événement de présence supprimé',
      detail: event.titre,
      cible: event.titre,
      route: '/presences',
      metadata: { presenceId: id },
    })
    navigate('/presences')
  }

  function formatDateFR(dateStr) {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  function displayName(m) {
    return m.nomPrefere?.trim() || m.prenoms?.trim() || m.nom
  }

  const reportMemberIdsKey = tagFilteredMembres.map(m => m.id).join('|')
  const reportPresenceKey = tagFilteredMembres.map(m => `${m.id}:${presences[m.id] === true ? '1' : '0'}`).join('|')

  const desktopActions = useMemo(() => (
    <>
      <button
        type="button"
        className="desktop-toolbar-btn secondary"
        onClick={togglePresenceLock}
        disabled={!event}
        aria-label={presenceLocked ? 'Déverrouiller les présences' : 'Verrouiller les présences'}
        title={presenceLocked ? 'Déverrouiller les présences' : 'Verrouiller les présences'}
      >
        {presenceLocked ? <Lock size={17} /> : <LockOpen size={17} />}
      </button>
      <button
        type="button"
        className="desktop-toolbar-btn secondary"
        onClick={openEdit}
        disabled={!event}
        aria-label="Modifier la reunion"
      >
        <Pencil size={17} />
      </button>
      {tagFilteredMembres.length > 0 && (
        <button
          type="button"
          className="desktop-toolbar-btn secondary"
          onClick={partager}
          disabled={isSharingReport}
          aria-label="Partager"
        >
          <Share2 size={17} />
        </button>
      )}
    </>
  ), [event, isSharingReport, presenceLocked, reportMemberIdsKey, reportPresenceKey, allPresences])

  const presenceCountLabel = useMemo(() => (
    <div className="presence-stats-row">
      <div className="presence-stats-count" style={{ color: C.t2 }}>
        <span style={{ fontWeight: 700, color: C.t1 }}>{presentCount}</span> / {tagFilteredMembres.length} {t('presences.presents')}
      </div>
    </div>
  ), [C.t1, C.t2, presentCount, tagFilteredMembres.length, t])

  const presenceSearchInput = useMemo(() => tagFilteredMembres.length > 0 && (
    <div className="tx-search-wrapper">
      <div className="tx-search-icon"><Search size={14} /></div>
      <input
        className="tx-search-input"
        type="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={t('membres.rechercher')}
        style={{ paddingLeft: 38, paddingRight: search ? 38 : 12 }}
      />
      {search && (
        <button type="button" className="tx-search-clear" onClick={() => setSearch('')}>
          <X size={14} />
        </button>
      )}
    </div>
  ), [search, tagFilteredMembres.length, t])

  useEffect(() => {
    setToolbar({ actions: desktopActions, search: presenceSearchInput, subtitle: presenceCountLabel })
    return () => setToolbar({ actions: null, search: null, subtitle: null })
  }, [desktopActions, presenceCountLabel, presenceSearchInput, setToolbar])

  function buildReportText(presents, absents) {
    const tagLabel = eventTags.length ? ` [${eventTags.join(', ')}]` : ''
    const separator = '\n────────────\n'
    const withHistory = m => {
      const history = getMemberHistory(m.id)
      const icons = history.last5.map(item => presenceSymbol(item.present)).join(' ')
      return `${displayName(m)} ${icons}`.trim()
    }
    let t = `Présence ${event.titre}${tagLabel} — ${formatDateFR(event.date)}`
    t += `${separator}✅ Présents (${presents.length})\n${presents.length ? presents.map(withHistory).join('\n') : 'Aucun'}`
    t += `${separator}❌ Absents (${absents.length})\n${absents.length ? absents.map(withHistory).join('\n') : 'Aucun'}`
    t += `${separator}👥 Total : ${tagFilteredMembres.length} — Taux : ${presencePercent} %`
    return t
  }

  async function partager() {
    if (!event || tagFilteredMembres.length === 0 || isSharingReport) return
    const presents = tagFilteredMembres.filter(m => presences[m.id] === true)
    const absents  = tagFilteredMembres.filter(m => presences[m.id] !== true)
    const text = buildReportText(presents, absents)
    const report = { text, presents, absents, title: `Présence – ${event.titre}` }
    const isDesktop = window.matchMedia?.('(min-width: 1024px)').matches

    if (isDesktop) {
      setDesktopShareReport(report)
      return
    }

    setIsSharingReport(true)
    try {
      if (navigator.share) {
        await navigator.share({ title: report.title, text })
      } else {
        await navigator.clipboard.writeText(text)
      }
      // Mobile keeps the existing native-share behavior.
      await publishReportToMessages(presents, absents)
    } catch (err) {
      if (err?.name !== 'AbortError') console.error('Share error:', err)
    } finally {
      setIsSharingReport(false)
    }
  }

  async function copyReportText(text) {
    await navigator.clipboard.writeText(text)
  }

  function finishDesktopShare(report) {
    setDesktopShareReport(null)
    setPublishPromptReport(report)
  }

  async function shareDesktopReport(channel) {
    if (!desktopShareReport) return
    const report = desktopShareReport
    try {
      if (channel === 'whatsapp') {
        window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(report.text)}`, '_blank', 'noopener,noreferrer')
      } else if (channel === 'messenger') {
        await copyReportText(report.text)
        window.open('https://www.facebook.com/messages/', '_blank', 'noopener,noreferrer')
      } else if (channel === 'email') {
        window.location.href = `mailto:?subject=${encodeURIComponent(report.title)}&body=${encodeURIComponent(report.text)}`
      } else if (channel === 'copy') {
        await copyReportText(report.text)
      }
      finishDesktopShare(report)
    } catch (err) {
      console.error('Desktop share error:', err)
    }
  }

  async function publishPendingDesktopReport() {
    if (!publishPromptReport || isSharingReport) return
    setIsSharingReport(true)
    try {
      await publishReportToMessages(publishPromptReport.presents, publishPromptReport.absents)
      setPublishPromptReport(null)
    } finally {
      setIsSharingReport(false)
    }
  }

  async function publishReportToMessages(presents, absents) {
    if (!event) return
    const senderName = userData?.nom || user?.displayName || user?.email || 'Staff'
    const senderPhoto = userData?.photoURL || user?.photoURL || null
    const groupLabel = eventTags.length ? eventTags.join(', ') : 'Tous les membres'
    const payload = {
      type: 'presence_report',
      eventId: id,
      eventTitle: event.titre,
      eventDate: event.date,
      eventTags,
      groupLabel,
      presents: presents.map(m => ({ id: m.id, displayName: displayName(m), ...getMemberHistory(m.id) })),
      absents:  absents.map(m => ({ id: m.id, displayName: displayName(m), ...getMemberHistory(m.id) })),
      memberStreaks: tagFilteredMembres.map(m => ({ id: m.id, displayName: displayName(m), ...getMemberHistory(m.id) })),
      totalCount: tagFilteredMembres.length,
      presentCount: presents.length,
      presencePercent,
      senderId: user.uid,
      senderName,
      senderPhoto,
    }

    try {
      if (event.publishedMessageId) {
        // Update existing message — mark as edited
        await updateDoc(doc(db, 'staffMessages', event.publishedMessageId), {
          ...payload,
          edited: true,
          editedAt: new Date().toISOString(),
        })
      } else {
        // First publish
        const docRef = await addDoc(collection(db, 'staffMessages'), {
          ...payload,
          reactions: {},
          readBy: [user.uid],
          pinned: false,
          deleted: false,
          deletedAt: null,
          deletedBy: null,
          edited: false,
          editedAt: null,
          createdAt: new Date().toISOString(),
        })
        await updateDoc(doc(db, 'evenements', id), { publishedMessageId: docRef.id })
      }
    } catch (e) { console.error(e) }
  }

  if (!event) {
    return (
      <div className="page-container-locked sin" style={{ background: C.bg }}>
        <div style={{ textAlign: 'center', padding: '3rem', color: C.t2, fontSize: 'var(--font-sm)' }}>{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="page-container-locked sin presence-detail-page" style={{ background: C.bg }}>

      {/* Header */}
      <div className="textured-page-header desktop-hide-page-header" style={{ '--header-color': '#7c3aed', padding: '20px 20px 16px', paddingTop: 'max(20px, env(safe-area-inset-top))', borderBottom: `1px solid ${C.bord}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <button
            onClick={() => navigate('/presences')}
            style={{ width: 38, height: 38, borderRadius: 12, border: `1px solid ${C.bord}`, background: C.surf, color: C.t2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--font-base)', fontWeight: 700, color: C.t1, letterSpacing: '-.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.titre}</div>
            <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 1 }}>
              {toDisplayDate(event.date)}
              {eventTags.length > 0 && <span style={{ color: '#7c3aed', marginLeft: 6 }}>· {eventTags.join(', ')}</span>}
            </div>
            {presenceCountLabel}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={togglePresenceLock}
              title={presenceLocked ? 'Déverrouiller les présences' : 'Verrouiller les présences'}
              aria-label={presenceLocked ? 'Déverrouiller les présences' : 'Verrouiller les présences'}
              style={{ width: 38, height: 38, borderRadius: 12, border: `1px solid ${presenceLocked ? C.bord : C.teal + '55'}`, background: presenceLocked ? C.surf : C.tealD, color: presenceLocked ? C.t2 : C.teal, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {presenceLocked ? <Lock size={16} /> : <LockOpen size={16} />}
            </button>
            <button
              onClick={openEdit}
              style={{ width: 38, height: 38, borderRadius: 12, border: `1px solid ${C.bord}`, background: C.surf, color: C.t2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Pencil size={16} />
            </button>
            {tagFilteredMembres.length > 0 && (
              <button
                onClick={partager}
                disabled={isSharingReport}
                style={{ width: 38, height: 38, borderRadius: 12, border: `1px solid ${C.bord}`, background: C.surf, color: C.t2, cursor: isSharingReport ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isSharingReport ? 0.5 : 1 }}
              >
                <Share2 size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="presence-header-tools">
          {presenceSearchInput}
        </div>
      </div>

      {tagFilteredMembres.length > 0 && (
        <div className="presence-progress-area">
          <div
            className="presence-progress"
            style={{
              '--presence-progress-bg': C.surf3,
              '--presence-progress-fill': progressColor,
              '--presence-progress-width': `${presencePercent}%`,
            }}
          >
            <div />
          </div>
        </div>
      )}

      {/* Member list */}
      <div className="presence-list-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', paddingBottom: '2rem' }}>
        {membres.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.t2, padding: '3rem 1rem', fontSize: 'var(--font-sm)' }}>
            {t('membres.aucunMembre')}
          </div>
        ) : tagFilteredMembres.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.t2, padding: '3rem 1rem', fontSize: 'var(--font-sm)' }}>
            {t('membres.aucunMembre')}
          </div>
        ) : filteredMembres.map(m => {
          const present = presences[m.id] === true
          const isSaving = saving === m.id
          const history = getMemberHistory(m.id)
          return (
            <div
              className="presence-member-row"
              key={m.id}
              onClick={() => !isSaving && togglePresence(m)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: present ? `${C.teal}0D` : C.surf,
                border: `1px solid ${present ? C.teal + '40' : C.bord}`,
                borderRadius: 16, padding: '12px 14px', marginBottom: 8,
                cursor: presenceLocked ? 'default' : (isSaving ? 'wait' : 'pointer'),
                transition: 'background .2s, border-color .2s, opacity .2s',
                opacity: isSaving ? 0.6 : 1,
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 14, flexShrink: 0, background: present ? C.tealD : C.surf2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--font-sm)', color: present ? C.teal : C.t2 }}>
                {(displayName(m) || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(m)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                {history.last5.map(renderHistoryDot)}
              </div>
              <div style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, background: present ? C.teal : C.surf3, border: present ? 'none' : `1px solid ${C.bord2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s, border-color .2s, transform .25s cubic-bezier(.34,1.56,.64,1), opacity .2s', transform: present ? 'scale(1)' : 'scale(0.9)', opacity: presenceLocked ? 0.58 : 1 }}>
                {present && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7L5.5 10L11.5 4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
            </div>
          )
        })}
      </div>

      {desktopShareReport && (
        <Portal>
          <div className="modal-overlay presence-share-overlay" onClick={() => setDesktopShareReport(null)}>
            <div className="presence-share-modal" onClick={e => e.stopPropagation()}>
              <div className="presence-share-head">
                <div>
                  <h2>Partager le rapport</h2>
                  <p>{event.titre}</p>
                </div>
                <button type="button" onClick={() => setDesktopShareReport(null)} aria-label="Annuler">
                  <X size={18} />
                </button>
              </div>
              <div className="presence-share-actions">
                <button type="button" onClick={() => shareDesktopReport('whatsapp')}>
                  <BrandIcon type="whatsapp" /> WhatsApp
                </button>
                <button type="button" onClick={() => shareDesktopReport('messenger')}>
                  <BrandIcon type="facebook" /> Facebook message
                </button>
                <button type="button" onClick={() => shareDesktopReport('email')}>
                  <BrandIcon type="email" /> Email
                </button>
                <button type="button" onClick={() => shareDesktopReport('copy')}>
                  <BrandIcon type="copy" /> Copier le texte
                </button>
              </div>
              <button type="button" className="presence-share-cancel" onClick={() => setDesktopShareReport(null)}>
                Annuler
              </button>
            </div>
          </div>
        </Portal>
      )}

      {publishPromptReport && (
        <Portal>
          <div className="modal-overlay presence-share-overlay" onClick={() => setPublishPromptReport(null)}>
            <div className="presence-share-modal presence-publish-modal" onClick={e => e.stopPropagation()}>
              <div className="presence-share-head">
                <div>
                  <h2>Publier aussi dans l'app ?</h2>
                  <p>Le rapport sera ajouté dans Messages Staff.</p>
                </div>
              </div>
              <div className="presence-publish-actions">
                <button type="button" className="presence-share-cancel" onClick={() => setPublishPromptReport(null)}>
                  Annuler
                </button>
                <button type="button" className="presence-publish-confirm" onClick={publishPendingDesktopReport} disabled={isSharingReport}>
                  Publier
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Edit sheet */}
      {showEdit && editForm && (
        <Portal>
        <div className="bottom-sheet-overlay" onClick={() => setShowEdit(false)}>
          <div className="bottom-sheet fixed-footer-sheet presence-edit-sheet" onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 className="dialog-title" style={{ margin: 0 }}>{t('common.edit')} {t('presences.evenement')}</h2>
              <button type="button" className="task-icon-btn" onClick={deleteEvent} style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#ef4444' }}>
                <Trash2 size={16} />
              </button>
            </div>
            <div className="dialog-content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">{t('presences.nom')} *</label>
                <input
                  type="text"
                  value={editForm.titre}
                  onChange={e => setEditForm(f => ({ ...f, titre: e.target.value }))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">{t('presences.date')}</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Tag size={12} /> Participants par tag
                </label>
                <div style={{ fontSize: 'var(--font-xs)', color: C.t3, marginBottom: 8 }}>Aucun tag = tous les membres</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {availableTags.map(tag => {
                    const selected = editForm.tags.includes(tag)
                    const count = membres.filter(m => Array.isArray(m.tags) && m.tags.includes(tag)).length
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleEditTag(tag)}
                        style={{
                          padding: '7px 14px', borderRadius: 999,
                          border: `1.5px solid ${selected ? '#6366f1' : C.bord}`,
                          background: selected ? 'rgba(99,102,241,0.12)' : C.surf2,
                          color: selected ? '#6366f1' : C.t2,
                          fontSize: 'var(--font-xs)', fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {tag} <span style={{ opacity: 0.7 }}>({count})</span>
                      </button>
                    )
                  })}
                </div>
                {editForm.tags.length > 0 && (
                  <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', fontSize: 'var(--font-xs)', color: '#6366f1', fontWeight: 600 }}>
                    {(() => {
                      const n = membres.filter(m => Array.isArray(m.tags) && m.tags.some(t => editForm.tags.includes(t))).length
                      return `${n} membre${n !== 1 ? 's' : ''} correspondent`
                    })()}
                  </div>
                )}
              </div>
            </div>
            <div className="dialog-footer">
              <button onClick={() => setShowEdit(false)} className="btn-secondary materiel-footer-btn">
                {t('common.cancel')}
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit || !editForm.titre.trim()}
                className="materiel-primary-btn"
              >
                {savingEdit ? t('presences.enregistrement') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}


    </div>
  )
}
