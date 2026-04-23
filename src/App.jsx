import { useState, useEffect } from 'react'
import { db } from './firebase'
import { auth } from './auth'
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  getDoc
} from 'firebase/firestore'
import { onAuthStateChanged, signOut } from 'firebase/auth'

import TransactionForm from './components/TransactionForm'
import TransactionList from './components/TransactionList'
import Login from './components/Login'
import Admin from './components/Admin'
import './App.css'

const ADMIN_EMAIL = 'lterazaf@gmail.com'

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

/* 🔥 prénom */
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

  // 🔐 Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
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
      } catch (err) {
        console.error('Erreur auth:', err)
        setUser(null)
      } finally {
        setAuthLoading(false)
      }
    })

    return () => unsub()
  }, [])

  // 📡 Firestore
  useEffect(() => {
    if (!user) return

    setLoading(true)

    const q = query(
      collection(db, 'transactions'),
      orderBy('date', 'desc')
    )

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }))
      setTransactions(data)
      setLoading(false)
    })

    return () => unsub()
  }, [user])

  // ➕ Ajouter
  async function addTransaction(tx) {
    await addDoc(collection(db, 'transactions'), tx)
  }

  // ❌ Supprimer
  async function deleteTransaction(tx) {
    await deleteDoc(doc(db, 'transactions', tx.id))
  }

  // 📅 Mois
  const months = [
    ...new Set(transactions.map((t) => t.date?.slice(0, 7)))
  ].filter(Boolean).sort().reverse()

  // 🔥 FILTRE (UNIQUEMENT HISTORIQUE)
  const filtered = transactions.filter((t) => {
    if (filterMonth && !t.date?.startsWith(filterMonth)) return false
    if (filterType && t.type !== filterType) return false
    return true
  })

  // 🔥 DASHBOARD GLOBAL (NON FILTRÉ)
  const allEntrees = transactions
    .filter((t) => t.type === 'entree')
    .reduce((s, t) => s + Number(t.montant || 0), 0)

  const allDepenses = transactions
    .filter((t) => t.type === 'depense')
    .reduce((s, t) => s + Number(t.montant || 0), 0)

  const solde = allEntrees - allDepenses

  // ⏳ Loading
  if (authLoading) {
    return (
      <div style={{
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        minHeight:'100vh',
        background:'#1a1040',
        color:'#5eead4'
      }}>
        Chargement...
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <div className="app">

      <div className="app-hero">
        <div className="app-topbar">

          <div className="logo">YFC</div>

          <div style={{ flex: 1 }}>
            <h1>
              Bonjour, {
                getPrenom(userData?.nom) ||
                user?.displayName?.split(' ')[0] ||
                user?.email?.split('@')[0] ||
                'Utilisateur'
              }
            </h1>
            <p>Young For Christ · Tanora ho an'i Kristy</p>
          </div>

          <div className="header-actions">
            {user.email === ADMIN_EMAIL && (
              <button
                className="btn-admin"
                onClick={() => setShowAdmin(true)}
              >
                Admin
              </button>
            )}

            <button
              className="btn-logout"
              onClick={() => signOut(auth)}
            >
              Déconnexion
            </button>
          </div>
        </div>

        <div className="hero-stats">
          <div className="hero-stat">
            <div className="hero-stat-label">Entrées</div>
            <div className="hero-stat-value green">
              {fmt(allEntrees)}
            </div>
          </div>

          <div className="hero-stat">
            <div className="hero-stat-label">Dépenses</div>
            <div className="hero-stat-value red">
              {fmt(allDepenses)}
            </div>
          </div>
        </div>
      </div>

      <div className="solde-card">
        <div>
          <div className="solde-label">Solde du mois</div>
          <div className={`solde-value ${solde >= 0 ? 'green' : 'red'}`}>
            {solde < 0 ? '−' : ''}
            {fmt(Math.abs(solde))}
          </div>
        </div>

        <div className={`solde-icon ${solde >= 0 ? 'green' : 'red'}`}>
          {solde >= 0 ? '+' : '−'}
        </div>
      </div>

      {loading && <div className="loading">Chargement...</div>}

      <TransactionForm onAdd={addTransaction} />

      <TransactionList
        transactions={filtered} // 🔥 filtré uniquement ici
        months={months}
        filterMonth={filterMonth}
        filterType={filterType}
        onFilterMonth={setFilterMonth}
        onFilterType={setFilterType}
        onDelete={deleteTransaction}
        allTransactions={transactions}
      />

      {showAdmin && (
        <Admin onClose={() => setShowAdmin(false)} />
      )}
    </div>
  )
}