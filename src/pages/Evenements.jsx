import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Trash2, MapPin, Clock, Calendar } from 'lucide-react'
import { toDisplayDate } from '../utils'

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
      if (sheet === 'add') await addDoc(collection(db, 'evenements_agenda'), data)
      else await updateDoc(doc(db, 'evenements_agenda', sheet.id), data)
      closeSheet()
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  async function confirmDelete() {
    if (!confirmDel) return
    await deleteDoc(doc(db, 'evenements_agenda', confirmDel.id))
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

  const inp = {
    width: '100%', padding: '11px 14px',
    border: '1.5px solid var(--border-input)', borderRadius: '12px',
    fontSize: '14px', background: 'var(--input-bg)', color: 'var(--text-primary)',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }
  const isEditing = sheet && sheet !== 'add'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-body)', paddingBottom: '2rem' }}>

      {/* Header */}
      <div style={{ background: C, padding: '1rem 1rem 1.5rem', paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', color: '#fff', fontSize: '16px', fontFamily: 'inherit', flexShrink: 0 }}
          >
            ‹
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#fff' }}>Événements</h1>
            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.65)' }}>
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
                borderRadius: '16px', padding: '14px', marginBottom: '10px',
                cursor: 'pointer', background: 'var(--card-bg)',
                boxShadow: 'var(--card-shadow)',
                opacity: isPast ? 0.65 : 1,
                borderLeft: isPast ? 'none' : `4px solid ${C}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <Calendar size={12} style={{ flexShrink: 0 }} />{dateLabel}
                      </div>
                    )}
                    {timeLabel && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <Clock size={12} style={{ flexShrink: 0 }} />{timeLabel}
                      </div>
                    )}
                    {e.lieu && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <MapPin size={12} style={{ flexShrink: 0 }} />{e.lieu}
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={closeSheet}>
          <div style={{ width: '100%', background: 'var(--card-bg)', borderRadius: '20px 20px 0 0', padding: '1.5rem', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))', maxHeight: '90vh', overflowY: 'auto' }} onClick={ev => ev.stopPropagation()}>
            <div style={{ width: '36px', height: '4px', background: 'var(--border-light)', borderRadius: '2px', margin: '0 auto 1.5rem' }} />
            <h2 style={{ margin: '0 0 1.25rem', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
              {isEditing ? "Modifier l'événement" : 'Nouvel événement'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nom *</label>
                <input type="text" value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} placeholder="Nom de l'événement" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Dates *</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>Début</div>
                    <input type="date" value={form.dateDebut} onChange={e => setForm(p => ({ ...p, dateDebut: e.target.value }))} style={inp} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>Fin</div>
                    <input type="date" value={form.dateFin} min={form.dateDebut} onChange={e => setForm(p => ({ ...p, dateFin: e.target.value }))} style={inp} />
                  </div>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Heures</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>Début</div>
                    <input type="time" value={form.heureDebut} onChange={e => setForm(p => ({ ...p, heureDebut: e.target.value }))} style={inp} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>Fin</div>
                    <input type="time" value={form.heureFin} onChange={e => setForm(p => ({ ...p, heureFin: e.target.value }))} style={inp} />
                  </div>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Lieu</label>
                <input type="text" value={form.lieu} onChange={e => setForm(p => ({ ...p, lieu: e.target.value }))} placeholder="Salle, adresse..." style={inp} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
              <button onClick={closeSheet} style={{ flex: 1, padding: '13px', border: '1.5px solid var(--border-input)', borderRadius: '12px', background: 'transparent', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button onClick={save} disabled={saving || !form.nom.trim() || !form.dateDebut} style={{ flex: 2, padding: '13px', border: 'none', borderRadius: '12px', background: C, color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', opacity: (saving || !form.nom.trim() || !form.dateDebut) ? 0.6 : 1 }}>
                {saving ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression */}
      {confirmDel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '20px', padding: '1.5rem', width: '100%', maxWidth: '320px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Supprimer cet événement ?</h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {confirmDel.nom} sera définitivement supprimé.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, padding: '12px', border: '1.5px solid var(--border-input)', borderRadius: '12px', background: 'transparent', color: 'var(--text-secondary)', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button onClick={confirmDelete} style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '12px', background: C, color: '#fff', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
