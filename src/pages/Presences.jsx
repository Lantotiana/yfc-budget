import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db } from '../firebase'
import { collection, addDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { toDisplayDate } from '../utils'
import { CalendarPlus, ChevronRight, Tag } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { DEFAULT_MEMBRE_TAGS } from '../constants'
import Portal from '../components/Portal'
import LoadingState from '../components/LoadingState'
import { useDesktopToolbar } from '../context/DesktopToolbarContext'
import { createNotification } from '../notifications'
import { trackUserActivity } from '../utils/userActivity'
import { sameEmail } from '../utils/access'

function getMemberTags(member) {
  return Array.isArray(member.tags) && member.tags.length > 0 ? member.tags : ['Membre']
}

export default function Presences({ user, userData }) {
  const { t } = useTranslation()
  const { C } = useTheme()
  const { setToolbar } = useDesktopToolbar()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [highlightedId, setHighlightedId] = useState('')
  const [evenements, setEvenements] = useState([])
  const [membres, setMembres] = useState([])
  const [approvedUsers, setApprovedUsers] = useState([])
  const [allPresences, setAllPresences] = useState({})
  const [availableTags, setAvailableTags] = useState(DEFAULT_MEMBRE_TAGS)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [loadingPresences, setLoadingPresences] = useState(true)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [newEventForm, setNewEventForm] = useState({ titre: '', date: new Date().toISOString().slice(0, 10), tags: ['Membre'] })
  const [savingEvent, setSavingEvent] = useState(false)

  const desktopActions = useMemo(() => (
    <button className="desktop-toolbar-btn" type="button" onClick={() => setShowNewEvent(true)}>
      <CalendarPlus size={16} /> {t('presences.nouvelEvenement')}
    </button>
  ), [t])

  useEffect(() => {
    setToolbar({ actions: desktopActions })
    return () => setToolbar({ actions: null })
  }, [desktopActions, setToolbar])

  useEffect(() => {
    const q = query(collection(db, 'evenements'), orderBy('date', 'desc'))
    return onSnapshot(q, snap => {
      setEvenements(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoadingEvents(false)
    }, () => setLoadingEvents(false))
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'membres'), orderBy('nom'))
    return onSnapshot(q, snap => {
      setMembres(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoadingMembers(false)
    }, () => setLoadingMembers(false))
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), snap => {
      setApprovedUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.approuve === true))
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'presences'), snap => {
      const map = {}
      snap.docs.forEach(d => {
        const data = d.data()
        map[`${data.eventId}_${data.membreId}`] = data.present
      })
      setAllPresences(map)
      setLoadingPresences(false)
    }, () => setLoadingPresences(false))
  }, [])

  useEffect(() => {
    return onSnapshot(doc(db, 'appSettings', 'membreTags'), snap => {
      if (snap.exists() && Array.isArray(snap.data().list) && snap.data().list.length > 0) {
        setAvailableTags(snap.data().list)
      }
    })
  }, [])

  useEffect(() => {
    const id = searchParams.get('presence')
    if (!id || evenements.length === 0) return
    setHighlightedId(id)
    const scrollTimer = window.setTimeout(() => {
      document.querySelector(`[data-item-id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 180)
    const clearTimer = window.setTimeout(() => {
      setHighlightedId('')
      setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('presence'); return n }, { replace: true })
    }, 2600)
    return () => { window.clearTimeout(scrollTimer); window.clearTimeout(clearTimer) }
  }, [searchParams, evenements])

  function getEventStats(event) {
    const eventTags = event.tags || []
    const relevant = eventTags.length === 0
      ? presenceMembers
      : presenceMembers.filter(m => getMemberTags(m).some(t => eventTags.includes(t)))
    const presentCount = relevant.filter(m => allPresences[`${event.id}_${m.id}`] === true).length
    return { total: relevant.length, presentCount }
  }

  function toggleNewEventTag(tag) {
    setNewEventForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }))
  }

  async function createEvent() {
    if (!newEventForm.titre.trim()) return
    trackUserActivity(user, 'Crée un événement de présence', '/presences')
    setSavingEvent(true)
    try {
      const ref = await addDoc(collection(db, 'evenements'), {
        titre: newEventForm.titre.trim(),
        date: newEventForm.date,
        tags: newEventForm.tags,
        createdAt: new Date().toISOString(),
      })
      await createNotification({
        type: 'presence',
        titre: 'Nouvel événement de présence créé',
        detail: `${newEventForm.titre.trim()} - ${toDisplayDate(newEventForm.date)}`,
        cible: newEventForm.titre.trim(),
        route: `/presences?presence=${ref.id}`,
        metadata: { presenceId: ref.id },
      })
      setShowNewEvent(false)
      setNewEventForm({ titre: '', date: new Date().toISOString().slice(0, 10), tags: ['Membre'] })
      navigate(`/presences/${ref.id}`)
    } catch (e) { console.error(e) }
    setSavingEvent(false)
  }

  function formatDateFR(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const presenceMembers = useMemo(() => {
    const byId = new Map(membres.map(m => [m.id, m]))
    approvedUsers.forEach(u => {
      if (!u.email || membres.some(m => sameEmail(m.email, u.email))) return
      byId.set(u.id, {
        id: u.id,
        nom: u.nom || u.email,
        prenoms: '',
        nomPrefere: '',
        email: u.email,
        staff: true,
        staffRole: u.staffRole || '',
        tags: ['Membre'],
        dateAjout: u.dateInscription || '',
      })
    })
    return Array.from(byId.values())
  }, [membres, approvedUsers])

  return (
    <div className="page-container-locked sin" style={{ background: C.bg }}>

      <div className="textured-page-header desktop-hide-page-header" style={{ '--header-color': '#7c3aed', padding: '20px 20px 16px', paddingTop: 'max(20px, env(safe-area-inset-top))', borderBottom: `1px solid ${C.bord}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>{t('presences.title')}</div>
            <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 2 }}>{evenements.length} réunion{evenements.length !== 1 ? 's' : ''}</div>
          </div>
          <button
            onClick={() => setShowNewEvent(true)}
            style={{ padding: '9px 16px', borderRadius: 12, border: 'none', background: C.teal, color: '#fff', cursor: 'pointer', fontSize: 'var(--font-sm)', fontWeight: 600, fontFamily: 'inherit' }}
          >
            + {t('presences.nouvelEvenement')}
          </button>
        </div>
      </div>

      <div className="page-content presence-events-grid" style={{ paddingBottom: '5rem' }}>
        {loadingEvents || loadingMembers || loadingPresences ? (
          <LoadingState label={t('common.loading')} compact />
        ) : evenements.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.t2, padding: '3rem 1rem', fontSize: 'var(--font-sm)' }}>
            {t('presences.aucunEvenement')}
          </div>
        ) : evenements.map(ev => {
          const { total, presentCount } = getEventStats(ev)
          const pct = total ? Math.round((presentCount / total) * 100) : 0
          const barColor = pct < 40 ? C.coral : pct < 75 ? C.amber : C.teal
          const tags = ev.tags || []
          return (
            <button
              key={ev.id}
              data-item-id={ev.id}
              className={`presence-event-card${highlightedId === ev.id ? ' item-highlighted' : ''}`}
              type="button"
              onClick={() => navigate(`/presences/${ev.id}`)}
              style={{ width: '100%', display: 'block', textAlign: 'left', background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16, padding: '14px 16px', marginBottom: 10, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: C.t1, marginBottom: 2 }}>{ev.titre}</div>
                  <div style={{ fontSize: 'var(--font-xs)', color: C.t2 }}>{formatDateFR(ev.date)}</div>
                  {tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 7 }}>
                      {tags.map(tag => (
                        <span key={tag} style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontSize: 10, fontWeight: 700 }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: C.t1 }}>{presentCount}<span style={{ color: C.t3, fontWeight: 400 }}>/{total}</span></div>
                    <div style={{ fontSize: 10, color: C.t3 }}>{total > 0 ? `${pct}%` : '—'}</div>
                  </div>
                  <ChevronRight size={16} color={C.t3} />
                </div>
              </div>
              {total > 0 && (
                <div style={{ marginTop: 10, height: 4, borderRadius: 4, background: C.surf3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: barColor, width: `${pct}%`, transition: 'width .4s' }} />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {showNewEvent && (
        <Portal>
        <div className="bottom-sheet-overlay" onClick={() => setShowNewEvent(false)}>
          <div className="bottom-sheet fixed-footer-sheet" onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <h2 className="dialog-title">{t('presences.nouvelEvenement')}</h2>
            <div className="dialog-content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">{t('presences.nom')} *</label>
                <input
                  type="text"
                  value={newEventForm.titre}
                  onChange={e => setNewEventForm(p => ({ ...p, titre: e.target.value }))}
                  placeholder="Ex: Culte du dimanche, Réunion Mpitarika..."
                  className="form-input"
                  autoFocus
                />
              </div>
              <div>
                <label className="form-label">{t('presences.date')}</label>
                <input
                  type="date"
                  value={newEventForm.date}
                  onChange={e => setNewEventForm(p => ({ ...p, date: e.target.value }))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Tag size={12} /> Participants par tag
                </label>
                <div style={{ fontSize: 'var(--font-xs)', color: C.t3, marginBottom: 8 }}>
                  Aucun tag = tous les membres
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {availableTags.map(tag => {
                    const selected = newEventForm.tags.includes(tag)
                    const count = presenceMembers.filter(m => getMemberTags(m).includes(tag)).length
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleNewEventTag(tag)}
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
                {newEventForm.tags.length > 0 && (
                  <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', fontSize: 'var(--font-xs)', color: '#6366f1', fontWeight: 600 }}>
                    {(() => {
                      const n = presenceMembers.filter(m => getMemberTags(m).some(t => newEventForm.tags.includes(t))).length
                      return `${n} membre${n !== 1 ? 's' : ''} correspondent`
                    })()}
                  </div>
                )}
              </div>
            </div>
            <div className="dialog-footer">
              <button onClick={() => setShowNewEvent(false)} className="btn-secondary materiel-footer-btn">{t('common.cancel')}</button>
              <button
                onClick={createEvent}
                disabled={savingEvent || !newEventForm.titre.trim()}
                className="materiel-primary-btn"
              >
                {savingEvent ? t('common.saving') : t('presences.nouvelEvenement')}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
