import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { ArrowDownLeft, ArrowUpRight, CalendarDays, CircleCheckBig, ClipboardList, Clock, LoaderCircle, TrendingUp, Users, Wallet } from 'lucide-react'
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

function SoldeSparkline({ bars }) {
  const W = 300, H = 52
  const soldes = bars.map(b => b.entree - b.depense)
  const min = Math.min(...soldes)
  const max = Math.max(...soldes, 1)
  const range = max - min || 1
  const pad = 6
  const xs = soldes.map((_, i) => pad + (i / (soldes.length - 1)) * (W - pad * 2))
  const ys = soldes.map(v => H - pad - ((v - min) / range) * (H - pad * 2))
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ')
  const area = `${line} L ${xs[xs.length - 1]} ${H} L ${xs[0]} ${H} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" preserveAspectRatio="none"
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', height: 52, display: 'block' }}>
      <path d={area} fill="#fff" opacity="0.12" />
      <path d={line} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
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

    // Le Dashboard est lazy-loadé: ses totaux restent exacts sans peser sur le bundle initial.
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

  const budgetBars = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (6 - index), 1)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      return { key, label: date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''), entree: 0, depense: 0 }
    })
    const byKey = new Map(months.map(item => [item.key, item]))
    transactions.forEach(tx => {
      const bucket = byKey.get(String(tx.date || '').slice(0, 7))
      if (!bucket) return
      if (tx.type === 'entree') bucket.entree += Number(tx.montant || 0)
      if (tx.type === 'depense') bucket.depense += Number(tx.montant || 0)
    })
    const max = Math.max(1, ...months.map(item => Math.max(item.entree, item.depense)))
    return months.map(item => ({
      ...item,
      entreeHeight: Math.max(8, Math.round((item.entree / max) * 100)),
      depenseHeight: Math.max(8, Math.round((item.depense / max) * 100)),
    }))
  }, [transactions])

  const taskCompletion = tasks.length ? Math.round((taskStats.done / tasks.length) * 100) : 0
  const activeTasks = tasks.filter(task => task.status !== 'done').slice(0, 5)
  const staffPreview = membres.filter(m => m.staff === true || m.staffRole).slice(0, 5)

  if (isDesktop) {
    return (
      <div className="desktop-dashboard-page dashboard-analytics">
        <div className="desktop-page-intro desktop-hide-page-header">
          <div>
            <span>Vue générale</span>
            <h2>{t('dashboard.title')} YFC</h2>
            <p>Suivi centralisé des membres, finances, événements et activités staff.</p>
          </div>
          <button type="button" onClick={() => navigate('/budget')}>Voir le budget</button>
        </div>

        <div className="dashboard-hero-row">
          <div>
            <h1>Dashboard</h1>
            <p>Vue claire des finances, membres, événements et tâches YFC.</p>
          </div>
          <button type="button" onClick={() => navigate('/budget')}>Voir le budget</button>
        </div>

        <div className="dashboard-kpi-grid">
          <button type="button" className="dashboard-kpi-card primary" onClick={() => navigate('/budget')}>
            <span>Solde actuel</span>
            <strong>{fmt(solde)}</strong>
            <small>{transactions.length} opérations enregistrées</small>
          </button>
          <button type="button" className="dashboard-kpi-card" onClick={() => navigate('/membres')}>
            <span>Membres</span>
            <strong>{membres.length}</strong>
            <small>{staffCount} staffs actifs</small>
          </button>
          <button type="button" className="dashboard-kpi-card" onClick={() => navigate('/evenements')}>
            <span>Événements</span>
            <strong>{upcomingCount}</strong>
            <small>{finishedCount} terminés</small>
          </button>
          <button type="button" className="dashboard-kpi-card" onClick={() => navigate('/tasks')}>
            <span>Tâches actives</span>
            <strong>{taskStats.todo + taskStats.inProgress}</strong>
            <small>{taskStats.overdue} en retard</small>
          </button>
        </div>

        <div className="dashboard-analytics-grid">
          <section className="dashboard-panel budget-chart-panel">
            <div className="dashboard-panel-head">
              <div><h2>Analyse budget</h2><p>Entrées et dépenses sur 7 mois</p></div>
            </div>
            <div className="dashboard-bars">
              {budgetBars.map(item => (
                <div className="dashboard-bar-item" key={item.key}>
                  <div className="dashboard-bar-track">
                    <span className="income" style={{ height: `${item.entreeHeight}%` }} />
                    <span className="expense" style={{ height: `${item.depenseHeight}%` }} />
                  </div>
                  <small>{item.label}</small>
                </div>
              ))}
            </div>
            <div className="dashboard-chart-legend">
              <span><i className="income" /> Entrées {fmt(totalEntrees)}</span>
              <span><i className="expense" /> Dépenses {fmt(totalDepenses)}</span>
            </div>
          </section>

          <section className="dashboard-panel event-panel">
            <div className="dashboard-panel-head">
              <div><h2>Prochain événement</h2><p>Planning YFC</p></div>
            </div>
            <div className="dashboard-event-card">
              <CalendarDays size={22} />
              <strong>{nextEvent?.nom || 'Aucun événement à venir'}</strong>
              <span>{nextEvent ? `${toDisplayDate(nextEvent.dateDebut)}${nextEvent.lieu ? ` - ${nextEvent.lieu}` : ''}` : 'Ajoutez un événement pour alimenter le planning.'}</span>
            </div>
          </section>

          <section className="dashboard-panel task-progress-panel">
            <div className="dashboard-panel-head">
              <div><h2>Progression tâches</h2><p>{tasks.length} tâches suivies</p></div>
            </div>
            <div className="dashboard-donut" style={{ '--progress': `${taskCompletion * 3.6}deg` }}>
              <div><strong>{taskCompletion}%</strong><span>terminé</span></div>
            </div>
            <div className="dashboard-chart-legend">
              <span><i className="income" /> Terminé</span>
              <span><i className="pending" /> En cours</span>
            </div>
          </section>

          <section className="dashboard-panel recent-panel">
            <div className="dashboard-panel-head">
              <div><h2>Transactions récentes</h2><p>Derniers mouvements budget</p></div>
              <button type="button" onClick={() => navigate('/budget')}>Voir tout</button>
            </div>
            <div className="dashboard-list">
              {loading ? (
                <div className="desktop-empty">{t('common.loading')}</div>
              ) : recentTransactions.length === 0 ? (
                <div className="desktop-empty">{t('budget.aucuneTransaction')}</div>
              ) : recentTransactions.slice(0, 3).map(tx => {
                const isEntree = tx.type === 'entree'
                return (
                  <button key={tx.id} type="button" onClick={() => navigate('/budget')} className="dashboard-list-row">
                    <span className={isEntree ? 'income' : 'expense'}>{isEntree ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}</span>
                    <div>
                      <strong>{tx.motif || 'Transaction'}</strong>
                      <small>{toDisplayDate(tx.date)}</small>
                    </div>
                    <em className={isEntree ? 'positive' : 'negative'}>{isEntree ? '+' : '-'}{fmt(tx.montant)}</em>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="dashboard-panel staff-panel">
            <div className="dashboard-panel-head">
              <div><h2>Staff</h2><p>Collaboration</p></div>
              <button type="button" onClick={() => navigate('/membres')}>Gérer</button>
            </div>
            <div className="dashboard-list">
              {(staffPreview.length ? staffPreview : membres.slice(0, 5)).map(m => (
                <button key={m.id} type="button" onClick={() => navigate('/membres')} className="dashboard-list-row member">
                  <span>{(m.nom || '?')[0].toUpperCase()}</span>
                  <div>
                    <strong>{m.nom} {m.prenoms}</strong>
                    <small>{m.staffRole || (m.staff ? 'Staff' : 'Membre')}</small>
                  </div>
                </button>
              ))}
              {membres.length === 0 && <div className="desktop-empty">{t('membres.aucunMembre')}</div>}
            </div>
          </section>

          <section className="dashboard-panel active-tasks-panel">
            <div className="dashboard-panel-head">
              <div><h2>Tâches en cours</h2><p>Priorités opérationnelles</p></div>
            </div>
            <div className="dashboard-list">
              {activeTasks.length ? activeTasks.map(task => (
                <button key={task.id} type="button" onClick={() => navigate('/tasks')} className="dashboard-list-row task">
                  <span><ClipboardList size={15} /></span>
                  <div>
                    <strong>{task.title}</strong>
                    <small>{task.status === 'in_progress' ? 'En cours' : 'À faire'}</small>
                  </div>
                </button>
              )) : <div className="desktop-empty">Aucune tâche active</div>}
            </div>
          </section>
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
    <div className="sin scroll-bottom-safe" style={{ background: C.bg, minHeight: '100dvh' }}>
      {/* Header */}
      <div className="f1 textured-page-header" style={{
        '--header-color': '#16B5A3',
        padding: '20px 20px 14px',
        paddingTop: 'max(20px, env(safe-area-inset-top))',
      }}>
        <div className="header-title" style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>Dashboard</div>
        <div className="header-subtitle" style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 2 }}>Vue générale YFC</div>
      </div>

      <div style={{ padding: '1px 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Solde — carte primaire */}
        <button className="dashboard-kpi-card primary" onClick={() => navigate('/budget')} style={{ width: '100%', fontFamily: 'inherit', padding: '18px 18px 52px', minHeight: 130, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span>Solde actuel</span>
          <strong style={{ fontSize: 'var(--font-xl)', marginTop: 6 }}>{solde < 0 ? '−' : ''}<AnimatedMoney value={solde} /></strong>
          <small style={{ marginTop: 4 }}>{transactions.length} opérations enregistrées</small>
          <SoldeSparkline bars={budgetBars} />
        </button>

        {/* Grille 2×2 — Entrées / Dépenses / Événement / Tâches donut */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button className="dashboard-kpi-card" onClick={() => navigate('/budget')} style={{ fontFamily: 'inherit' }}>
            <span>{t('dashboard.totalEntrees')}</span>
            <strong style={{ color: C.teal }}><AnimatedMoney value={totalEntrees} /></strong>
            <small>Total reçu</small>
          </button>
          <button className="dashboard-kpi-card" onClick={() => navigate('/budget')} style={{ fontFamily: 'inherit' }}>
            <span>{t('dashboard.totalDepenses')}</span>
            <strong style={{ color: C.coral }}><AnimatedMoney value={totalDepenses} /></strong>
            <small>Total dépensé</small>
          </button>
          <div className="dashboard-panel" onClick={() => navigate('/evenements')} style={{ cursor: 'pointer' }}>
            <div className="dashboard-panel-head" style={{ marginBottom: 8 }}>
              <div><h2>Prochain</h2><p>Événement</p></div>
            </div>
            <div className="dashboard-event-card">
              <CalendarDays size={15} />
              <strong>{nextEvent?.nom || 'Aucun à venir'}</strong>
              <span>{nextEvent ? toDisplayDate(nextEvent.dateDebut) : 'Ajoutez un événement.'}</span>
            </div>
          </div>
          <div className="dashboard-panel">
            <div className="dashboard-panel-head" style={{ marginBottom: 8 }}>
              <div><h2>Tâches</h2><p>{tasks.length} suivies</p></div>
            </div>
            <div className="dashboard-donut" style={{ '--progress': `${taskCompletion * 3.6}deg`, width: 80, height: 80, margin: '2px auto' }}>
              <div style={{ width: 52, height: 52 }}>
                <strong style={{ fontSize: '16px' }}>{taskCompletion}%</strong>
                <span>fait</span>
              </div>
            </div>
          </div>
        </div>

        {/* Graphique budget 7 mois */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div><h2>Analyse budget</h2><p>Entrées et dépenses sur 7 mois</p></div>
          </div>
          <div className="dashboard-bars">
            {budgetBars.map(item => (
              <div className="dashboard-bar-item" key={item.key}>
                <div className="dashboard-bar-track">
                  <span className="income" style={{ height: `${item.entreeHeight}%` }} />
                  <span className="expense" style={{ height: `${item.depenseHeight}%` }} />
                </div>
                <small>{item.label}</small>
              </div>
            ))}
          </div>
          <div className="dashboard-chart-legend">
            <span><i className="income" /> Entrées</span>
            <span><i className="expense" /> Dépenses</span>
          </div>
        </div>

        {/* Membres + Tâches actives */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button className="dashboard-kpi-card" onClick={() => navigate('/membres')} style={{ fontFamily: 'inherit' }}>
            <span>Membres</span>
            <strong><AnimatedNumber value={membres.length} /></strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              <span className="tasks-badge status-todo"><Users size={11} />{staffCount} staffs</span>
              <span className="tasks-badge due-neutral"><Users size={11} />{membres.length - staffCount} autres</span>
            </div>
          </button>
          <button className="dashboard-kpi-card" onClick={() => navigate('/tasks')} style={{ fontFamily: 'inherit' }}>
            <span>Tâches actives</span>
            <strong>{taskStats.todo + taskStats.inProgress}</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {taskStats.inProgress > 0 && <span className="tasks-badge status-in_progress"><LoaderCircle size={11} />{taskStats.inProgress} en cours</span>}
              {taskStats.todo > 0 && <span className="tasks-badge status-todo"><CircleCheckBig size={11} />{taskStats.todo} à faire</span>}
              {taskStats.overdue > 0 && <span className="tasks-badge due-red"><Clock size={11} />{taskStats.overdue} retard</span>}
            </div>
          </button>
        </div>

        {/* Transactions récentes */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div><h2>{t('dashboard.transactions')} récentes</h2><p>Derniers mouvements budget</p></div>
            <button type="button" onClick={() => navigate('/budget')}>Voir tout</button>
          </div>
          <div className="dashboard-list">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: C.t3, fontSize: 'var(--font-sm)' }}>{t('common.loading')}</div>
            ) : recentTransactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: C.t3, fontSize: 'var(--font-sm)' }}>{t('budget.aucuneTransaction')}</div>
            ) : recentTransactions.slice(0, 6).map(tx => {
              const isEntree = tx.type === 'entree'
              return (
                <button key={tx.id} type="button" onClick={() => navigate('/budget')} className="dashboard-list-row">
                  <span className={isEntree ? 'income' : 'expense'}>{isEntree ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}</span>
                  <div>
                    <strong>{tx.motif || 'Transaction'}</strong>
                    <small>{toDisplayDate(tx.date)}</small>
                  </div>
                  <em className={isEntree ? 'positive' : 'negative'}>{isEntree ? '+' : '−'}{fmt(tx.montant)}</em>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
