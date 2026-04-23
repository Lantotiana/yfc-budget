import { useState, useEffect } from 'react'
import { db } from './firebase'
import { auth } from './auth'
import { collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query, getDoc } from 'firebase/firestore'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import TransactionForm from './components/TransactionForm'
import TransactionList from './components/TransactionList'
import Login from './components/Login'
import Admin from './components/Admin'
import Profil from './components/Profil'
import DetailTransactions from './components/DetailTransactions'
import './App.css'

const ADMIN_EMAIL = 'lterazaf@gmail.com'

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

function getPrenom(fullName) {
  if (!fullName) return null
  return fullName.trim().split(' ')[0]
}

export default function App() {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showAdmin, setShowAdmin] = useState(false)
  const [showProfil, setShowProfil] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [editTx, setEditTx] = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      try {
        if (u) {
          const snap = await getDoc(doc(db, 'users', u.uid))
          if (snap.exists() && snap.data().approuve === true) {
            setUser(u)
            setUserData(snap.data())
          } else {
            await signOut(auth)
            setUser(null)
          }
        } else {
          setUser(null)
        }
      } catch(err) {
        setUser(null)
      } finally {
        setAuthLoading(false)
      }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!user) return
    setLoading(true)
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'))
    const unsub = onSnapshot(q, snapshot => {
      setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
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

  const allEntrees = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.montant || 0), 0)
  const allDepenses = transactions.filter(t => t.type === 'depense').reduce((s, t) => s + Number(t.montant || 0), 0)
  const solde = allEntrees - allDepenses

  if (authLoading) return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#1a1040', color:'#5eead4', fontSize:'14px', fontWeight:'600'}}>
      Chargement...
    </div>
  )

  if (!user) return <Login />

  if (showProfil) return (
    <Profil
      user={user}
      userData={userData}
      onBack={() => setShowProfil(false)}
      onUpdated={updated => setUserData(prev => ({ ...prev, ...updated }))}
    />
  )

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
    border: userData?.photoURL ? '2px solid #5eead4' : 'none'
  }

  return (
    <div className="app">
      <div className="app-hero">
        <div className="app-topbar">

          <div
            key={userData?.photoURL}
            style={avatarStyle}
            onClick={() => setShowProfil(true)}
          >
            {userData?.photoURL
              ? <img src={userData.photoURL} alt="avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} />
              : (userData?.nom || user?.email || '?').slice(0, 2).toUpperCase()
            }
          </div>

          <div style={{flex:1}}>
            <h1>Bonjour, {getPrenom(userData?.nom) || user?.email?.split('@')[0]}</h1>
            <p>Young For Christ · Tanora ho an'i Kristy</p>
          </div>

          <div className="header-actions">
            {user.email === ADMIN_EMAIL && (
              <button className="btn-admin" onClick={() => setShowAdmin(true)}>Admin</button>
            )}
            <button className="btn-logout" onClick={() => signOut(auth)}>Déconnexion</button>
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

      {showAdmin && <Admin onClose={() => setShowAdmin(false)} />}
    </div>
  )
}