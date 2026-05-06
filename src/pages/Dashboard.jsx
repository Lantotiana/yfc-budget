import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Users } from 'lucide-react'
import { db } from '../firebase'
import { toDisplayDate } from '../utils'
import { useTheme } from '../context/ThemeContext'

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

function useAnimatedNumber(value, duration = 900) {
  const [display, setDisplay] = useState(0)
  const frameRef = useRef(null)

  useEffect(() => {
    const start = performance.now()
    const to = Number(value || 0)

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(to * eased))
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
    }

    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, duration])

  return display
}

function AnimatedMoney({ value, suffix = true }) {
  const animated = useAnimatedNumber(Math.abs(value || 0))
  return <>{animated.toLocaleString('fr-FR')}{suffix ? ' Ar' : ''}</>
}

function AnimatedNumber({ value }) {
  return useAnimatedNumber(value).toLocaleString('fr-FR')
}

function MiniIllustration({ color, type }) {
  const line = type === 'expense'
    ? 'M 0 42 L 18 26 L 36 42 L 54 18 L 72 32 L 92 40 L 112 24 L 132 42 L 150 42'
    : 'M 0 42 L 18 38 L 36 42 L 56 34 L 74 38 L 94 32 L 112 28 L 132 27 L 150 20'
  const area = `${line} L 150 52 L 0 52 Z`

  return (
    <svg viewBox="0 0 150 54" aria-hidden="true" style={{ width: '100%', height: 54, display: 'block', marginTop: 12 }}>
      <path d={area} fill={color} opacity="0.08" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StatCard({ label, value, col, colD, Icon, type, onClick }) {
  const { C } = useTheme()
  return (
    <button onClick={onClick} className="border-none text-left cursor-pointer" style={{ flex: 1, minWidth: 0, borderRadius: 18, padding: '16px 14px 12px', background: C.surf, border: `1px solid ${C.bord}`, boxShadow: C.shadow, overflow: 'hidden', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: col, letterSpacing: '-.5px' }}>{value}</div>
        </div>
        <div style={{ width: 30, height: 30, borderRadius: 10, background: colD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={14} color={col} />
        </div>
      </div>
      <MiniIllustration color={col} type={type} />
    </button>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { C } = useTheme()
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
  const recentTransactions = transactions.slice(0, 10)

  const { upcomingCount, finishedCount } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return evenements.reduce((acc, e) => {
      if ((e.dateFin || e.dateDebut || '') >= today) acc.upcomingCount += 1
      else acc.finishedCount += 1
      return acc
    }, { upcomingCount: 0, finishedCount: 0 })
  }, [evenements])

  return (
    <div className="sin" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.bg }}>
      {/* Hero solde */}
      <div className="f1 textured-page-header" style={{
        '--header-color': '#2563eb',
        padding: '28px 20px 28px',
        paddingTop: 'max(28px, env(safe-area-inset-top))',
        textAlign: 'center',
        borderBottom: `1px solid ${C.bord}`,
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 'var(--font-xs)', color: C.t2, fontWeight: 500, letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 10 }}>Solde Total</div>
        <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: C.t1, letterSpacing: '-1.4px', lineHeight: 1 }}>
          {solde < 0 ? '-' : ''}<AnimatedMoney value={solde} suffix={false} />
          <span style={{ fontSize: 'var(--font-md)', fontWeight: 500, color: C.t2, marginLeft: 6 }}>Ar</span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '12px 20px 0', gap: 12 }}>
        {/* Entrées / Dépenses */}
        <div className="f2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flexShrink: 0 }}>
          <StatCard label="Entrées"  value={<AnimatedMoney value={totalEntrees} />}  col={C.teal}  colD={C.tealD}  Icon={ArrowDownLeft} type="income"  onClick={() => navigate('/budget')} />
          <StatCard label="Dépenses" value={<AnimatedMoney value={totalDepenses} />} col={C.coral} colD={C.coralD} Icon={ArrowUpRight} type="expense" onClick={() => navigate('/budget')} />
        </div>

        {/* Membres / Événements */}
        <div className="f3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flexShrink: 0 }}>
          <button onClick={() => navigate('/membres')} className="border-none text-left cursor-pointer" style={{ borderRadius: 18, padding: '16px', background: C.surf, border: `1px solid ${C.bord}`, boxShadow: C.shadow }}>
            <div style={{ width: 30, height: 30, borderRadius: 10, background: C.violetD, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Users size={14} color={C.violet} />
            </div>
            <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: C.t1, letterSpacing: '-.8px' }}><AnimatedNumber value={membres.length} /></div>
            <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 2 }}>Membres</div>
            <div style={{ fontSize: 'var(--font-xs)', color: C.t3, marginTop: 2 }}>total inscrits</div>
          </button>
          <button onClick={() => navigate('/evenements')} className="border-none text-left cursor-pointer" style={{ borderRadius: 18, padding: '16px', background: C.surf, border: `1px solid ${C.bord}`, boxShadow: C.shadow }}>
            <div style={{ width: 30, height: 30, borderRadius: 10, background: C.amberD, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <CalendarDays size={14} color={C.amber} />
            </div>
            <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: C.t1, letterSpacing: '-.8px' }}><AnimatedNumber value={upcomingCount} /></div>
            <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 2 }}>Événements</div>
            <div style={{ fontSize: 'var(--font-xs)', color: C.t3, marginTop: 2 }}>{finishedCount} terminé{finishedCount !== 1 ? 's' : ''}</div>
          </button>
        </div>

        {/* Transactions récentes */}
        <div className="f4" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1 }}>Transactions récentes</div>
            <button onClick={() => navigate('/budget')} className="border-none bg-transparent cursor-pointer" style={{ fontSize: 'var(--font-xs)', color: C.amber, fontWeight: 500 }}>
              Voir tout
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: 'calc(86px + env(safe-area-inset-bottom))' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 24, color: C.t3, fontSize: 'var(--font-sm)' }}>Chargement...</div>
            ) : recentTransactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: C.t3, fontSize: 'var(--font-sm)' }}>Aucune transaction</div>
            ) : (
              recentTransactions.map(tx => {
                const isEntree = tx.type === 'entree'
                return (
                  <button
                    key={tx.id}
                    onClick={() => navigate('/budget')}
                    className="border-none text-left cursor-pointer"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16, marginBottom: 8, width: '100%' }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: 13, flexShrink: 0, background: isEntree ? C.tealD : C.coralD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isEntree ? <ArrowDownLeft size={16} color={C.teal} /> : <ArrowUpRight size={16} color={C.coral} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.motif || 'Transaction'}</div>
                      <div style={{ fontSize: 'var(--font-xs)', color: C.t3, marginTop: 2 }}>{toDisplayDate(tx.date)}</div>
                    </div>
                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: isEntree ? C.teal : C.coral }}>
                      {isEntree ? '+' : '-'}{fmt(tx.montant)}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
