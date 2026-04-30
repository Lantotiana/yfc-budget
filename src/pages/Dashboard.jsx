import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Users } from 'lucide-react'
import { db } from '../firebase'
import { toDisplayDate } from '../utils'
import { useTheme } from '../context/ThemeContext'

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

function StatCard({ label, value, col, colD, Icon }) {
  const { C } = useTheme()
  return (
    <div style={{ flex: 1, minWidth: 0, borderRadius: 18, padding: '16px', background: C.surf, border: `1px solid ${C.bord}`, boxShadow: C.shadow }}>
      <div style={{ width: 30, height: 30, borderRadius: 10, background: colD, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <Icon size={14} color={col} />
      </div>
      <div style={{ fontSize: 11, color: C.t2, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: col, letterSpacing: '-.5px' }}>{value}</div>
    </div>
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
  const recentTransactions = transactions.slice(0, 5)

  const { upcomingCount, finishedCount } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return evenements.reduce((acc, e) => {
      if ((e.dateFin || e.dateDebut || '') >= today) acc.upcomingCount += 1
      else acc.finishedCount += 1
      return acc
    }, { upcomingCount: 0, finishedCount: 0 })
  }, [evenements])

  return (
    <div className="sin" style={{ minHeight: '100vh', background: C.bg, padding: '0 0 calc(86px + env(safe-area-inset-bottom))' }}>
      {/* Hero solde */}
      <div className="f1" style={{
        padding: '28px 20px 36px',
        paddingTop: 'max(28px, env(safe-area-inset-top))',
        textAlign: 'center',
        borderBottom: `1px solid ${C.bord}`,
        background: `linear-gradient(180deg, ${C.amberD.replace('0.13','0.08').replace('0.12','0.08')} 0%, transparent 100%)`,
      }}>
        <div style={{ fontSize: 11, color: C.t2, fontWeight: 500, letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 10 }}>Solde Total</div>
        <div style={{ fontSize: 42, fontWeight: 700, color: C.t1, letterSpacing: '-2px', lineHeight: 1 }}>
          {solde < 0 ? '-' : ''}{fmt(Math.abs(solde)).replace(' Ar', '')}
          <span style={{ fontSize: 18, fontWeight: 500, color: C.t2, marginLeft: 6 }}>Ar</span>
        </div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
        {/* Entrées / Dépenses */}
        <div className="f2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <StatCard label="Entrées"  value={fmt(totalEntrees)}  col={C.teal}  colD={C.tealD}  Icon={ArrowDownLeft} />
          <StatCard label="Dépenses" value={fmt(totalDepenses)} col={C.coral} colD={C.coralD} Icon={ArrowUpRight} />
        </div>

        {/* Membres / Événements */}
        <div className="f3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button onClick={() => navigate('/membres')} className="border-none text-left cursor-pointer" style={{ borderRadius: 18, padding: '16px', background: C.surf, border: `1px solid ${C.bord}`, boxShadow: C.shadow }}>
            <div style={{ width: 30, height: 30, borderRadius: 10, background: C.violetD, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Users size={14} color={C.violet} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.t1, letterSpacing: '-.8px' }}>{membres.length}</div>
            <div style={{ fontSize: 11, color: C.t2, marginTop: 2 }}>Membres</div>
            <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>total inscrits</div>
          </button>
          <button onClick={() => navigate('/evenements')} className="border-none text-left cursor-pointer" style={{ borderRadius: 18, padding: '16px', background: C.surf, border: `1px solid ${C.bord}`, boxShadow: C.shadow }}>
            <div style={{ width: 30, height: 30, borderRadius: 10, background: C.amberD, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <CalendarDays size={14} color={C.amber} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.t1, letterSpacing: '-.8px' }}>{upcomingCount}</div>
            <div style={{ fontSize: 11, color: C.t2, marginTop: 2 }}>Événements</div>
            <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{finishedCount} terminé{finishedCount !== 1 ? 's' : ''}</div>
          </button>
        </div>

        {/* Transactions récentes */}
        <div className="f4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>Transactions récentes</div>
            <button onClick={() => navigate('/budget')} className="border-none bg-transparent cursor-pointer" style={{ fontSize: 12, color: C.amber, fontWeight: 500 }}>
              Voir tout
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: C.t3, fontSize: 13 }}>Chargement...</div>
          ) : recentTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: C.t3, fontSize: 13 }}>Aucune transaction</div>
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
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.motif || 'Transaction'}</div>
                    <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{toDisplayDate(tx.date)}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: isEntree ? C.teal : C.coral }}>
                    {isEntree ? '+' : '-'}{fmt(tx.montant)}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
