import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../firebase'
import { collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import TransactionForm from '../components/TransactionForm'
import TransactionList from '../components/TransactionList'
import DetailTransactions from '../components/DetailTransactions'
import { createNotification } from '../notifications'
import { useTheme } from '../context/ThemeContext'
import { canManageBudgetRole, sameEmail } from '../utils/access'

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

export default function Budget({ user, userData }) {
  const navigate = useNavigate()
  const { C } = useTheme()
  const { detailType } = useParams()
  const [transactions, setTransactions] = useState([])
  const [membres, setMembres] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState('')
  const [filterType, setFilterType] = useState('')
  const [editTx, setEditTx] = useState(null)
  const showDetail = detailType === 'entrees' ? 'entree' : detailType === 'depenses' ? 'depense' : null


  useEffect(() => {
    setLoading(true)
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'))
    const unsub = onSnapshot(q, snapshot => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      data.sort((a, b) => {
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

  async function publishBudgetToMessages({ totalEntrees, totalDepenses, solde: soldeFiltré, filterMonth: mois, entrees = [], depenses = [], soldePrecedent = null, soldeActuel = null } = {}) {
    const senderName = userData?.nom || user?.displayName || user?.email || 'Staff'
    const senderPhoto = userData?.photoURL || user?.photoURL || null
    const payload = {
      type: 'budget_report',
      totalEntrees,
      totalDepenses,
      solde: soldeFiltré,
      soldePrecedent,
      soldeActuel,
      filterMonth: mois || null,
      entrees,
      depenses,
      senderId: user.uid,
      senderName,
      senderPhoto,
    }
    try {
      await addDoc(collection(db, 'staffMessages'), {
        ...payload,
        reactions: {},
        readBy: [user.uid],
        pinned: false,
        deleted: false,
        deletedAt: null,
        deletedBy: null,
        edited: false,
        editedAt: null,
        createdAt: new Date().toISOString(),
      })
    } catch (e) { console.error(e) }
  }

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
      <div className="f1 textured-page-header desktop-hide-page-header" style={{ '--header-color': '#10b981', padding: '20px 20px 14px', paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
        <div className="header-title" style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>Budget</div>
        <div className="header-subtitle" style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 2 }}>Young For Christ</div>
      </div>

      {/* Entrées / Dépenses */}
      <div className="f2" style={{ padding: '0 20px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div onClick={() => navigate('/budget/entrees')} style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16, padding: '14px 16px', cursor: 'pointer' }}>
          <div style={{ fontSize: 'var(--font-xs)', color: C.t3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>ENTRÉES</div>
          <div style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: C.teal }}>{fmt(allEntrees)}</div>
        </div>
        <div onClick={() => navigate('/budget/depenses')} style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16, padding: '14px 16px', cursor: 'pointer' }}>
          <div style={{ fontSize: 'var(--font-xs)', color: C.t3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>DÉPENSES</div>
          <div style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: C.coral }}>{fmt(allDepenses)}</div>
        </div>
      </div>

      {/* Solde */}
      <div className="f3" style={{ padding: '0 20px 12px' }}>
        <div style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 18, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 'var(--font-xs)', color: C.t3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>SOLDE ACTUEL</div>
            <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: solde >= 0 ? C.teal : C.coral }}>
              {solde < 0 ? '−' : ''}{fmt(Math.abs(solde))}
            </div>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: solde >= 0 ? C.tealD : C.coralD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--font-md)', fontWeight: 700, color: solde >= 0 ? C.teal : C.coral }}>
            {solde >= 0 ? '+' : '−'}
          </div>
        </div>
      </div>


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
          onShared={publishBudgetToMessages}
          user={user}
          userData={userData}
          currentMember={currentMember}
        />
      </div>
    </div>
  )
}
