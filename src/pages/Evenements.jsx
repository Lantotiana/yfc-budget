import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Plus, Trash2, MapPin, Clock, Calendar } from 'lucide-react'
import { toDisplayDate } from '../utils'
import { createNotification } from '../notifications'
import { useTheme } from '../context/ThemeContext'
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

export default function Evenements() {
  const { C } = useTheme()
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
    <div className="page-container sin" style={{ background: C.bg, paddingBottom: 'calc(86px + env(safe-area-inset-bottom))' }}>

      {/* Header */}
      <div className="f1" style={{ padding: '20px 20px 0', paddingTop: 'max(20px, env(safe-area-inset-top))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>Événements</div>
          <div style={{ fontSize: 12, color: C.t2, marginTop: 2 }}>{evenements.length} événement{evenements.length !== 1 ? 's' : ''}</div>
        </div>
        <button onClick={openAdd} style={{ width: 36, height: 36, borderRadius: 12, border: 'none', background: C.amber, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${C.amberD.replace('0.13','0.5').replace('0.12','0.5')}` }}>
          <Plus size={16} color="#fff" />
        </button>
      </div>

      {/* Liste */}
      <div className="f2 scroll-bottom-safe" style={{ padding: '0 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: C.t2, padding: '2rem', fontSize: 13 }}>Chargement...</div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.t2, padding: '2rem', fontSize: 13 }}>Aucun événement</div>
        ) : sorted.map(e => {
          const isPast = !e._end || e._end <= now
          const countdown = e._start && !isPast ? buildCountdown(e._start, now) : null
          const dateLabel = formatDateRange(e.dateDebut, e.dateFin)
          const timeLabel = formatTimeRange(e.heureDebut, e.heureFin)
          return (
            <div key={e.id} onClick={() => openEdit(e)} style={{ background: C.surf, border: `1px solid ${isPast ? C.bord : C.amber + '40'}`, borderRadius: 18, padding: 18, marginBottom: 12, cursor: 'pointer', position: 'relative', overflow: 'hidden', opacity: isPast ? 0.7 : 1 }}>
              {!isPast && <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: `linear-gradient(180deg,${C.amber},${C.coral})`, borderRadius: '3px 0 0 3px' }} />}
              <div style={{ paddingLeft: isPast ? 0 : 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ flex: 1, paddingRight: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, lineHeight: 1.3 }}>{e.nom}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isPast
                      ? <div style={{ padding: '3px 9px', borderRadius: 20, background: C.surf3, fontSize: 10, fontWeight: 500, color: C.t3 }}>Terminé</div>
                      : countdown && <div style={{ padding: '3px 9px', borderRadius: 20, background: C.amberD, border: `1px solid ${C.amber}50`, fontSize: 10, fontWeight: 600, color: C.amber, whiteSpace: 'nowrap' }}>{countdown}</div>
                    }
                    <button onClick={ev => { ev.stopPropagation(); setConfirmDel(e) }} style={{ width: 28, height: 28, borderRadius: 9, border: `1px solid ${C.bord}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={13} color={C.coral} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {dateLabel && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.t2 }}><Calendar size={13} color={C.t3} />{dateLabel}{timeLabel && <><span style={{ color: C.t3 }}>·</span><Clock size={13} color={C.t3} />{timeLabel}</>}</div>}
                  {e.lieu && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.t2 }}><MapPin size={13} color={C.t3} />{e.lieu}</div>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom sheet */}
      {sheet !== null && (
        <div className="bottom-sheet-overlay" onClick={closeSheet}>
          <div className="bottom-sheet" onClick={ev => ev.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <h2 className="dialog-title mb-16">{isEditing ? "Modifier l'événement" : 'Nouvel événement'}</h2>
            <div className="dialog-content">
              <div><label className="form-label">Nom *</label><input type="text" value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} placeholder="Nom de l'événement" className="form-input" /></div>
              <div>
                <label className="form-label">Dates *</label>
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
            </div>
            <div className="dialog-footer">
              <button onClick={closeSheet} className="btn-secondary" style={{ flex: 1, padding: 13 }}>Annuler</button>
              <button onClick={save} disabled={saving || !form.nom.trim() || !form.dateDebut} style={{ flex: 2, padding: 13, borderRadius: 12, border: 'none', background: C.amber, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (saving || !form.nom.trim() || !form.dateDebut) ? 0.6 : 1 }}>
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
            <p style={{ margin: '0 0 1.5rem', fontSize: 13, color: C.t2 }}>{confirmDel.nom} sera définitivement supprimé.</p>
            <div className="dialog-footer">
              <button onClick={() => setConfirmDel(null)} className="btn-secondary" style={{ flex: 1, padding: 12 }}>Annuler</button>
              <button onClick={confirmDelete} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: C.coral, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
