import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Trash2, MapPin, Clock, Calendar } from 'lucide-react'
import { toDisplayDate } from '../utils'
import { createNotification } from '../notifications'

const C = '#E8445A'
const EMPTY = { nom: '', dateDebut: '', dateFin: '', heureDebut: '', heureFin: '', lieu: '' }

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

export default function Evenements({ user, userData }) {
  const navigate = useNavigate()
  const now = useNow()
  const [evenements, setEvenements] = useState([])
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'evenements_agenda'), orderBy('dateDebut'))
    return onSnapshot(q, snap => {
      setEvenements(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [])

  function openAdd()  { setForm(EMPTY); setSheet('add') }
  function openEdit(e) {
    setForm({ nom: e.nom || '', dateDebut: e.dateDebut || '', dateFin: e.dateFin || '', heureDebut: e.heureDebut || '', heureFin: e.heureFin || '', lieu: e.lieu || '' })
    setSheet(e)
  }
  function closeSheet() { setSheet(null); setForm(EMPTY) }

  async function save() {
    if (!form.nom.trim() || !form.dateDebut) return
    setSaving(true)
    try {
      const data = {
        nom: form.nom.trim(),
        dateDebut: form.dateDebut,
        dateFin: form.dateFin || form.dateDebut,
        heureDebut: form.heureDebut,
        heureFin: form.heureFin,
        lieu: form.lieu.trim(),
      }
      if (sheet === 'add') {
        await addDoc(collection(db, 'evenements_agenda'), data)
        await createNotification({
          type: 'evenement',
          titre: 'Nouvel événement créé',
          detail: `${data.nom} - ${toDisplayDate(data.dateDebut)}`,
          cible: data.nom,
          route: '/evenements',
        })
      } else {
        await updateDoc(doc(db, 'evenements_agenda', sheet.id), data)
        await createNotification({
          type: 'evenement',
          titre: 'Événement modifié',
          detail: `${data.nom} - ${toDisplayDate(data.dateDebut)}`,
          cible: data.nom,
          route: '/evenements',
        })
      }
      closeSheet()
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  async function confirmDelete() {
    if (!confirmDel) return
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

  const upcoming = []
  const past = []
  evenements.forEach(e => {
    const endDate   = parseDate(e.dateFin || e.dateDebut, e.heureFin, true)
    const startDate = parseDate(e.dateDebut, e.heureDebut)
    if (endDate && endDate > now) upcoming.push({ ...e, _start: startDate, _end: endDate })
    else past.push({ ...e, _start: startDate, _end: endDate })
  })
  upcoming.sort((a, b) => a._start - b._start)
  past.sort((a, b) => b._end - a._end)
  const sorted = [...upcoming, ...past]

  const isEditing = sheet && sheet !== 'add'

  return (
    <div className="page-container" style={{ paddingBottom: '2rem' }}>

      {/* Header */}
      <div className="page-header" style={{ background: C, paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => navigate('/')} className="page-back-btn">
            ‹
          </button>
          <div style={{ flex: 1 }}>
            <h1 className="page-title">Événements</h1>
            <p className="page-subtitle">
              {evenements.length} événement{evenements.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Liste */}
      <div style={{ padding: '1rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem', fontSize: '13px' }}>Chargement...</div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem', fontSize: '13px' }}>Aucun événement</div>
        ) : sorted.map(e => {
          const isPast = !e._end || e._end <= now
          const countdown = e._start && !isPast ? buildCountdown(e._start, now) : null
          const dateLabel = formatDateRange(e.dateDebut, e.dateFin)
          const timeLabel = formatTimeRange(e.heureDebut, e.heureFin)

          return (
            <div
              key={e.id}
              onClick={() => openEdit(e)}
              style={{
                borderRadius: '16px', padding: '14px', marginBottom: '10px', cursor: 'pointer', background: 'var(--card-bg)', boxShadow: 'var(--card-shadow)',
                opacity: isPast ? 0.65 : 1,
                borderLeft: isPast ? 'none' : `4px solid ${C}`,
              }}
            >
              <div className="flex-start gap-12">
                <div className="flex-1-min">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {e.nom}
                    </span>
                    {isPast ? (
                      <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: 'var(--input-bg)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        Terminé
                      </span>
                    ) : countdown && (
                      <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: `${C}18`, color: C, textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>
                        {countdown}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {dateLabel && (
                      <div className="icon-label">
                        <Calendar size={12} className="flex-shrink-0" />{dateLabel}
                      </div>
                    )}
                    {timeLabel && (
                      <div className="icon-label">
                        <Clock size={12} className="flex-shrink-0" />{timeLabel}
                      </div>
                    )}
                    {e.lieu && (
                      <div className="icon-label">
                        <MapPin size={12} className="flex-shrink-0" />{e.lieu}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={ev => { ev.stopPropagation(); setConfirmDel(e) }}
                  style={{ background: 'var(--del-btn-bg)', border: 'none', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: '#D63B5E', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* FAB */}
      <button
        onClick={openAdd}
        style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem',
          width: '54px', height: '54px', borderRadius: '50%',
          background: C, color: '#fff', border: 'none', fontSize: '24px',
          cursor: 'pointer', boxShadow: `0 6px 20px ${C}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
        }}
      >
        +
      </button>

      {/* Bottom sheet */}
      {sheet !== null && (
        <div className="bottom-sheet-overlay" onClick={closeSheet}>
          <div className="bottom-sheet" onClick={ev => ev.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <h2 className="dialog-title mb-16">
              {isEditing ? "Modifier l'événement" : 'Nouvel événement'}
            </h2>

            <div className="dialog-content">
              <div>
                <label className="form-label">Nom *</label>
                <input type="text" value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} placeholder="Nom de l'événement" className="form-input" />
              </div>
              <div>
                <label className="form-label">Dates *</label>
                <div className="flex-center gap-10">
                  <div className="flex-1">
                    <div className="label-helper">Début</div>
                    <input type="date" value={form.dateDebut} onChange={e => setForm(p => ({ ...p, dateDebut: e.target.value }))} className="form-input" />
                  </div>
                  <div className="flex-1">
                    <div className="label-helper">Fin</div>
                    <input type="date" value={form.dateFin} min={form.dateDebut} onChange={e => setForm(p => ({ ...p, dateFin: e.target.value }))} className="form-input" />
                  </div>
                </div>
              </div>
              <div>
                <label className="form-label">Heures</label>
                <div className="flex-center gap-10">
                  <div className="flex-1">
                    <div className="label-helper">Début</div>
                    <input type="time" value={form.heureDebut} onChange={e => setForm(p => ({ ...p, heureDebut: e.target.value }))} className="form-input" />
                  </div>
                  <div className="flex-1">
                    <div className="label-helper">Fin</div>
                    <input type="time" value={form.heureFin} onChange={e => setForm(p => ({ ...p, heureFin: e.target.value }))} className="form-input" />
                  </div>
                </div>
              </div>
              <div>
                <label className="form-label">Lieu</label>
                <input type="text" value={form.lieu} onChange={e => setForm(p => ({ ...p, lieu: e.target.value }))} placeholder="Salle, adresse..." className="form-input" />
              </div>
            </div>

            <div className="dialog-footer">
              <button onClick={closeSheet} className="btn-secondary" style={{ flex: 1, padding: '13px' }}>
                Annuler
              </button>
              <button onClick={save} disabled={saving || !form.nom.trim() || !form.dateDebut} className="rounded-12 font-700 text-white border-none cursor-pointer text-14" style={{ flex: 2, padding: '13px', background: C, opacity: (saving || !form.nom.trim() || !form.dateDebut) ? 0.6 : 1 }}>
                {saving ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression */}
      {confirmDel && (
        <div className="modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title mb-8">Supprimer cet événement ?</h3>
            <p className="text-13 text-secondary mb-16" style={{ margin: 0 }}>
              {confirmDel.nom} sera définitivement supprimé.
            </p>
            <div className="dialog-footer">
              <button onClick={() => setConfirmDel(null)} className="btn-secondary" style={{ flex: 1, padding: '12px' }}>
                Annuler
              </button>
              <button onClick={confirmDelete} className="rounded-12 font-700 text-white border-none cursor-pointer" style={{ flex: 1, padding: '12px', background: C }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
