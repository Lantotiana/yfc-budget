import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, addDoc, doc, setDoc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useTheme } from '../context/ThemeContext'
import { toDisplayDate } from '../utils'
import { Share2, Check, Search } from 'lucide-react'

export default function Presences({ user, userData }) {
  const navigate = useNavigate()
  const { dark } = useTheme()
  const [evenements, setEvenements] = useState([])
  const [membres, setMembres] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [presences, setPresences] = useState({}) // { membreId: true/false }
  const [loadingPresences, setLoadingPresences] = useState(false)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [newEventForm, setNewEventForm] = useState({ titre: '', date: new Date().toISOString().slice(0,10) })
  const [savingEvent, setSavingEvent] = useState(false)
  const [saving, setSaving] = useState(null) // membreId being saved
  const [copied, setCopied] = useState(false)
  const [search, setSearch] = useState('')

  // Load events (most recent first)
  useEffect(() => {
    const q = query(collection(db, 'evenements'), orderBy('date', 'desc'))
    return onSnapshot(q, snap => {
      const evts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setEvenements(evts)
      if (!selectedEvent && evts.length > 0) {
        setSelectedEvent(evts[0])
      }
    })
  }, [])

  // Load members
  useEffect(() => {
    const q = query(collection(db, 'membres'), orderBy('nom'))
    return onSnapshot(q, snap => {
      setMembres(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  // Load presences for selected event
  useEffect(() => {
    if (!selectedEvent) return
    setLoadingPresences(true)
    const q = query(collection(db, 'presences'))
    const unsub = onSnapshot(q, snap => {
      const map = {}
      snap.docs.forEach(d => {
        const data = d.data()
        if (data.eventId === selectedEvent.id) {
          map[data.membreId] = data.present
        }
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
    } catch(e) {
      console.error(e)
    }
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
    } catch(e) {
      console.error(e)
    }
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
    t += `✅ Présents\n`
    t += presents.length ? presents.map(m => m.prenoms || m.nom).join('\n') : 'Aucun'
    t += `\n\n❌ Absents\n`
    t += absents.length  ? absents.map(m => m.prenoms || m.nom).join('\n')  : 'Aucun'
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

  const inp = {
    width: '100%',
    padding: '11px 14px',
    border: '1.5px solid var(--border-input)',
    borderRadius: '12px',
    fontSize: '14px',
    background: 'var(--input-bg)',
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-body)'}}>
      {/* Header */}
      <div style={{background:'var(--hero-bg)', padding:'1rem 1rem 1.25rem', paddingTop:'max(1rem, env(safe-area-inset-top))'}}>
        <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'1rem'}}>
          <button
            onClick={() => navigate('/')}
            style={{background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'10px', padding:'8px 12px', cursor:'pointer', color:'#fff', fontSize:'16px', fontFamily:'inherit', flexShrink:0}}
          >
            ‹
          </button>
          <div style={{flex:1}}>
            <h1 style={{margin:0, fontSize:'18px', fontWeight:'700', color:'#fff'}}>Présence Alimbavaka</h1>
            {selectedEvent && (
              <p style={{margin:0, fontSize:'11px', color:'rgba(255,255,255,0.5)'}}>
                {presentCount} / {membres.length} présent{presentCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {selectedEvent && membres.length > 0 && (
            <button
              onClick={partager}
              style={{background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'10px', padding:'8px 12px', cursor:'pointer', color:'#fff', fontSize:'13px', fontWeight:'700', fontFamily:'inherit', flexShrink:0, display:'flex', alignItems:'center', gap:'6px'}}
            >
              <Share2 size={15} /> Partager
            </button>
          )}
        </div>

        {/* Event selector */}
        <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
          <select
            value={selectedEvent?.id || ''}
            onChange={e => {
              const evt = evenements.find(ev => ev.id === e.target.value)
              setSelectedEvent(evt || null)
            }}
            style={{flex:1, padding:'10px 12px', border:'none', borderRadius:'12px', fontSize:'13px', background:'rgba(255,255,255,0.12)', color:'#fff', fontFamily:'inherit', outline:'none', cursor:'pointer'}}
          >
            {evenements.length === 0 && <option value="">Aucun culte</option>}
            {evenements.map(ev => (
              <option key={ev.id} value={ev.id} style={{background:'#2d1f6e', color:'#fff'}}>
                {ev.titre} — {toDisplayDate(ev.date)}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowNewEvent(true)}
            style={{background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'12px', padding:'10px 14px', cursor:'pointer', color:'#fff', fontSize:'13px', fontWeight:'700', fontFamily:'inherit', flexShrink:0}}
          >
            + Nouveau
          </button>
        </div>

        {/* Search members */}
        {selectedEvent && membres.length > 0 && (
          <div style={{position:'relative', marginTop:'10px'}}>
            <span style={{position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.4)', display:'flex'}}>
              <Search size={14} />
            </span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un membre..."
              style={{width:'100%', padding:'10px 14px 10px 34px', border:'none', borderRadius:'12px', fontSize:'13px', background:'rgba(255,255,255,0.12)', color:'#fff', fontFamily:'inherit', outline:'none', boxSizing:'border-box'}}
            />
          </div>
        )}
      </div>

      {/* Copied toast */}
      {copied && (
        <div style={{position:'fixed', bottom:'1.5rem', left:'50%', transform:'translateX(-50%)', background:'#1e1840', color:'#5eead4', padding:'10px 20px', borderRadius:'12px', fontSize:'13px', fontWeight:'700', zIndex:200, boxShadow:'0 4px 16px rgba(0,0,0,0.3)', whiteSpace:'nowrap'}}>
          ✓ Rapport copié !
        </div>
      )}

      {/* Member checklist */}
      <div style={{padding:'1rem'}}>
        {!selectedEvent ? (
          <div style={{textAlign:'center', color:'var(--text-secondary)', padding:'3rem 1rem', fontSize:'13px'}}>
            Créez un culte pour commencer le suivi des présences.
          </div>
        ) : membres.length === 0 ? (
          <div style={{textAlign:'center', color:'var(--text-secondary)', padding:'3rem 1rem', fontSize:'13px'}}>
            Aucun membre enregistré. Ajoutez des membres dans le module Membres.
          </div>
        ) : (
          <>
            <div style={{fontSize:'11px', fontWeight:'700', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'8px'}}>
              {selectedEvent.titre} · {toDisplayDate(selectedEvent.date)}
            </div>
            {filteredMembres.map(m => {
              const present = presences[m.id] === true
              const isSaving = saving === m.id
              return (
                <div
                  key={m.id}
                  onClick={() => !isSaving && togglePresence(m)}
                  style={{
                    display:'flex', alignItems:'center', gap:'12px',
                    background: present ? (dark ? 'rgba(94,234,212,0.08)' : 'rgba(94,234,212,0.12)') : 'var(--card-bg)',
                    borderRadius:'14px', padding:'12px', marginBottom:'8px',
                    cursor: isSaving ? 'wait' : 'pointer',
                    border: present ? '1.5px solid rgba(94,234,212,0.3)' : '1.5px solid transparent',
                    transition: 'all 0.15s',
                    opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  <div style={{
                    width:'28px', height:'28px', borderRadius:'8px', flexShrink:0,
                    background: present ? '#5eead4' : 'var(--input-bg)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    transition: 'background 0.15s',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    {present ? <Check size={16} strokeWidth={3} color="#1a1040" /> : null}
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:'14px', fontWeight:'600', color:'var(--text-primary)'}}>
                      {m.nom} {m.prenoms}
                    </div>
                    {m.telephone && (
                      <div style={{fontSize:'11px', color:'var(--text-secondary)'}}>{m.telephone}</div>
                    )}
                  </div>
                  <div style={{fontSize:'12px', fontWeight:'600', color: present ? '#5eead4' : 'var(--text-muted)'}}>
                    {present ? 'Présent' : 'Absent'}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* New event modal */}
      {showNewEvent && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:100, display:'flex', alignItems:'flex-end'}} onClick={() => setShowNewEvent(false)}>
          <div style={{width:'100%', background:'var(--card-bg)', borderRadius:'20px 20px 0 0', padding:'1.5rem', paddingBottom:'max(1.5rem, env(safe-area-inset-bottom))'}} onClick={e => e.stopPropagation()}>
            <div style={{width:'36px', height:'4px', background:'var(--border-light)', borderRadius:'2px', margin:'0 auto 1.5rem'}} />
            <h2 style={{margin:'0 0 1.25rem', fontSize:'16px', fontWeight:'700', color:'var(--text-primary)'}}>Nouveau culte</h2>

            <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              <div>
                <label style={{fontSize:'11px', fontWeight:'600', color:'var(--text-secondary)', display:'block', marginBottom:'4px'}}>Titre *</label>
                <input
                  type="text"
                  value={newEventForm.titre}
                  onChange={e => setNewEventForm(p => ({ ...p, titre: e.target.value }))}
                  placeholder="Ex: Culte du dimanche"
                  style={inp}
                />
              </div>
              <div>
                <label style={{fontSize:'11px', fontWeight:'600', color:'var(--text-secondary)', display:'block', marginBottom:'4px'}}>Date</label>
                <input
                  type="date"
                  value={newEventForm.date}
                  onChange={e => setNewEventForm(p => ({ ...p, date: e.target.value }))}
                  style={inp}
                />
              </div>
            </div>

            <div style={{display:'flex', gap:'10px', marginTop:'1.5rem'}}>
              <button
                onClick={() => setShowNewEvent(false)}
                style={{flex:1, padding:'13px', border:'1.5px solid var(--border-input)', borderRadius:'12px', background:'transparent', color:'var(--text-secondary)', fontWeight:'600', cursor:'pointer', fontFamily:'inherit'}}
              >
                Annuler
              </button>
              <button
                onClick={createEvent}
                disabled={savingEvent || !newEventForm.titre.trim()}
                style={{flex:2, padding:'13px', border:'none', borderRadius:'12px', background:'var(--btn-primary-bg)', color:'#fff', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', opacity: (savingEvent || !newEventForm.titre.trim()) ? 0.6 : 1}}
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
