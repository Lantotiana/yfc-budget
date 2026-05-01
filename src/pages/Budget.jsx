import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { db } from '../firebase'
import { collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Sparkles, X, RefreshCw } from 'lucide-react'
import TransactionForm from '../components/TransactionForm'
import TransactionList from '../components/TransactionList'
import DetailTransactions from '../components/DetailTransactions'
import { createNotification } from '../notifications'
import { useTheme } from '../context/ThemeContext'
import { generateBudgetSummary } from '../services/budgetSummary'
import { canManageBudgetRole, sameEmail } from '../utils/access'

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

export default function Budget({ user }) {
  const navigate = useNavigate()
  const { C } = useTheme()
  const { detailType } = useParams()
  const [transactions, setTransactions] = useState([])
  const [membres, setMembres] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState('')
  const [filterType, setFilterType] = useState('')
  const [editTx, setEditTx] = useState(null)
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryMonth, setSummaryMonth] = useState('')
  const showDetail = detailType === 'entrees' ? 'entree' : detailType === 'depenses' ? 'depense' : null

  async function openSummary(force = false) {
    setSummaryOpen(true)
    if (summary && !force) return
    setSummaryLoading(true)
    const currentMonth = new Date().toISOString().slice(0, 7)
    const hasCurrentMonth = transactions.some(t => t.date?.startsWith(currentMonth))
    const month = hasCurrentMonth ? currentMonth : months[0] ?? currentMonth
    setSummaryMonth(month)
    const text = await generateBudgetSummary(transactions, month, force)
    setSummary(text)
    setSummaryLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'))
    const unsub = onSnapshot(q, snapshot => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      data.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date)
        const aCreated = a.createdAt || ''
        const bCreated = b.createdAt || ''
        return bCreated.localeCompare(aCreated)
      })
      setTransactions(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'membres'), orderBy('nom'))
    const unsub = onSnapshot(q, snapshot => {
      setMembres(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  const currentMember = membres.find(m => sameEmail(m.email, user?.email))
  const canManageBudget = canManageBudgetRole(currentMember?.staffRole)

  async function addTransaction(tx) {
    if (!canManageBudget) return
    await addDoc(collection(db, 'transactions'), tx)
    await createNotification({
      type: 'budget',
      titre: tx.type === 'entree' ? 'Nouvelle entrée budget' : 'Nouvelle dépense budget',
      detail: `${tx.motif} - ${fmt(tx.montant)}`,
      cible: tx.motif,
      route: '/budget',
    })
  }

  async function deleteTransaction(tx) {
    if (!canManageBudget) return
    await deleteDoc(doc(db, 'transactions', tx.id))
    await createNotification({
      type: 'budget',
      titre: 'Transaction supprimée',
      detail: `${tx.motif} - ${fmt(tx.montant)}`,
      cible: tx.motif,
      route: '/budget',
    })
  }

  const months = [...new Set(transactions.map(t => t.date?.slice(0,7)))].filter(Boolean).sort().reverse()

  const filtered = transactions.filter(t => {
    if (filterMonth && !t.date?.startsWith(filterMonth)) return false
    if (filterType && t.type !== filterType) return false
    return true
  })

  const allEntrees  = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.montant || 0), 0)
  const allDepenses = transactions.filter(t => t.type === 'depense').reduce((s, t) => s + Number(t.montant || 0), 0)
  const solde = allEntrees - allDepenses

  if (showDetail) return (
    <DetailTransactions
      type={showDetail}
      transactions={transactions}
      onBack={() => navigate('/budget', { replace: true })}
      onEdit={tx => { setEditTx(tx); navigate('/budget', { replace: true }) }}
      canManageBudget={canManageBudget}
    />
  )

  return (
    <div className="sin budget-page" style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <div className="f1 textured-page-header" style={{ '--header-color': '#10b981', padding: '20px 20px 14px', paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
        <div className="header-title" style={{ fontSize: 22, fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>Budget</div>
        <div className="header-subtitle" style={{ fontSize: 12, color: C.t2, marginTop: 2 }}>Young For Christ</div>
      </div>

      {/* Entrées / Dépenses */}
      <div className="f2" style={{ padding: '0 20px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div onClick={() => navigate('/budget/entrees')} style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16, padding: '14px 16px', cursor: 'pointer' }}>
          <div style={{ fontSize: 10, color: C.t3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>ENTRÉES</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.teal }}>{fmt(allEntrees)}</div>
        </div>
        <div onClick={() => navigate('/budget/depenses')} style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16, padding: '14px 16px', cursor: 'pointer' }}>
          <div style={{ fontSize: 10, color: C.t3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>DÉPENSES</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.coral }}>{fmt(allDepenses)}</div>
        </div>
      </div>

      {/* Solde */}
      <div className="f3" style={{ padding: '0 20px 12px' }}>
        <div style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 18, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: C.t3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>SOLDE ACTUEL</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: solde >= 0 ? C.teal : C.coral }}>
              {solde < 0 ? '−' : ''}{fmt(Math.abs(solde))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => openSummary()}
              style={{ width: 42, height: 42, borderRadius: 14, border: `1px solid ${C.bord}`, background: C.surf2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}
              title="Résumé IA"
            >
              <Sparkles size={18} />
            </button>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: solde >= 0 ? C.tealD : C.coralD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: solde >= 0 ? C.teal : C.coral }}>
              {solde >= 0 ? '+' : '−'}
            </div>
          </div>
        </div>
      </div>

      {/* Résumé IA modal */}
      {summaryOpen && createPortal((
        <div className="modal-overlay" onClick={() => setSummaryOpen(false)}>
          <div className="modal ai-summary-modal popup-float" onClick={e => e.stopPropagation()}>
            <div className="dialog-header ai-summary-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={15} color="#10b981" />
                <h2 className="dialog-title">
                  Résumé IA — {summaryMonth ? new Date(summaryMonth + '-01').toLocaleString('fr-FR', { month: 'long', year: 'numeric' }) : '…'}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => openSummary(true)} className="dialog-close-btn">
                  <RefreshCw size={15} className={summaryLoading ? 'spin' : ''} />
                </button>
                <button onClick={() => setSummaryOpen(false)} className="dialog-close-btn">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="ai-summary-body">
              {summaryLoading ? (
                <div className="ai-summary-loading">
                  <div className="spin" style={{ width: 28, height: 28, border: `3px solid ${C.bord}`, borderTopColor: '#10b981', borderRadius: '50%' }} />
                  <span style={{ fontSize: 13, color: C.t2 }}>Analyse en cours…</span>
                </div>
              ) : summary ? (
                <p className="ai-summary-text">{summary}</p>
              ) : (
                <p style={{ fontSize: 14, color: C.t2, textAlign: 'center', padding: '24px 0' }}>Impossible de générer le résumé.</p>
              )}
            </div>
          </div>
        </div>
      ), document.body)}

      <div className="scroll-bottom-safe" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && <div className="loading">Chargement...</div>}
        <TransactionForm onAdd={addTransaction} canManageBudget={canManageBudget} />
        <TransactionList
          transactions={filtered}
          months={months}
          filterMonth={filterMonth}
          filterType={filterType}
          onFilterMonth={setFilterMonth}
          onFilterType={setFilterType}
          onDelete={deleteTransaction}
          allTransactions={transactions}
          editTx={editTx}
          onEditDone={() => setEditTx(null)}
          canManageBudget={canManageBudget}
        />
      </div>
    </div>
  )
}
