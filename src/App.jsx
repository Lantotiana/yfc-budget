import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import TransactionForm from './components/TransactionForm'
import TransactionList from './components/TransactionList'
import Stats from './components/Stats'
import './App.css'

export default function App() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'))
    const unsub = onSnapshot(q, snapshot => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
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

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">YFC</div>
        <div>
          <h1>Gestion Budget</h1>
          <p>Young For Christ · Tanora ho an'i Kristy</p>
        </div>
      </header>

      {loading && <div className="loading">Chargement...</div>}

      <Stats transactions={filtered} />
      <TransactionForm onAdd={addTransaction} />
      <TransactionList
        transactions={filtered}
        months={months}
        filterMonth={filterMonth}
        filterType={filterType}
        onFilterMonth={setFilterMonth}
        onFilterType={setFilterType}
        onDelete={deleteTransaction}
        allTransactions={filtered}
      />
    </div>
  )
}