import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../firebase'
import { addDoc, collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { ArrowLeft, Pencil, Share2, Search, Tag, Trash2 } from 'lucide-react'
import { toDisplayDate } from '../utils'
import { useTheme } from '../context/ThemeContext'
import { DEFAULT_MEMBRE_TAGS, ADMIN_EMAIL } from '../constants'
import Portal from '../components/Portal'
import { useDesktopToolbar } from '../context/DesktopToolbarContext'

export default function PresenceDetail({ user, userData }) {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { C } = useTheme()
  const { setToolbar } = useDesktopToolbar()
  const [event, setEvent] = useState(null)
  const [membres, setMembres] = useState([])
  const [presences, setPresences] = useState({})
  const [availableTags, setAvailableTags] = useState(DEFAULT_MEMBRE_TAGS)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [isSharingReport, setIsSharingReport] = useState(false)
  const isAdmin = user?.email === ADMIN_EMAIL

  useEffect(() => {
    return onSnapshot(doc(db, 'evenements', id), snap => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() }
        setEvent(data)
      }
    })
  }, [id])

  useEffect(() => {
    const q = query(collection(db, 'membres'), orderBy('nom'))
    return onSnapshot(q, snap => setMembres(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'presences'), snap => {
      const map = {}
      snap.docs.forEach(d => {
        const data = d.data()
        if (data.eventId === id) map[data.membreId] = data.present
      })
      setPresences(map)
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
        normSearch(m.prenoms).includes(normSearch(search))
      )
    : tagFilteredMembres

  const presentCount = tagFilteredMembres.filter(m => presences[m.id] === true).length
  const presencePercent = tagFilteredMembres.length ? Math.round((presentCount / tagFilteredMembres.length) * 100) : 0
  const progressColor = presencePercent < 40 ? C.coral : presencePercent < 75 ? C.amber : C.teal

  async function togglePresence(membre) {
    const docId = `${id}_${membre.id}`
    const nowPresent = !presences[membre.id]
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
      setPresences(prev => ({ ...prev, [membre.id]: nowPresent }))
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
    setSavingEdit(true)
    try {
      await updateDoc(doc(db, 'evenements', id), {
        titre: editForm.titre.trim(),
        date: editForm.date,
        tags: editForm.tags,
      })
      setShowEdit(false)
    } catch (e) { console.error(e) }
    setSavingEdit(false)
  }

  async function deleteEvent() {
    if (!window.confirm(`Supprimer "${event.titre}" ? Les données de présence seront conservées.`)) return
    await deleteDoc(doc(db, 'evenements', id))
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

  const desktopActions = useMemo(() => (
    <>
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
  ), [event, isSharingReport, tagFilteredMembres.length])

  useEffect(() => {
    setToolbar({ actions: desktopActions })
    return () => setToolbar({ actions: null })
  }, [desktopActions, setToolbar])

  function buildReportText(presents, absents) {
    const tagLabel = eventTags.length ? ` [${eventTags.join(', ')}]` : ''
    let t = `Présence ${event.titre}${tagLabel} — ${formatDateFR(event.date)}\n\n`
    t += `✅ Présents (${presents.length})\n${presents.length ? presents.map(displayName).join('\n') : 'Aucun'}`
    t += `\n\n❌ Absents (${absents.length})\n${absents.length ? absents.map(displayName).join('\n') : 'Aucun'}`
    t += `\n\n👥 Total : ${tagFilteredMembres.length} — Taux : ${presencePercent} %`
    return t
  }

  async function partager() {
    if (!event || tagFilteredMembres.length === 0 || isSharingReport) return
    const presents = tagFilteredMembres.filter(m => presences[m.id] === true)
    const absents  = tagFilteredMembres.filter(m => presences[m.id] !== true)
    const text = buildReportText(presents, absents)

    setIsSharingReport(true)
    try {
      if (navigator.share) {
        await navigator.share({ title: `Présence – ${event.titre}`, text })
      } else {
        await navigator.clipboard.writeText(text)
      }
      // Share succeeded — publish directly to Messages
      await publishReportToMessages(presents, absents)
    } catch (err) {
      if (err?.name !== 'AbortError') console.error('Share error:', err)
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
      presents: presents.map(m => ({ id: m.id, displayName: displayName(m) })),
      absents:  absents.map(m => ({ id: m.id, displayName: displayName(m) })),
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
    <div className="page-container-locked sin" style={{ background: C.bg }}>

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
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
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

        {/* Stats + search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: tagFilteredMembres.length > 0 ? 12 : 0 }}>
          <div style={{ fontSize: 'var(--font-xs)', color: C.t2 }}>
            <span style={{ fontWeight: 700, color: C.t1 }}>{presentCount}</span> / {tagFilteredMembres.length} {t('presences.presents')}
          </div>
        </div>

        {tagFilteredMembres.length > 0 && (
          <>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.t3, pointerEvents: 'none', display: 'flex' }}>
                <Search size={15} />
              </span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('membres.rechercher')}
                style={{ width: '100%', padding: '11px 14px 11px 40px', borderRadius: 12, border: `1px solid ${C.bord2}`, background: C.surf2, color: C.t1, fontSize: 'var(--font-sm)', outline: 'none' }}
              />
            </div>
            <div style={{ height: 5, borderRadius: 5, background: C.surf3, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 5, background: progressColor, width: `${presencePercent}%`, transition: 'width .4s cubic-bezier(.25,.8,.25,1), background .3s' }} />
            </div>
          </>
        )}
      </div>

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
          return (
            <div
              key={m.id}
              onClick={() => !isSaving && togglePresence(m)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: present ? `${C.teal}0D` : C.surf,
                border: `1px solid ${present ? C.teal + '40' : C.bord}`,
                borderRadius: 16, padding: '12px 14px', marginBottom: 8,
                cursor: isSaving ? 'wait' : 'pointer',
                transition: 'background .2s, border-color .2s, opacity .2s',
                opacity: isSaving ? 0.6 : 1,
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 14, flexShrink: 0, background: present ? C.tealD : C.surf2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--font-sm)', color: present ? C.teal : C.t2 }}>
                {(m.nom || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nom} {m.prenoms}</div>
              </div>
              <div style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, background: present ? C.teal : C.surf3, border: present ? 'none' : `1px solid ${C.bord2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s, border-color .2s, transform .25s cubic-bezier(.34,1.56,.64,1)', transform: present ? 'scale(1)' : 'scale(0.9)' }}>
                {present && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7L5.5 10L11.5 4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit sheet */}
      {showEdit && editForm && (
        <Portal>
        <div className="bottom-sheet-overlay" onClick={() => setShowEdit(false)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <h2 className="dialog-title mb-16">{t('common.edit')} {t('presences.evenement')}</h2>
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
            <div className="dialog-footer" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  onClick={deleteEvent}
                  style={{ padding: '13px', borderRadius: 12, border: 'none', background: 'rgba(244,63,94,0.1)', color: '#f43f5e', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Trash2 size={14} /> {t('common.delete')}
                </button>
                <button
                  onClick={saveEdit}
                  disabled={savingEdit || !editForm.titre.trim()}
                  style={{ padding: '13px', borderRadius: 12, border: 'none', background: C.teal, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (savingEdit || !editForm.titre.trim()) ? 0.6 : 1 }}
                >
                  {savingEdit ? t('presences.enregistrement') : t('common.save')}
                </button>
              </div>
              <button onClick={() => setShowEdit(false)} className="btn-secondary" style={{ width: '100%', padding: '13px' }}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}


    </div>
  )
}
