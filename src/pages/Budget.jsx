import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { auth } from '../auth'
import { collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import TransactionForm from '../components/TransactionForm'
import TransactionList from '../components/TransactionList'
import DetailTransactions from '../components/DetailTransactions'

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

export default function Budget({ user, userData }) {
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showDetail, setShowDetail] = useState(null)
  const [editTx, setEditTx] = useState(null)

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

  async function addTransaction(tx) {
    await addDoc(collection(db, 'transactions'), tx)
  }

  async function deleteTransaction(tx) {
    await deleteDoc(doc(db, 'transactions', tx.id))
  }

  const months = [...new Set(transactions.map(t => t.date?.slice(0,7)))].filter(Boolean).sort().reverse()

  const filtered = transactions.filter(t => {
    if (filterMonth && !t.date?.startsWith(filterMonth)) return false
    if (filterType && t.type !== filterType) return false
    return true
  })

  const allEntrees = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.montant || 0), 0)
  const allDepenses = transactions.filter(t => t.type === 'depense').reduce((s, t) => s + Number(t.montant || 0), 0)
  const solde = allEntrees - allDepenses

  if (showDetail) return (
    <DetailTransactions
      type={showDetail}
      transactions={transactions}
      onBack={() => setShowDetail(null)}
      onEdit={tx => {
        setEditTx(tx)
        setShowDetail(null)
      }}
    />
  )

  const avatarStyle = {
    cursor: 'pointer',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: '#5eead4',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '13px',
    color: '#1a1040',
    flexShrink: 0,
    overflow: 'hidden',
    border: userData?.photoURL ? '2px solid #5eead4' : 'none',
  }

  return (
    <div className="app">
      <div className="app-hero">
        <div className="app-topbar">
          <button
            onClick={() => navigate('/')}
            style={{background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'10px', padding:'8px 12px', cursor:'pointer', color:'#fff', fontSize:'16px', fontFamily:'inherit', flexShrink:0}}
          >
            ‹
          </button>

          <div style={{flex:1}}>
            <h1>Budget</h1>
            <p>Young For Christ · Tanora ho an'i Kristy</p>
          </div>

        </div>

        <div className="hero-stats">
          <div className="hero-stat" onClick={() => setShowDetail('entree')} style={{cursor:'pointer'}}>
            <div className="hero-stat-label">Entrées</div>
            <div className="hero-stat-value green">{fmt(allEntrees)}</div>
          </div>
          <div className="hero-stat" onClick={() => setShowDetail('depense')} style={{cursor:'pointer'}}>
            <div className="hero-stat-label">Dépenses</div>
            <div className="hero-stat-value red">{fmt(allDepenses)}</div>
          </div>
        </div>
      </div>

      <div className="solde-card">
        <div>
          <div className="solde-label">Solde actuel</div>
          <div className={`solde-value ${solde >= 0 ? 'green' : 'red'}`}>
            {solde < 0 ? '−' : ''}{fmt(Math.abs(solde))}
          </div>
        </div>
        <div className={`solde-icon ${solde >= 0 ? 'green' : 'red'}`}>
          {solde >= 0 ? '+' : '−'}
        </div>
      </div>

      {loading && <div className="loading">Chargement...</div>}

      <TransactionForm onAdd={addTransaction} />
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
      />

    </div>
  )
}
