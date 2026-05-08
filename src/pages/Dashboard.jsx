import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { ArrowDownLeft, ArrowUpRight, CalendarDays, ClipboardList, TrendingUp, Users, Wallet } from 'lucide-react'
import { db } from '../firebase'
import { toDisplayDate } from '../utils'
import { useTheme } from '../context/ThemeContext'
import useMediaQuery from '../hooks/useMediaQuery'
import DesktopStatCard from '../components/desktop/DesktopStatCard'
import DesktopSectionCard from '../components/desktop/DesktopSectionCard'
import { useDesktopToolbar } from '../context/DesktopToolbarContext'
import { getDueDateStatus } from '../utils/taskUtils'

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

export default function Dashboard({ user }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { C } = useTheme()
  const { setToolbar } = useDesktopToolbar()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [transactions, setTransactions] = useState([])
  const [membres, setMembres] = useState([])
  const [evenements, setEvenements] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let loaded = 0
    const done = () => { if (++loaded === 4) setLoading(false) }

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
    const u4 = onSnapshot(query(collection(db, 'tasks'), orderBy('deadline', 'asc')), snap => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.archived !== true))
      done()
    }, () => done())

    return () => { u1(); u2(); u3(); u4() }
  }, [])

  const totalEntrees = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.montant || 0), 0)
  const totalDepenses = transactions.filter(t => t.type === 'depense').reduce((s, t) => s + Number(t.montant || 0), 0)
  const solde = totalEntrees - totalDepenses
  const recentTransactions = transactions.slice(0, 10)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthTx = transactions.filter(t => t.date?.startsWith(currentMonth))
  const monthEntrees = monthTx.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.montant || 0), 0)
  const staffCount = membres.filter(m => m.staff === true || m.staffRole).length
  const nextEvent = evenements.find(e => (e.dateFin || e.dateDebut || '') >= new Date().toISOString().slice(0, 10))
  const taskStats = useMemo(() => ({
    todo: tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    overdue: tasks.filter(t => getDueDateStatus(t.deadline, t.status).isOverdue).length,
    mine: tasks.filter(t => t.assignedTo?.includes(user?.uid)).length,
    dueSoon: tasks.filter(t => {
      const due = getDueDateStatus(t.deadline, t.status)
      return t.status !== 'done' && (due.color === 'orange' || due.color === 'red')
    }).length,
  }), [tasks, user?.uid])

  const desktopActions = useMemo(() => (
    <button type="button" className="desktop-toolbar-btn" onClick={() => navigate('/budget')}>
      Voir le budget
    </button>
  ), [navigate])

  useEffect(() => {
    setToolbar({ title: t('dashboard.title') + ' YFC', actions: desktopActions })
    return () => setToolbar({ actions: null })
  }, [desktopActions, setToolbar])

  const { upcomingCount, finishedCount } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return evenements.reduce((acc, e) => {
      if ((e.dateFin || e.dateDebut || '') >= today) acc.upcomingCount += 1
      else acc.finishedCount += 1
      return acc
    }, { upcomingCount: 0, finishedCount: 0 })
  }, [evenements])

  if (isDesktop) {
    return (
      <div className="desktop-dashboard-page">
        <div className="desktop-page-intro desktop-hide-page-header">
          <div>
            <span>Vue générale</span>
            <h2>{t('dashboard.title')} YFC</h2>
            <p>Suivi centralisé des membres, finances, événements et activités staff.</p>
          </div>
          <button type="button" onClick={() => navigate('/budget')}>Voir le budget</button>
        </div>

        <div className="desktop-stats-grid">
          <DesktopStatCard label={t('dashboard.membres')} value={membres.length} detail={`${staffCount} staffs`} color="#0cc0df" Icon={Users} onClick={() => navigate('/membres')} />
          <DesktopStatCard label={t('dashboard.solde')} value={fmt(solde)} detail="Toutes périodes" color={solde >= 0 ? '#22c55e' : '#ef4444'} Icon={Wallet} onClick={() => navigate('/budget')} />
          <DesktopStatCard label={t('dashboard.totalEntrees')} value={fmt(monthEntrees)} detail="Mois courant" color="#22c55e" Icon={ArrowDownLeft} onClick={() => navigate('/budget')} />
          <DesktopStatCard label="Tâches actives" value={taskStats.todo + taskStats.inProgress} detail={`${taskStats.overdue} en retard`} color={taskStats.overdue ? '#ef4444' : '#0cc0df'} Icon={ClipboardList} onClick={() => navigate('/tasks')} />
        </div>

        <div className="desktop-dashboard-grid">
          <DesktopSectionCard title={t('budget.title')}>
            <div className="desktop-budget-summary">
              <div><span>{t('dashboard.totalEntrees')}</span><strong className="positive">{fmt(totalEntrees)}</strong></div>
              <div><span>{t('dashboard.totalDepenses')}</span><strong className="negative">{fmt(totalDepenses)}</strong></div>
              <div><span>{t('dashboard.solde')}</span><strong className={solde >= 0 ? 'positive' : 'negative'}>{fmt(solde)}</strong></div>
            </div>
          </DesktopSectionCard>

          <DesktopSectionCard title={t('dashboard.evenements')}>
            <div className="desktop-next-event">
              <CalendarDays size={24} />
              <div>
                <strong>{nextEvent?.nom || 'Aucun événement à venir'}</strong>
                <span>{nextEvent ? `${toDisplayDate(nextEvent.dateDebut)}${nextEvent.lieu ? ` - ${nextEvent.lieu}` : ''}` : 'Ajoutez un événement pour alimenter le planning.'}</span>
              </div>
            </div>
            <div className="desktop-mini-metrics">
              <span>{upcomingCount} à venir</span>
              <span>{finishedCount} terminés</span>
            </div>
          </DesktopSectionCard>

          <DesktopSectionCard title="Tâches" action={<button type="button" onClick={() => navigate('/tasks')}>Ouvrir</button>}>
            <div className="desktop-task-summary">
              <div><span>À faire</span><strong>{taskStats.todo}</strong></div>
              <div><span>En cours</span><strong>{taskStats.inProgress}</strong></div>
              <div><span>Terminé</span><strong>{taskStats.done}</strong></div>
              <div className={taskStats.overdue ? 'danger' : ''}><span>En retard</span><strong>{taskStats.overdue}</strong></div>
            </div>
            <div className="desktop-mini-metrics">
              <span>{taskStats.mine} mes tâches</span>
              <span>{taskStats.dueSoon} échéance proche</span>
            </div>
          </DesktopSectionCard>

          <DesktopSectionCard title={`${t('dashboard.transactions')} récentes`} className="desktop-wide-card" action={<button type="button" onClick={() => navigate('/budget')}>Voir tout</button>}>
            <div className="desktop-activity-list">
              {loading ? (
                <div className="desktop-empty">{t('common.loading')}</div>
              ) : recentTransactions.length === 0 ? (
                <div className="desktop-empty">{t('budget.aucuneTransaction')}</div>
              ) : recentTransactions.map(tx => {
                const isEntree = tx.type === 'entree'
                return (
                  <button key={tx.id} type="button" onClick={() => navigate('/budget')} className="desktop-activity-row">
                    <span className={isEntree ? 'income' : 'expense'}>{isEntree ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
                    <div>
                      <strong>{tx.motif || 'Transaction'}</strong>
                      <small>{toDisplayDate(tx.date)}</small>
                    </div>
                    <em className={isEntree ? 'positive' : 'negative'}>{isEntree ? '+' : '-'}{fmt(tx.montant)}</em>
                  </button>
                )
              })}
            </div>
          </DesktopSectionCard>

          <DesktopSectionCard title={t('dashboard.membres')} action={<button type="button" onClick={() => navigate('/membres')}>Gérer</button>}>
            <div className="desktop-member-preview">
              {membres.slice(0, 5).map(m => (
                <button key={m.id} type="button" onClick={() => navigate('/membres')}>
                  <span>{(m.nom || '?')[0].toUpperCase()}</span>
                  <div>
                    <strong>{m.nom} {m.prenoms}</strong>
                    <small>{m.staffRole || (m.staff ? 'Staff' : 'Membre')}</small>
                  </div>
                </button>
              ))}
              {membres.length === 0 && <div className="desktop-empty">{t('membres.aucunMembre')}</div>}
            </div>
          </DesktopSectionCard>

          <DesktopSectionCard title="Performance" className="desktop-accent-card">
            <TrendingUp size={26} />
            <strong>{transactions.length}</strong>
            <span>opérations budget enregistrées</span>
          </DesktopSectionCard>
        </div>
      </div>
    )
  }

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
          <StatCard label={t('dashboard.totalEntrees')}  value={<AnimatedMoney value={totalEntrees} />}  col={C.teal}  colD={C.tealD}  Icon={ArrowDownLeft} type="income"  onClick={() => navigate('/budget')} />
          <StatCard label={t('dashboard.totalDepenses')} value={<AnimatedMoney value={totalDepenses} />} col={C.coral} colD={C.coralD} Icon={ArrowUpRight} type="expense" onClick={() => navigate('/budget')} />
        </div>

        {/* Membres / Événements */}
        <div className="f3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flexShrink: 0 }}>
          <button onClick={() => navigate('/membres')} className="border-none text-left cursor-pointer" style={{ borderRadius: 18, padding: '16px', background: C.surf, border: `1px solid ${C.bord}`, boxShadow: C.shadow }}>
            <div style={{ width: 30, height: 30, borderRadius: 10, background: C.violetD, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Users size={14} color={C.violet} />
            </div>
            <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: C.t1, letterSpacing: '-.8px' }}><AnimatedNumber value={membres.length} /></div>
            <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 2 }}>{t('dashboard.membres')}</div>
            <div style={{ fontSize: 'var(--font-xs)', color: C.t3, marginTop: 2 }}>total inscrits</div>
          </button>
          <button onClick={() => navigate('/evenements')} className="border-none text-left cursor-pointer" style={{ borderRadius: 18, padding: '16px', background: C.surf, border: `1px solid ${C.bord}`, boxShadow: C.shadow }}>
            <div style={{ width: 30, height: 30, borderRadius: 10, background: C.amberD, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <CalendarDays size={14} color={C.amber} />
            </div>
            <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: C.t1, letterSpacing: '-.8px' }}><AnimatedNumber value={upcomingCount} /></div>
            <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 2 }}>{t('dashboard.evenements')}</div>
            <div style={{ fontSize: 'var(--font-xs)', color: C.t3, marginTop: 2 }}>{finishedCount} terminé{finishedCount !== 1 ? 's' : ''}</div>
          </button>
        </div>

        <button onClick={() => navigate('/tasks')} className="border-none text-left cursor-pointer f4" style={{ borderRadius: 18, padding: '15px 16px', background: C.surf, border: `1px solid ${C.bord}`, boxShadow: C.shadow, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 12, background: 'rgba(12,192,223,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ClipboardList size={16} color="#0cc0df" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 800, color: C.t1 }}>Tâches</div>
            <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 2 }}>{taskStats.todo} à faire - {taskStats.inProgress} en cours - {taskStats.mine} à moi</div>
          </div>
          {taskStats.overdue > 0 && <div style={{ padding: '5px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 'var(--font-xs)', fontWeight: 900 }}>{taskStats.overdue} retard</div>}
        </button>

        {/* Transactions récentes */}
        <div className="f5" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1 }}>{t('dashboard.transactions')} récentes</div>
            <button onClick={() => navigate('/budget')} className="border-none bg-transparent cursor-pointer" style={{ fontSize: 'var(--font-xs)', color: C.amber, fontWeight: 500 }}>
              Voir tout
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: 'calc(86px + env(safe-area-inset-bottom))' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 24, color: C.t3, fontSize: 'var(--font-sm)' }}>{t('common.loading')}</div>
            ) : recentTransactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: C.t3, fontSize: 'var(--font-sm)' }}>{t('budget.aucuneTransaction')}</div>
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
