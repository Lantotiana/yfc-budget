import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import TransactionForm from '../components/TransactionForm'
import TransactionList from '../components/TransactionList'
import DetailTransactions from '../components/DetailTransactions'

const C = '#5B4FCF'

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

  const allEntrees  = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.montant || 0), 0)
  const allDepenses = transactions.filter(t => t.type === 'depense').reduce((s, t) => s + Number(t.montant || 0), 0)
  const solde = allEntrees - allDepenses

  if (showDetail) return (
    <DetailTransactions
      type={showDetail}
      transactions={transactions}
      onBack={() => setShowDetail(null)}
      onEdit={tx => { setEditTx(tx); setShowDetail(null) }}
    />
  )

  return (
    <div className="app">
      {/* Hero */}
      <div style={{ background: C, padding: '18px 16px 20px', paddingTop: 'max(18px, env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', color: '#fff', fontSize: '16px', fontFamily: 'inherit', flexShrink: 0 }}
          >
            ‹
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#fff' }}>Budget</h1>
            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>Young For Christ</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div
            onClick={() => setShowDetail('entree')}
            style={{ background: 'rgba(255,255,255,0.14)', borderRadius: '14px', padding: '12px 14px', cursor: 'pointer' }}
          >
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Entrées</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#4ADE80' }}>{fmt(allEntrees)}</div>
          </div>
          <div
            onClick={() => setShowDetail('depense')}
            style={{ background: 'rgba(255,255,255,0.14)', borderRadius: '14px', padding: '12px 14px', cursor: 'pointer' }}
          >
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Dépenses</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#FC8FAE' }}>{fmt(allDepenses)}</div>
          </div>
        </div>
      </div>

      {/* Solde */}
      <div style={{
        background: 'var(--card-bg)', borderRadius: '16px', padding: '16px',
        margin: '14px 16px 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: 'var(--card-shadow)',
      }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>
            Solde actuel
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: solde >= 0 ? '#0D9370' : '#D63B5E' }}>
            {solde < 0 ? '−' : ''}{fmt(Math.abs(solde))}
          </div>
        </div>
        <div style={{
          width: '42px', height: '42px', borderRadius: '50%',
          background: solde >= 0 ? '#E6FAF5' : '#FEF0F4',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', fontWeight: '700',
          color: solde >= 0 ? '#0D9370' : '#D63B5E',
        }}>
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
