import { useState, useEffect } from 'react'
import { db } from './firebase'
import { auth } from './auth'
import { collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query, getDoc } from 'firebase/firestore'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import TransactionForm from './components/TransactionForm'
import TransactionList from './components/TransactionList'
import Stats from './components/Stats'
import Login from './components/Login'
import Admin from './components/Admin'
import './App.css'

const ADMIN_EMAIL = 'lterazaf@gmail.com'

export default function App() {
  const [user, setUser] = useState(null)
  const [userDoc, setUserDoc] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showAdmin, setShowAdmin] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid))
        if (snap.exists() && snap.data().approuve) {
          setUser(u)
          setUserDoc(snap.data())
        } else {
          await signOut(auth)
          setUser(null)
        }
      } else {
        setUser(null)
      }
      setAuthLoading(false)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'))
    const unsub = onSnapshot(q, snapshot => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      setTransactions(data)
      setLoading(false)
    })
    return () => unsub()
  }, [user])

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

  if (authLoading) return <div className="loading" style={{display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh'}}>Chargement...</div>

  if (!user) return <Login />

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">YFC</div>
        <div style={{flex:1}}>
          <h1>Gestion Budget</h1>
          <p>Young For Christ · Tanora ho an'i Kristy</p>
        </div>
        <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
          {user.email === ADMIN_EMAIL && (
            <button onClick={() => setShowAdmin(true)} style={{padding:'6px 12px', background:'#dbeafe', color:'#1d4ed8', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:'600'}}>
              Admin
            </button>
          )}
          <button onClick={() => signOut(auth)} style={{padding:'6px 12px', background:'#f5f5f0', border:'1px solid #e5e5e5', borderRadius:'8px', cursor:'pointer', fontSize:'12px'}}>
            Déconnexion
          </button>
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

      {showAdmin && <Admin onClose={() => setShowAdmin(false)} />}
    </div>
  )
}