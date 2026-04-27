import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Users, CalendarDays, ArrowRight, Calendar, Clock, MapPin, Timer } from 'lucide-react'
import { toDisplayDate } from '../utils'

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

function useNow() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])
  return now
}

function parseEventStart(e) {
  if (!e.dateDebut) return null
  const [y, m, d] = e.dateDebut.split('-').map(Number)
  if (e.heureDebut) {
    const [h, min] = e.heureDebut.split(':').map(Number)
    return new Date(y, m - 1, d, h, min)
  }
  return new Date(y, m - 1, d, 0, 0)
}

function parseEventEnd(e) {
  const dateStr = e.dateFin || e.dateDebut
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  if (e.heureFin) {
    const [h, min] = e.heureFin.split(':').map(Number)
    return new Date(y, m - 1, d, h, min)
  }
  return new Date(y, m - 1, d, 23, 59)
}

function buildCountdown(startDate, now) {
  const diff = startDate - now
  if (diff <= 0) return null
  const totalMin = Math.floor(diff / 60000)
  const days = Math.floor(totalMin / 1440)
  const hours = Math.floor((totalMin % 1440) / 60)
  const mins = totalMin % 60
  if (days >= 1) return `dans ${days} jour${days > 1 ? 's' : ''}${hours > 0 ? ` ${hours}h` : ''}`
  if (hours >= 1) return `dans ${hours}h ${mins}min`
  return `dans ${mins} min`
}

export default function Dashboard({ user, userData }) {
  const navigate = useNavigate()
  const now = useNow()
  const [transactions, setTransactions] = useState([])
  const [membres, setMembres] = useState([])
  const [evenements, setEvenements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let loaded = 0
    const done = () => { if (++loaded === 3) setLoading(false) }
    const u1 = onSnapshot(query(collection(db, 'transactions'), orderBy('date', 'desc')), snap => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      done()
    })
    const u2 = onSnapshot(query(collection(db, 'membres'), orderBy('nom')), snap => {
      setMembres(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      done()
    })
    const u3 = onSnapshot(query(collection(db, 'evenements_agenda'), orderBy('dateDebut')), snap => {
      setEvenements(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      done()
    })
    return () => { u1(); u2(); u3() }
  }, [])

  const totalEntrees = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.montant || 0), 0)
  const totalDepenses = transactions.filter(t => t.type === 'depense').reduce((s, t) => s + Number(t.montant || 0), 0)
  const solde = totalEntrees - totalDepenses

  const currentMonth = new Date().toISOString().slice(0, 7)
  const moisEntrees = transactions.filter(t => t.type === 'entree' && t.date?.startsWith(currentMonth)).reduce((s, t) => s + Number(t.montant || 0), 0)
  const moisDepenses = transactions.filter(t => t.type === 'depense' && t.date?.startsWith(currentMonth)).reduce((s, t) => s + Number(t.montant || 0), 0)

  const upcoming = evenements.filter(e => { const end = parseEventEnd(e); return end && end > now })
  const past = evenements.filter(e => { const end = parseEventEnd(e); return !end || end <= now })
  upcoming.sort((a, b) => parseEventStart(a) - parseEventStart(b))
  past.sort((a, b) => parseEventEnd(b) - parseEventEnd(a))
  const focusEvent = upcoming[0] || past[0] || null
  const focusIsUpcoming = focusEvent && upcoming[0]?.id === focusEvent.id

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-body)', paddingBottom: '5rem' }}>

      {/* Header */}
      <div style={{ background: 'var(--hero-bg)', padding: '1rem 1rem 1.5rem', paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => navigate('/')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', color: '#fff', fontSize: '16px', fontFamily: 'inherit', flexShrink: 0 }}>
            ‹
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#fff' }}>Tableau de bord</h1>
            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Vue d'ensemble</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem', fontSize: '13px' }}>Chargement...</div>
      ) : (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* SOLDE + CE MOIS côte à côte */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Solde total */}
            <div onClick={() => navigate('/budget')} style={{
              flex: 1, borderRadius: '20px', padding: '1.25rem',
              background: 'var(--hero-bg)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              cursor: 'pointer',
            }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>
                Solde total
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: solde >= 0 ? '#5eead4' : '#fb9ea0', lineHeight: 1.1, marginBottom: '10px' }}>
                {solde < 0 ? '−' : ''}{fmt(Math.abs(solde))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#5eead4' }}>↑ {fmt(totalEntrees)}</div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#fb9ea0' }}>↓ {fmt(totalDepenses)}</div>
              </div>
            </div>

            {/* Ce mois */}
            <div onClick={() => navigate('/budget')} style={{
              flex: 1, borderRadius: '20px', padding: '1.25rem',
              background: 'var(--card-bg)',
              cursor: 'pointer',
            }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>
                Ce mois
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>Entrées</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>↑ {fmt(moisEntrees)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>Dépenses</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-secondary)' }}>↓ {fmt(moisDepenses)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Membres */}
          <div
            onClick={() => navigate('/membres')}
            style={{ borderRadius: '20px', padding: '1.25rem 1.5rem', background: 'var(--card-bg)', border: '1.5px solid var(--border-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(251,146,60,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Users size={26} color="#fb923c" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '2px' }}>Membres</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#fb923c', lineHeight: 1 }}>{membres.length}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>inscrits</div>
            </div>
            <ArrowRight size={20} color="#fb923c" />
          </div>

          {/* Prochain / Dernier événement */}
          {focusEvent && (
            <div
              onClick={() => navigate('/evenements')}
              style={{ borderRadius: '20px', padding: '1.25rem 1.5rem', background: 'var(--card-bg)', cursor: 'pointer', position: 'relative', overflow: 'hidden', opacity: focusIsUpcoming ? 1 : 0.85 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: focusIsUpcoming ? 'rgba(167,139,250,0.12)' : 'var(--input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CalendarDays size={18} color={focusIsUpcoming ? '#a78bfa' : 'var(--text-muted)'} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: focusIsUpcoming ? '#a78bfa' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  {focusIsUpcoming ? 'Prochain événement' : 'Dernier événement'}
                </span>
                {!focusIsUpcoming && (
                  <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: 'var(--input-bg)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Terminé
                  </span>
                )}
              </div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                {focusEvent.nom}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {focusEvent.dateDebut && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Calendar size={12} style={{ flexShrink: 0 }} />
                    {toDisplayDate(focusEvent.dateDebut)}{focusEvent.dateFin && focusEvent.dateFin !== focusEvent.dateDebut ? ` → ${toDisplayDate(focusEvent.dateFin)}` : ''}
                  </div>
                )}
                {focusEvent.heureDebut && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Clock size={12} style={{ flexShrink: 0 }} />
                    {focusEvent.heureDebut}{focusEvent.heureFin ? ` → ${focusEvent.heureFin}` : ''}
                  </div>
                )}
                {focusEvent.lieu && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <MapPin size={12} style={{ flexShrink: 0 }} />
                    {focusEvent.lieu}
                  </div>
                )}
              </div>
              {focusIsUpcoming && (() => {
                const start = parseEventStart(focusEvent)
                const cd = start ? buildCountdown(start, now) : null
                return cd ? (
                  <div style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(167,139,250,0.12)', borderRadius: '20px', padding: '4px 12px' }}>
                    <Timer size={12} color="#a78bfa" />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#a78bfa' }}>Événement {cd}</span>
                  </div>
                ) : null
              })()}
            </div>
          )}

          {/* Réseaux sociaux */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <a
              href="https://www.facebook.com/groups/1877840085786311"
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', borderRadius: '16px', background: 'var(--card-bg)', textDecoration: 'none', cursor: 'pointer' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
              </svg>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Facebook</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Groupe YFC</div>
              </div>
            </a>

            <a
              href="https://www.youtube.com/@YFCTanora_hoani_KristyJMItaosy"
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', borderRadius: '16px', background: 'var(--card-bg)', textDecoration: 'none', cursor: 'pointer' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#FF0000">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>YouTube</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Chaîne YFC</div>
              </div>
            </a>
          </div>

        </div>
      )}
    </div>
  )
}
