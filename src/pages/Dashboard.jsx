import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, Users } from 'lucide-react'
import { db } from '../firebase'
import { toDisplayDate } from '../utils'

const C = '#4338CA'

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

function DashboardStat({ label, value, sub, color, icon }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      borderRadius: '18px',
      padding: '14px',
      background: 'rgba(255,255,255,0.94)',
      boxShadow: '0 16px 34px rgba(51,43,120,0.14)',
      color: '#24223A',
    }}>
      <div className="flex-between mb-10">
        <div className="rounded-50 flex-center" style={{ width: '28px', height: '28px', background: `${color}18`, color }}>
          {icon}
        </div>
        <ArrowRight size={15} color="#B7B3D1" />
      </div>
      <div style={{ fontSize: '11px', color: '#6F6A8F', fontWeight: 600, marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '10px', color: '#9A96B5', marginTop: '4px' }}>{sub}</div>
      <div style={{ height: '22px', marginTop: '8px', borderRadius: '10px', overflow: 'hidden' }}>
        <svg viewBox="0 0 120 24" width="100%" height="24" preserveAspectRatio="none">
          <path d="M0 17 C18 22 25 5 42 11 S70 26 88 12 S108 4 120 9" fill="none" stroke={color} strokeWidth="2" opacity=".55" />
          <path d="M0 24 L0 17 C18 22 25 5 42 11 S70 26 88 12 S108 4 120 9 L120 24 Z" fill={color} opacity=".08" />
        </svg>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
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
    <div style={{
      minHeight: '100vh',
      padding: '0 0 calc(74px + env(safe-area-inset-bottom))',
      background: 'linear-gradient(180deg, #F6CBD7 0%, #F8E8EC 34%, var(--bg-body) 68%)',
    }}>
      <div style={{
        maxWidth: '520px',
        margin: '0 auto',
        background: 'var(--bg-body)',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'relative',
          minHeight: '248px',
          padding: '20px 18px 80px',
          paddingTop: 'max(20px, env(safe-area-inset-top))',
          color: '#fff',
          background: `linear-gradient(160deg, ${C} 0%, #5B4FCF 62%, #6C5CE7 100%)`,
          overflow: 'hidden',
        }}>
          <div className="text-center" style={{ position: 'relative', zIndex: 1, marginTop: '28px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.78 }}>Budget</div>
            <div style={{ fontSize: '33px', lineHeight: 1.05, fontWeight: 750, marginTop: '5px' }}>
              {solde < 0 ? '-' : ''}{fmt(Math.abs(solde))}
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.1em', opacity: 0.55, marginTop: '7px' }}>
              SOLDE TOTAL
            </div>
          </div>
        </div>

        <div style={{ position: 'relative', padding: '0 16px 18px', marginTop: '-72px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '18px' }}>
            <DashboardStat
              label="Entrées"
              value={fmt(totalEntrees)}
              sub="total reçu"
              color="#2EC4A9"
              icon={<ArrowDownLeft size={15} />}
            />
            <DashboardStat
              label="Dépenses"
              value={fmt(totalDepenses)}
              sub="total sorti"
              color="#E8445A"
              icon={<ArrowUpRight size={15} />}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
            <button onClick={() => navigate('/membres')} className="border-none text-left cursor-pointer" style={{ borderRadius: '16px', padding: '14px', background: 'var(--card-bg)', boxShadow: 'var(--card-shadow)' }}>
              <Users size={20} color="#2F80ED" />
              <div className="text-20 font-700 text-primary mt-8">{membres.length}</div>
              <div className="text-11 text-secondary">membres</div>
            </button>
            <button onClick={() => navigate('/evenements')} className="border-none text-left cursor-pointer" style={{ borderRadius: '16px', padding: '14px', background: 'var(--card-bg)', boxShadow: 'var(--card-shadow)' }}>
              <CalendarDays size={20} color="#E8445A" />
              <div className="text-20 font-700 text-primary mt-8">{upcomingCount}</div>
              <div className="text-11 text-secondary">{upcomingCount} à venir · {finishedCount} terminés</div>
            </button>
          </div>

          <div className="flex-between mb-12">
            <div className="text-14 font-700 text-primary">Transactions récentes</div>
            <button onClick={() => navigate('/budget')} className="border-none bg-transparent cursor-pointer text-11 font-700" style={{ color: '#5B4FCF' }}>
              Voir tout
            </button>
          </div>

          {loading ? (
            <div className="empty-state">Chargement...</div>
          ) : recentTransactions.length === 0 ? (
            <div className="empty-state">Aucune transaction</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentTransactions.map(tx => {
                const isEntree = tx.type === 'entree'
                return (
                  <button
                    key={tx.id}
                    onClick={() => navigate('/budget')}
                    className="border-none text-left cursor-pointer"
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', background: 'transparent' }}
                  >
                    <div className="rounded-14 flex-center flex-shrink-0" style={{ width: '38px', height: '38px', background: isEntree ? '#E6FAF5' : '#FEF0F4', color: isEntree ? '#0D9370' : '#D63B5E' }}>
                      {isEntree ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                    </div>
                    <div className="flex-1-min">
                      <div className="text-13 font-600 text-primary text-ellipsis">{tx.motif || 'Transaction'}</div>
                      <div className="text-11 text-secondary">{toDisplayDate(tx.date)}</div>
                    </div>
                    <div className="text-13 font-700" style={{ color: isEntree ? '#0D9370' : '#D63B5E' }}>
                      {isEntree ? '+' : '-'} {fmt(tx.montant)}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
