import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, addDoc, doc, setDoc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { toDisplayDate } from '../utils'
import { Share2, Search } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function Presences({ user, userData }) {
  const { C } = useTheme()
  const [evenements, setEvenements] = useState([])
  const [membres, setMembres] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [presences, setPresences] = useState({})
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [newEventForm, setNewEventForm] = useState({ titre: '', date: new Date().toISOString().slice(0,10) })
  const [savingEvent, setSavingEvent] = useState(false)
  const [saving, setSaving] = useState(null)
  const [copied, setCopied] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'evenements'), orderBy('date', 'desc'))
    return onSnapshot(q, snap => {
      const evts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setEvenements(evts)
      if (!selectedEvent && evts.length > 0) setSelectedEvent(evts[0])
    })
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'membres'), orderBy('nom'))
    return onSnapshot(q, snap => {
      setMembres(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  useEffect(() => {
    if (!selectedEvent) return
    const q = query(collection(db, 'presences'))
    const unsub = onSnapshot(q, snap => {
      const map = {}
      snap.docs.forEach(d => {
        const data = d.data()
        if (data.eventId === selectedEvent.id) map[data.membreId] = data.present
      })
      setPresences(map)
    })
    return () => unsub()
  }, [selectedEvent])

  async function togglePresence(membre) {
    if (!selectedEvent) return
    const docId = `${selectedEvent.id}_${membre.id}`
    const nowPresent = !presences[membre.id]
    setSaving(membre.id)
    try {
      await setDoc(doc(db, 'presences', docId), {
        eventId: selectedEvent.id,
        membreId: membre.id,
        membreNom: membre.nom,
        membrePrenoms: membre.prenoms || '',
        membreNomPrefere: membre.nomPrefere || '',
        present: nowPresent,
        updatedAt: new Date().toISOString(),
      })
      /*
      await createNotification({
        type: 'presence',
        titre: nowPresent ? 'Présence marquée' : 'Présence retirée',
        detail: `${membre.nom} ${membre.prenoms || ''} - ${selectedEvent.titre}`,
        cible: membre.nom,
        route: '/presences',
      })
      */
      setPresences(prev => ({ ...prev, [membre.id]: nowPresent }))
    } catch(e) { console.error(e) }
    setSaving(null)
  }

  async function createEvent() {
    if (!newEventForm.titre.trim()) return
    setSavingEvent(true)
    try {
      const ref = await addDoc(collection(db, 'evenements'), {
        titre: newEventForm.titre.trim(),
        date: newEventForm.date,
        createdAt: new Date().toISOString(),
      })
      /*
      await createNotification({
        type: 'presence',
        titre: 'Nouveau culte créé',
        detail: `${newEventForm.titre.trim()} - ${toDisplayDate(newEventForm.date)}`,
        cible: newEventForm.titre.trim(),
        route: '/presences',
      })
      */
      setSelectedEvent({ id: ref.id, titre: newEventForm.titre.trim(), date: newEventForm.date })
      setShowNewEvent(false)
      setNewEventForm({ titre: '', date: new Date().toISOString().slice(0,10) })
    } catch(e) { console.error(e) }
    setSavingEvent(false)
  }

  const presentCount = membres.filter(m => presences[m.id] === true).length
  const presencePercent = membres.length ? Math.round((presentCount / membres.length) * 100) : 0
  const progressColor = presencePercent < 40 ? C.coral : presencePercent < 75 ? C.amber : C.teal

  function normSearch(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  }
  const filteredMembres = search.trim()
    ? membres.filter(m =>
        normSearch(m.nom).includes(normSearch(search)) ||
        normSearch(m.prenoms).includes(normSearch(search))
      )
    : membres

  function formatDateFR(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
  }

  function displayName(m) {
    return m.nomPrefere?.trim() || m.prenoms?.trim() || m.nom
  }

  function buildRapport() {
    const dateFormatted = formatDateFR(selectedEvent.date)
    const presents = membres.filter(m => presences[m.id] === true)
    const absents  = membres.filter(m => presences[m.id] !== true)
    let t = `Présence ${selectedEvent.titre} — ${dateFormatted}\n\n`
    t += `✅ Présents\n`
    t += presents.length ? presents.map(displayName).join('\n') : 'Aucun'
    t += `\n\n❌ Absents\n`
    t += absents.length  ? absents.map(displayName).join('\n')  : 'Aucun'
    t += `\n\n👥 Total : ${presents.length} présent${presents.length !== 1 ? 's' : ''} / ${membres.length} membre${membres.length !== 1 ? 's' : ''}`
    return t
  }

  async function partager() {
    if (!selectedEvent || membres.length === 0) return
    const text = buildRapport()
    if (navigator.share) {
      try { await navigator.share({ text }) } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      } catch {}
    }
  }


  return (
    <div className="page-container-locked sin" style={{ background: C.bg }}>

      {/* Header */}
      <div className="textured-page-header" style={{ '--header-color': '#7c3aed', padding: '20px 20px 16px', paddingTop: 'max(20px, env(safe-area-inset-top))', borderBottom: `1px solid ${C.bord}`, background: C.bg, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>Présences</div>
            {selectedEvent && (
              <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 2 }}>
                {presentCount} / {membres.length} présent{presentCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          {selectedEvent && membres.length > 0 && (
            <button className="header-action" onClick={partager} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, border: `1px solid ${C.bord}`, background: C.surf, color: C.t2, cursor: 'pointer', fontSize: 'var(--font-xs)', fontWeight: 500 }}>
              <Share2 size={13} /> {copied ? 'Copié !' : 'Partager'}
            </button>
          )}
        </div>

        {/* Event selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <select
            value={selectedEvent?.id || ''}
            onChange={e => { const evt = evenements.find(ev => ev.id === e.target.value); setSelectedEvent(evt || null) }}
            style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: `1px solid ${C.bord2}`, background: C.surf2, color: C.t1, fontSize: 'var(--font-sm)', outline: 'none' }}
          >
            {evenements.length === 0 && <option value="">Aucun culte</option>}
            {evenements.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.titre} — {toDisplayDate(ev.date)}</option>
            ))}
          </select>
          <button className="header-action" onClick={() => setShowNewEvent(true)} style={{ padding: '10px 14px', borderRadius: 12, border: 'none', background: C.teal, color: '#fff', cursor: 'pointer', fontSize: 'var(--font-sm)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            + Nouveau
          </button>
        </div>

        {/* Barre de recherche */}
        {selectedEvent && membres.length > 0 && (
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.t3, pointerEvents: 'none', display: 'flex' }}>
              <Search size={16} />
            </span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un membre..."
              style={{ width: '100%', padding: '11px 14px 11px 40px', borderRadius: 12, border: `1px solid ${C.bord2}`, background: C.surf2, color: C.t1, fontSize: 'var(--font-sm)', outline: 'none' }}
            />
          </div>
        )}

        {/* Barre de progression */}
        {selectedEvent && membres.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ height: 5, borderRadius: 5, background: C.surf3, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 5, background: progressColor, width: `${presencePercent}%`, transition: 'width .4s cubic-bezier(.25,.8,.25,1), background .3s ease' }} />
            </div>
          </div>
        )}
      </div>

      {/* Liste membres */}
      <div className="presence-list-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', paddingBottom: '2rem' }}>
        {!selectedEvent ? (
          <div style={{ textAlign: 'center', color: C.t2, padding: '3rem 1rem', fontSize: 'var(--font-sm)' }}>
            Créez un culte pour commencer le suivi des présences.
          </div>
        ) : membres.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.t2, padding: '3rem 1rem', fontSize: 'var(--font-sm)' }}>
            Aucun membre enregistré. Ajoutez des membres dans le module Membres.
          </div>
        ) : (
          <>
            {filteredMembres.map(m => {
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
                    transition: 'background .2s, border-color .2s, opacity .2s', opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 14, flexShrink: 0, background: present ? C.tealD : C.surf2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--font-sm)', color: present ? C.teal : C.t2 }}>
                    {(m.nom || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nom} {m.prenoms}</div>
                    {m.telephone && <div style={{ fontSize: 'var(--font-xs)', color: C.t3, marginTop: 2 }}>{m.telephone}</div>}
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, background: present ? C.teal : C.surf3, border: present ? 'none' : `1px solid ${C.bord2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s, border-color .2s, transform .25s cubic-bezier(.34,1.56,.64,1)', transform: present ? 'scale(1)' : 'scale(0.9)' }}>
                    {present && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7L5.5 10L11.5 4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Modal nouveau culte */}
      {showNewEvent && (
        <div className="bottom-sheet-overlay" onClick={() => setShowNewEvent(false)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <h2 className="dialog-title mb-16">Nouveau culte</h2>
            <div className="dialog-content">
              <div>
                <label className="form-label">Titre *</label>
                <input type="text" value={newEventForm.titre} onChange={e => setNewEventForm(p => ({ ...p, titre: e.target.value }))} placeholder="Ex: Culte du dimanche" className="form-input" />
              </div>
              <div>
                <label className="form-label">Date</label>
                <input type="date" value={newEventForm.date} onChange={e => setNewEventForm(p => ({ ...p, date: e.target.value }))} className="form-input" />
              </div>
            </div>
            <div className="dialog-footer">
              <button onClick={() => setShowNewEvent(false)} className="btn-secondary" style={{ flex: 1, padding: '13px' }}>Annuler</button>
              <button onClick={createEvent} disabled={savingEvent || !newEventForm.titre.trim()} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: C.teal, color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: (savingEvent || !newEventForm.titre.trim()) ? 0.6 : 1 }}>
                {savingEvent ? 'Création...' : 'Créer le culte'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
