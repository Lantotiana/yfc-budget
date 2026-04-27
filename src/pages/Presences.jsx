import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, addDoc, doc, setDoc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { toDisplayDate } from '../utils'
import { Share2, Search } from 'lucide-react'

const C = '#2EC4A9'

export default function Presences({ user, userData }) {
  const navigate = useNavigate()
  const [evenements, setEvenements] = useState([])
  const [membres, setMembres] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [presences, setPresences] = useState({})
  const [loadingPresences, setLoadingPresences] = useState(false)
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
    setLoadingPresences(true)
    const q = query(collection(db, 'presences'))
    const unsub = onSnapshot(q, snap => {
      const map = {}
      snap.docs.forEach(d => {
        const data = d.data()
        if (data.eventId === selectedEvent.id) map[data.membreId] = data.present
      })
      setPresences(map)
      setLoadingPresences(false)
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
        present: nowPresent,
        updatedAt: new Date().toISOString(),
      })
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
      setSelectedEvent({ id: ref.id, titre: newEventForm.titre.trim(), date: newEventForm.date })
      setShowNewEvent(false)
      setNewEventForm({ titre: '', date: new Date().toISOString().slice(0,10) })
    } catch(e) { console.error(e) }
    setSavingEvent(false)
  }

  const presentCount = membres.filter(m => presences[m.id] === true).length

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

  function buildRapport() {
    const dateFormatted = formatDateFR(selectedEvent.date)
    const presents = membres.filter(m => presences[m.id] === true)
    const absents  = membres.filter(m => presences[m.id] !== true)
    let t = `Présence ${selectedEvent.titre} — ${dateFormatted}\n\n`
    t += `Présents\n`
    t += presents.length ? presents.map(m => m.prenoms || m.nom).join('\n') : 'Aucun'
    t += `\n\nAbsents\n`
    t += absents.length  ? absents.map(m => m.prenoms || m.nom).join('\n')  : 'Aucun'
    t += `\n\nTotal : ${presents.length} présent${presents.length !== 1 ? 's' : ''} / ${membres.length} membre${membres.length !== 1 ? 's' : ''}`
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
    <div className="page-container">

      {/* Header */}
      <div className="page-header" style={{ background: C }}>
        <div className="flex-center gap-10 mb-14">
          <button onClick={() => navigate('/')} className="page-back-btn">
            ‹
          </button>
          <div className="flex-1">
            <h1 className="page-title">Présence Alimbavaka</h1>
            {selectedEvent && (
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.65)' }}>
                {presentCount} / {membres.length} présent{presentCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {selectedEvent && membres.length > 0 && (
            <button
              onClick={partager}
              className="rounded-10 flex-center gap-6 flex-shrink-0 text-white font-700 text-13 border-none cursor-pointer" style={{ background: 'rgba(255,255,255,0.18)', padding: '8px 12px', fontFamily: 'inherit' }}
            >
              <Share2 size={15} /> Partager
            </button>
          )}
        </div>

        {/* Event selector */}
        <div className="flex-center gap-8 mb-10">
          <select
            value={selectedEvent?.id || ''}
            onChange={e => {
              const evt = evenements.find(ev => ev.id === e.target.value)
              setSelectedEvent(evt || null)
            }}
            className="flex-1 rounded-12 text-white text-13 border-none cursor-pointer" style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.18)', fontFamily: 'inherit', outline: 'none' }}
          >
            {evenements.length === 0 && <option value="">Aucun culte</option>}
            {evenements.map(ev => (
              <option key={ev.id} value={ev.id} style={{ background: '#1a8a7a', color: '#fff' }}>
                {ev.titre} — {toDisplayDate(ev.date)}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowNewEvent(true)}
            className="rounded-12 text-white text-13 font-700 border-none cursor-pointer flex-shrink-0" style={{ background: 'rgba(255,255,255,0.18)', padding: '10px 14px', fontFamily: 'inherit' }}
          >
            + Nouveau
          </button>
        </div>

        {/* Barre de recherche */}
        {selectedEvent && membres.length > 0 && (
          <div className="relative">
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
              <Search size={14} />
            </span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un membre..."
              className="input-header"
              style={{ width: '100%', padding: '10px 14px 10px 34px', border: 'none', borderRadius: '12px', fontSize: '13px', background: 'rgba(255,255,255,0.18)', color: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        )}
      </div>

      {/* Toast copié */}
      {copied && (
        <div className="toast" style={{ color: C }}>
          Rapport copié !
        </div>
      )}

      {/* Liste membres */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', paddingBottom: '2rem' }}>
        {!selectedEvent ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem 1rem', fontSize: '13px' }}>
            Créez un culte pour commencer le suivi des présences.
          </div>
        ) : membres.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem 1rem', fontSize: '13px' }}>
            Aucun membre enregistré. Ajoutez des membres dans le module Membres.
          </div>
        ) : (
          <>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '10px' }}>
              {selectedEvent.titre} · {toDisplayDate(selectedEvent.date)}
            </div>

            {/* Badge présents */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: `${C}18`, borderRadius: '20px', padding: '5px 12px', marginBottom: '12px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: C }} />
              <span style={{ fontSize: '12px', fontWeight: '700', color: C }}>
                {presentCount} présent{presentCount !== 1 ? 's' : ''} sur {membres.length}
              </span>
            </div>

            {filteredMembres.map(m => {
              const present = presences[m.id] === true
              const isSaving = saving === m.id
              return (
                <div
                  key={m.id}
                  onClick={() => !isSaving && togglePresence(m)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    background: 'var(--card-bg)',
                    borderRadius: '14px', padding: '12px 14px', marginBottom: '8px',
                    cursor: isSaving ? 'wait' : 'pointer',
                    boxShadow: 'var(--card-shadow)',
                    border: present ? `1.5px solid ${C}50` : '1.5px solid transparent',
                    transition: 'border-color 0.15s',
                    opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                    background: present ? `${C}18` : 'var(--input-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: '700', fontSize: '14px',
                    color: present ? C : 'var(--text-secondary)',
                  }}>
                    {(m.nom || '?')[0].toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {m.nom} {m.prenoms}
                    </div>
                    {m.telephone && (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>{m.telephone}</div>
                    )}
                  </div>

                  {/* Checkbox droite */}
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
                    background: present ? C : 'var(--input-bg)',
                    border: present ? 'none' : '2px solid var(--border-input)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s',
                  }}>
                    {present && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2.5 7L5.5 10L11.5 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
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
                <input
                  type="text"
                  value={newEventForm.titre}
                  onChange={e => setNewEventForm(p => ({ ...p, titre: e.target.value }))}
                  placeholder="Ex: Culte du dimanche"
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Date</label>
                <input
                  type="date"
                  value={newEventForm.date}
                  onChange={e => setNewEventForm(p => ({ ...p, date: e.target.value }))}
                  className="form-input"
                />
              </div>
            </div>

            <div className="dialog-footer">
              <button
                onClick={() => setShowNewEvent(false)}
                className="btn-secondary"
                style={{ flex: 1, padding: '13px' }}
              >
                Annuler
              </button>
              <button
                onClick={createEvent}
                disabled={savingEvent || !newEventForm.titre.trim()}
                className="rounded-12 font-700 text-white border-none cursor-pointer"
                style={{ flex: 2, padding: '13px', background: C, opacity: (savingEvent || !newEventForm.titre.trim()) ? 0.6 : 1 }}
              >
                {savingEvent ? 'Création...' : 'Créer le culte'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
