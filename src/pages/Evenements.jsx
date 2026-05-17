import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { db } from '../firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Pin, Plus, Trash2, MapPin, Clock, Calendar, Search, X, Package2, Tag } from 'lucide-react'
import { toDisplayDate } from '../utils'
import { createNotification } from '../notifications'
import { useTheme } from '../context/ThemeContext'
import Portal from '../components/Portal'
import { useDesktopToolbar } from '../context/DesktopToolbarContext'
import { DEFAULT_MEMBRE_TAGS } from '../constants'
import { trackUserActivity } from '../utils/userActivity'
const EMPTY = { nom: '', dateDebut: '', dateFin: '', heureDebut: '', heureFin: '', lieu: '', materielsReserves: [], tags: ['Membre'] }

function useNow() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])
  return now
}

function parseDate(dateStr, timeStr, endOfDay = false) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  if (timeStr) {
    const [h, min] = timeStr.split(':').map(Number)
    return new Date(y, m - 1, d, h, min)
  }
  return new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0)
}

function buildCountdown(startDate, now) {
  const diff = startDate - now
  if (diff <= 0) return null
  const totalMin = Math.floor(diff / 60000)
  const days  = Math.floor(totalMin / 1440)
  const hours = Math.floor((totalMin % 1440) / 60)
  const mins  = totalMin % 60
  if (days >= 1) return `dans ${days} jour${days > 1 ? 's' : ''}${hours > 0 ? ` ${hours}h` : ''}`
  if (hours >= 1) return `dans ${hours}h ${mins}min`
  return `dans ${mins} min`
}

function formatDateRange(dateDebut, dateFin) {
  if (!dateDebut) return ''
  const d1 = toDisplayDate(dateDebut)
  if (!dateFin || dateFin === dateDebut) return d1
  return `${d1} → ${toDisplayDate(dateFin)}`
}

function formatTimeRange(heureDebut, heureFin) {
  if (!heureDebut) return ''
  if (!heureFin) return heureDebut
  return `${heureDebut} → ${heureFin}`
}

export default function Evenements({ user }) {
  const { t } = useTranslation()
  const { C } = useTheme()
  const { setToolbar } = useDesktopToolbar()
  const now = useNow()
  const [searchParams, setSearchParams] = useSearchParams()
  const [evenements, setEvenements] = useState([])
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const [highlightedId, setHighlightedId] = useState('')
  const [materiels, setMateriels] = useState([])
  const [materielSearch, setMaterielSearch] = useState('')
  const [showMaterielDropdown, setShowMaterielDropdown] = useState(false)
  const [membres, setMembres] = useState([])
  const [availableTags, setAvailableTags] = useState(DEFAULT_MEMBRE_TAGS)

  useEffect(() => {
    const id = searchParams.get('event')
    if (!id || loading || evenements.length === 0) return
    setHighlightedId(id)
    const scrollTimer = window.setTimeout(() => {
      document.querySelector(`[data-item-id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 180)
    const clearTimer = window.setTimeout(() => {
      setHighlightedId('')
      setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('event'); return n }, { replace: true })
    }, 2600)
    return () => { window.clearTimeout(scrollTimer); window.clearTimeout(clearTimer) }
  }, [searchParams, evenements, loading])

  useEffect(() => {
    const q = query(collection(db, 'evenements_agenda'), orderBy('dateDebut'))
    return onSnapshot(q, snap => {
      setEvenements(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'materiels'), orderBy('nom'))
    return onSnapshot(q, snap => {
      setMateriels(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.statut !== 'archive'))
    })
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'membres'), orderBy('nom'))
    return onSnapshot(q, snap => setMembres(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  useEffect(() => {
    return onSnapshot(doc(db, 'appSettings', 'membreTags'), snap => {
      if (snap.exists() && Array.isArray(snap.data().list) && snap.data().list.length > 0) {
        setAvailableTags(snap.data().list)
      }
    })
  }, [])

  function openAdd()  { setForm(EMPTY); setSheet('add') }
  function openEdit(e) {
    setForm({
      nom: e.nom || '',
      dateDebut: e.dateDebut || '',
      dateFin: e.dateFin || '',
      heureDebut: e.heureDebut || '',
      heureFin: e.heureFin || '',
      lieu: e.lieu || '',
      materielsReserves: Array.isArray(e.materielsReserves) ? e.materielsReserves : [],
      tags: Array.isArray(e.tags) ? e.tags : ['Membre'],
    })
    setSheet(e)
  }

  function toggleTag(tag) {
    setForm(p => ({ ...p, tags: p.tags.includes(tag) ? p.tags.filter(t => t !== tag) : [...p.tags, tag] }))
  }
  function closeSheet() { setSheet(null); setForm(EMPTY); setMaterielSearch(''); setShowMaterielDropdown(false) }

  const filteredMaterielOptions = useMemo(() => {
    const term = materielSearch.trim().toLowerCase()
    const reservedIds = new Set(form.materielsReserves.map(m => m.id))
    return materiels
      .filter(m => !reservedIds.has(m.id) && (!term || m.nom.toLowerCase().includes(term) || (m.categorie || '').toLowerCase().includes(term)))
      .slice(0, 6)
  }, [materiels, materielSearch, form.materielsReserves])

  function addMaterielReserve(m) {
    setForm(p => ({ ...p, materielsReserves: [...p.materielsReserves, { id: m.id, nom: m.nom, categorie: m.categorie || '' }] }))
    setMaterielSearch('')
    setShowMaterielDropdown(false)
  }

  function removeMaterielReserve(id) {
    setForm(p => ({ ...p, materielsReserves: p.materielsReserves.filter(m => m.id !== id) }))
  }

  async function save() {
    if (!form.nom.trim() || !form.dateDebut) return
    trackUserActivity(user, sheet === 'add' ? 'Crée un événement' : 'Modifie un événement', '/evenements')
    setSaving(true)
    try {
      const data = {
        nom: form.nom.trim(),
        dateDebut: form.dateDebut,
        dateFin: form.dateFin || form.dateDebut,
        heureDebut: form.heureDebut,
        heureFin: form.heureFin,
        lieu: form.lieu.trim(),
        materielsReserves: form.materielsReserves,
        tags: form.tags,
      }
      if (sheet === 'add') {
        const ref = await addDoc(collection(db, 'evenements_agenda'), data)
        // Auto-créer la fiche de présence liée
        const presenceRef = await addDoc(collection(db, 'evenements'), {
          titre: data.nom,
          date: data.dateDebut,
          tags: data.tags,
          evenementAgendaId: ref.id,
          createdAt: new Date().toISOString(),
        })
        await updateDoc(doc(db, 'evenements_agenda', ref.id), { presenceEventId: presenceRef.id })
        await createNotification({
          type: 'evenement',
          titre: 'Nouvel événement créé',
          detail: `${data.nom} - ${toDisplayDate(data.dateDebut)}`,
          cible: data.nom,
          route: '/evenements',
          metadata: { eventId: ref.id },
        })
      } else {
        await updateDoc(doc(db, 'evenements_agenda', sheet.id), data)
        // Mettre à jour ou créer la fiche de présence liée
        if (sheet.presenceEventId) {
          await updateDoc(doc(db, 'evenements', sheet.presenceEventId), {
            titre: data.nom,
            date: data.dateDebut,
            tags: data.tags,
          })
        } else {
          const presenceRef = await addDoc(collection(db, 'evenements'), {
            titre: data.nom,
            date: data.dateDebut,
            tags: data.tags,
            evenementAgendaId: sheet.id,
            createdAt: new Date().toISOString(),
          })
          await updateDoc(doc(db, 'evenements_agenda', sheet.id), { presenceEventId: presenceRef.id })
        }
        await createNotification({
          type: 'evenement',
          titre: 'Événement modifié',
          detail: `${data.nom} - ${toDisplayDate(data.dateDebut)}`,
          cible: data.nom,
          route: '/evenements',
          metadata: { eventId: sheet.id },
        })
      }
      closeSheet()
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  async function confirmDelete() {
    if (!confirmDel) return
    trackUserActivity(user, 'Supprime un événement', '/evenements')
    await deleteDoc(doc(db, 'evenements_agenda', confirmDel.id))
    await createNotification({
      type: 'evenement',
      titre: 'Événement supprimé',
      detail: confirmDel.nom || '',
      cible: confirmDel.nom || '',
      route: '/evenements',
    })
    setConfirmDel(null)
  }

  async function togglePin(e) {
    trackUserActivity(user, e.pinned ? 'Désépingle un événement' : 'Épingle un événement', '/evenements')
    await updateDoc(doc(db, 'evenements_agenda', e.id), { pinned: !e.pinned })
  }

  const pinned = []
  const upcoming = []
  const past = []
  evenements.forEach(e => {
    const endDate   = parseDate(e.dateFin || e.dateDebut, e.heureFin, true)
    const startDate = parseDate(e.dateDebut, e.heureDebut)
    const item = { ...e, _start: startDate, _end: endDate }
    if (e.pinned) pinned.push(item)
    else if (endDate && endDate > now) upcoming.push(item)
    else past.push(item)
  })
  pinned.sort((a, b) => a._start - b._start)
  upcoming.sort((a, b) => a._start - b._start)
  past.sort((a, b) => b._end - a._end)
  const sorted = [...pinned, ...upcoming, ...past]

  const isEditing = sheet && sheet !== 'add'

  const desktopActions = useMemo(() => (
    <button className="desktop-toolbar-btn" type="button" onClick={openAdd}>
      <Plus size={16} /> {t('common.add')}
    </button>
  ), [t])

  useEffect(() => {
    setToolbar({ actions: desktopActions })
    return () => setToolbar({ actions: null })
  }, [desktopActions, setToolbar])

  return (
    <div className="page-container sin" style={{ background: C.bg, paddingBottom: 'calc(86px + env(safe-area-inset-bottom))' }}>

      {/* Header */}
      <div className="f1 textured-page-header desktop-hide-page-header" style={{ '--header-color': '#10b981', padding: '20px 20px 18px', paddingTop: 'max(20px, env(safe-area-inset-top))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>{t('evenements.title')}</div>
          <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 2 }}>{evenements.length} événement{evenements.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="header-action" onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, border: 'none', background: C.teal, color: '#fff', cursor: 'pointer', fontSize: 'var(--font-sm)', fontWeight: 600 }}>
          <Plus size={14} color="#fff" /> {t('common.add')}
        </button>
      </div>

      {/* Liste */}
      <div className="f2 scroll-bottom-safe" style={{ padding: '0 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: C.t2, padding: '2rem', fontSize: 'var(--font-sm)' }}>{t('common.loading')}</div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.t2, padding: '2rem', fontSize: 'var(--font-sm)' }}>{t('evenements.aucunEvenement')}</div>
        ) : sorted.map(e => {
          const isPast = !e._end || e._end <= now
          const countdown = e._start && !isPast ? buildCountdown(e._start, now) : null
          const dateLabel = formatDateRange(e.dateDebut, e.dateFin)
          const timeLabel = formatTimeRange(e.heureDebut, e.heureFin)
          return (
            <div key={e.id} data-item-id={e.id} className={highlightedId === e.id ? 'item-highlighted' : ''} onClick={() => openEdit(e)} style={{ background: C.surf, border: `1px solid ${isPast ? C.bord : C.teal + '40'}`, borderRadius: 18, padding: 18, marginBottom: 12, cursor: 'pointer', position: 'relative', overflow: 'hidden', opacity: isPast ? 0.7 : 1 }}>
              {!isPast && <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: C.teal, borderRadius: '3px 0 0 3px' }} />}
              <div style={{ paddingLeft: isPast ? 0 : 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ flex: 1, paddingRight: 8 }}>
                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: C.t1, lineHeight: 1.3 }}>{e.nom}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isPast
                      ? <div style={{ padding: '3px 9px', borderRadius: 20, background: C.surf3, fontSize: 'var(--font-xs)', fontWeight: 500, color: C.t3 }}>Terminé</div>
                      : countdown && <div style={{ padding: '3px 9px', borderRadius: 20, background: C.tealD, border: `1px solid ${C.teal}50`, fontSize: 'var(--font-xs)', fontWeight: 600, color: C.teal, whiteSpace: 'nowrap' }}>{countdown}</div>
                    }
                    <button onClick={ev => { ev.stopPropagation(); togglePin(e) }} style={{ width: 28, height: 28, borderRadius: 9, border: `1px solid ${e.pinned ? C.teal + '80' : C.bord}`, background: e.pinned ? C.tealD : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Pin size={13} color={e.pinned ? C.teal : C.t3} fill={e.pinned ? C.teal : 'none'} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {dateLabel && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-xs)', color: C.t2 }}><Calendar size={13} color={C.t3} />{dateLabel}{timeLabel && <><span style={{ color: C.t3 }}>·</span><Clock size={13} color={C.t3} />{timeLabel}</>}</div>}
                  {e.lieu && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-xs)', color: C.t2 }}><MapPin size={13} color={C.t3} />{e.lieu}</div>}
                  {Array.isArray(e.materielsReserves) && e.materielsReserves.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--font-xs)', color: C.t3 }}>
                      <Package2 size={12} color={C.t3} />
                      {e.materielsReserves.map(m => m.nom).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom sheet */}
      {sheet !== null && (
        <Portal>
        <div className="bottom-sheet-overlay" onClick={closeSheet}>
          <div className="bottom-sheet fixed-footer-sheet" onClick={ev => ev.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 className="dialog-title" style={{ margin: 0 }}>{isEditing ? t('evenements.modifier') : t('evenements.nouvelEvenement')}</h2>
              {isEditing && <button type="button" className="task-icon-btn" onClick={() => { setConfirmDel(sheet); closeSheet() }} style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#ef4444' }}><Trash2 size={16} /></button>}
            </div>
            <div className="dialog-content">
              <div><label className="form-label">{t('evenements.nom')} *</label><input type="text" value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} placeholder={t('evenements.nom')} className="form-input" /></div>
              <div>
                <label className="form-label">{t('evenements.date')} *</label>
                <div className="flex-center gap-10">
                  <div className="flex-1"><div className="label-helper">Début</div><input type="date" value={form.dateDebut} onChange={e => setForm(p => ({ ...p, dateDebut: e.target.value }))} className="form-input" /></div>
                  <div className="flex-1"><div className="label-helper">Fin</div><input type="date" value={form.dateFin} min={form.dateDebut} onChange={e => setForm(p => ({ ...p, dateFin: e.target.value }))} className="form-input" /></div>
                </div>
              </div>
              <div>
                <label className="form-label">Heures</label>
                <div className="flex-center gap-10">
                  <div className="flex-1"><div className="label-helper">Début</div><input type="time" value={form.heureDebut} onChange={e => setForm(p => ({ ...p, heureDebut: e.target.value }))} className="form-input" /></div>
                  <div className="flex-1"><div className="label-helper">Fin</div><input type="time" value={form.heureFin} onChange={e => setForm(p => ({ ...p, heureFin: e.target.value }))} className="form-input" /></div>
                </div>
              </div>
              <div><label className="form-label">Lieu</label><input type="text" value={form.lieu} onChange={e => setForm(p => ({ ...p, lieu: e.target.value }))} placeholder="Salle, adresse..." className="form-input" /></div>

              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Tag size={12} />Participants par tag</label>
                <div style={{ fontSize: 'var(--font-xs)', color: C.t3, marginBottom: 8 }}>Aucun tag = tous les membres</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {availableTags.map(tag => {
                    const selected = form.tags.includes(tag)
                    const count = membres.filter(m => Array.isArray(m.tags) && m.tags.includes(tag)).length
                    return (
                      <button key={tag} type="button" onClick={() => toggleTag(tag)}
                        style={{ padding: '7px 14px', borderRadius: 999,
                          border: `1.5px solid ${selected ? '#6366f1' : C.bord}`,
                          background: selected ? 'rgba(99,102,241,0.12)' : C.surf2,
                          color: selected ? '#6366f1' : C.t2,
                          fontSize: 'var(--font-xs)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {tag} <span style={{ opacity: 0.7 }}>({count})</span>
                      </button>
                    )
                  })}
                </div>
                {form.tags.length > 0 && (
                  <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10,
                    background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                    fontSize: 'var(--font-xs)', color: '#6366f1', fontWeight: 600 }}>
                    {(() => {
                      const n = membres.filter(m => Array.isArray(m.tags) && m.tags.some(t => form.tags.includes(t))).length
                      return `${n} membre${n !== 1 ? 's' : ''} correspondent`
                    })()}
                  </div>
                )}
              </div>

              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Package2 size={13} />Matériels nécessaires</label>
                <div style={{ position: 'relative' }}>
                  <div className="tx-search-wrapper" style={{ marginBottom: 0 }}>
                    <div className="tx-search-icon"><Search size={14} /></div>
                    <input
                      className="tx-search-input"
                      type="text"
                      placeholder="Rechercher un matériel..."
                      value={materielSearch}
                      onChange={e => { setMaterielSearch(e.target.value); setShowMaterielDropdown(true) }}
                      onFocus={() => setShowMaterielDropdown(true)}
                      onBlur={() => setTimeout(() => setShowMaterielDropdown(false), 150)}
                      style={{ paddingLeft: 38 }}
                    />
                    {materielSearch && (
                      <button type="button" className="tx-search-clear" onClick={() => { setMaterielSearch(''); setShowMaterielDropdown(false) }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {showMaterielDropdown && filteredMaterielOptions.length > 0 && (
                    <div className="evenement-materiel-dropdown" style={{ background: C.surf, border: `1px solid ${C.bord}` }}>
                      {filteredMaterielOptions.map((m, i) => (
                        <button
                          key={m.id}
                          type="button"
                          onMouseDown={() => addMaterielReserve(m)}
                          className="evenement-materiel-option"
                          style={{ borderBottom: i < filteredMaterielOptions.length - 1 ? `1px solid ${C.bord}` : 'none', color: C.t1 }}
                        >
                          <span style={{ flex: 1 }}>{m.nom}{m.categorie ? <span style={{ color: C.t3, fontWeight: 400, marginLeft: 6 }}>· {m.categorie}</span> : null}</span>
                          <span className={`evenement-materiel-statut ${m.statut === 'disponible' ? 'dispo' : 'indispo'}`}>
                            {m.statut === 'disponible' ? 'Dispo' : 'Indispo'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {form.materielsReserves.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {form.materielsReserves.map(m => (
                      <div key={m.id} className="evenement-materiel-chip" style={{ background: C.tealD, border: `1px solid ${C.teal}40`, color: C.teal }}>
                        <Package2 size={11} />
                        <span>{m.nom}</span>
                        <button type="button" onClick={() => removeMaterielReserve(m.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex', lineHeight: 1 }}>
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="dialog-footer">
              <button onClick={closeSheet} className="btn-secondary materiel-footer-btn">{t('common.cancel')}</button>
              <button onClick={save} disabled={saving || !form.nom.trim() || !form.dateDebut} className="materiel-primary-btn">
                {saving ? t('common.saving') : isEditing ? t('common.save') : t('common.add')}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Confirmation suppression */}
      {confirmDel && (
        <Portal>
        <div className="modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title mb-8">{t('evenements.supprimerConfirm')}</h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: 'var(--font-sm)', color: C.t2 }}>{confirmDel.nom} sera définitivement supprimé.</p>
            <div className="dialog-footer">
              <button onClick={() => setConfirmDel(null)} className="btn-secondary materiel-footer-btn">{t('common.cancel')}</button>
              <button onClick={confirmDelete} className="materiel-primary-btn" style={{ background: C.coral, color: '#fff' }}>{t('evenements.supprimer')}</button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
