import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Users, CalendarDays, ArrowRight, Calendar, Clock, MapPin, Timer } from 'lucide-react'
import { toDisplayDate } from '../utils'

const C = '#4338CA'

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0)
  const raf = useRef(null)
  const prev = useRef(null)

  useEffect(() => {
    if (target === 0) { setValue(0); return }
    const start = performance.now()
    const from = prev.current ?? 0
    prev.current = target
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (progress < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])

  return value
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
  const days  = Math.floor(totalMin / 1440)
  const hours = Math.floor((totalMin % 1440) / 60)
  const mins  = totalMin % 60
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

  const totalEntrees  = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.montant || 0), 0)
  const totalDepenses = transactions.filter(t => t.type === 'depense').reduce((s, t) => s + Number(t.montant || 0), 0)
  const solde = totalEntrees - totalDepenses

  const currentMonth = new Date().toISOString().slice(0, 7)
  const moisEntrees  = transactions.filter(t => t.type === 'entree'  && t.date?.startsWith(currentMonth)).reduce((s, t) => s + Number(t.montant || 0), 0)
  const moisDepenses = transactions.filter(t => t.type === 'depense' && t.date?.startsWith(currentMonth)).reduce((s, t) => s + Number(t.montant || 0), 0)

  const aSolde        = useCountUp(Math.abs(solde))
  const aTotalEntrees = useCountUp(totalEntrees)
  const aTotalDepenses= useCountUp(totalDepenses)
  const aMoisEntrees  = useCountUp(moisEntrees, 700)
  const aMoisDepenses = useCountUp(moisDepenses, 700)
  const aMembres      = useCountUp(membres.length, 600)

  const upcoming = evenements.filter(e => { const end = parseEventEnd(e); return end && end > now })
  const past     = evenements.filter(e => { const end = parseEventEnd(e); return !end || end <= now })
  upcoming.sort((a, b) => parseEventStart(a) - parseEventStart(b))
  past.sort((a, b) => parseEventEnd(b) - parseEventEnd(a))
  const focusEvent = upcoming[0] || past[0] || null
  const focusIsUpcoming = focusEvent && upcoming[0]?.id === focusEvent.id

  return (
    <div className="page-container" style={{ paddingBottom: '2rem' }}>

      {/* Header avec cartes budget */}
      <div className="page-header" style={{ background: C, paddingBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
          <button onClick={() => navigate('/')} className="page-back-btn">
            ‹
          </button>
          <div style={{ flex: 1 }}>
            <h1 className="page-title">Tableau de bord</h1>
            <p className="page-subtitle">Vue d'ensemble</p>
          </div>
        </div>

        {/* Cartes budget */}
        <div className="flex-center gap-10" style={{ width: '100%' }}>
          <div
            onClick={() => navigate('/budget')}
            className="flex-1 rounded-14 cursor-pointer" style={{ padding: '1rem', background: 'rgba(255,255,255,0.14)' }}
          >
            <div style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>Solde total</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: solde >= 0 ? '#4ADE80' : '#FC8FAE', lineHeight: 1.1, marginBottom: '8px' }}>
              {solde < 0 ? '−' : ''}{fmt(aSolde)}
            </div>
            <div className="flex-col" style={{ gap: '2px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#4ADE80' }}>↑ {fmt(aTotalEntrees)}</div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#FC8FAE' }}>↓ {fmt(aTotalDepenses)}</div>
            </div>
          </div>

          <div
            onClick={() => navigate('/budget')}
            style={{ flex: 1, borderRadius: '14px', padding: '1rem', background: 'rgba(255,255,255,0.08)', cursor: 'pointer' }}
          >
            <div style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>Ce mois</div>
            <div className="flex-col gap-6">
              <div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>Entrées</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#4ADE80' }}>↑ {fmt(aMoisEntrees)}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>Dépenses</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#FC8FAE' }}>↓ {fmt(aMoisDepenses)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-secondary text-13" style={{ padding: '3rem' }}>Chargement...</div>
      ) : (
        <div className="flex-col gap-12" style={{ padding: '1rem', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', marginTop: '-1.5rem', background: 'var(--bg-body)', position: 'relative', zIndex: 1 }}>

          {/* Membres */}
          <div
            onClick={() => navigate('/membres')}
            className="rounded-16 cursor-pointer flex-center gap-14" style={{ padding: '1.25rem', background: 'var(--card-bg)', boxShadow: 'var(--card-shadow)', alignItems: 'center' }}
          >
            <div className="icon-circle-52 flex-shrink-0" style={{ background: 'rgba(47,128,237,0.12)' }}>
              <Users size={26} color="#2F80ED" />
            </div>
            <div className="flex-1">
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '2px' }}>Membres</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#2F80ED', lineHeight: 1 }}>{aMembres}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>inscrits</div>
            </div>
            <ArrowRight size={20} color="#2F80ED" />
          </div>

          {/* Prochain / Dernier événement */}
          {focusEvent && (
            <div
              onClick={() => navigate('/evenements')}
              className="rounded-16 cursor-pointer" style={{ padding: '1.25rem', background: 'var(--card-bg)', boxShadow: 'var(--card-shadow)', opacity: focusIsUpcoming ? 1 : 0.85 }}
            >
              <div className="flex-center gap-10 mb-10">
                <div className="w-36-h-36 rounded-10 flex-center flex-shrink-0" style={{ background: focusIsUpcoming ? 'rgba(232,68,90,0.12)' : 'var(--input-bg)' }}>
                  <CalendarDays size={18} color={focusIsUpcoming ? '#E8445A' : 'var(--text-muted)'} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: focusIsUpcoming ? '#E8445A' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
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
              <div className="flex-col gap-4">
                {focusEvent.dateDebut && (
                  <div className="icon-label">
                    <Calendar size={12} className="flex-shrink-0" />
                    {toDisplayDate(focusEvent.dateDebut)}{focusEvent.dateFin && focusEvent.dateFin !== focusEvent.dateDebut ? ` → ${toDisplayDate(focusEvent.dateFin)}` : ''}
                  </div>
                )}
                {focusEvent.heureDebut && (
                  <div className="icon-label">
                    <Clock size={12} className="flex-shrink-0" />
                    {focusEvent.heureDebut}{focusEvent.heureFin ? ` → ${focusEvent.heureFin}` : ''}
                  </div>
                )}
                {focusEvent.lieu && (
                  <div className="icon-label">
                    <MapPin size={12} className="flex-shrink-0" />
                    {focusEvent.lieu}
                  </div>
                )}
              </div>
              {focusIsUpcoming && (() => {
                const start = parseEventStart(focusEvent)
                const cd = start ? buildCountdown(start, now) : null
                return cd ? (
                  <div style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(232,68,90,0.1)', borderRadius: '20px', padding: '4px 12px' }}>
                    <Timer size={12} color="#E8445A" />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#E8445A' }}>Événement {cd}</span>
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
              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', borderRadius: '16px', background: 'var(--card-bg)', textDecoration: 'none', boxShadow: 'var(--card-shadow)' }}
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
              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', borderRadius: '16px', background: 'var(--card-bg)', textDecoration: 'none', boxShadow: 'var(--card-shadow)' }}
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
