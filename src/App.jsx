import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { auth } from './auth'
import { db } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import Login from './components/Login'
import Home from './pages/Home'
import Budget from './pages/Budget'
import Membres from './pages/Membres'
import Presences from './pages/Presences'
import Parametres from './pages/Parametres'
import Evenements from './pages/Evenements'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Notifications from './pages/Notifications'
import './App.css'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      try {
        if (u) {
          const snap = await getDoc(doc(db, 'users', u.uid))
          if (snap.exists() && snap.data().approuve === true) {
            setUser(u)
            setUserData(snap.data())
          } else {
            // Ne pas signOut ici — évite la race condition avec l'inscription
            // Login.jsx gère sa propre déconnexion après inscription/login refusé
            setUser(null)
          }
        } else {
          setUser(null)
        }
      } catch {
        setUser(null)
      } finally {
        setAuthLoading(false)
      }
    })
    return () => unsub()
  }, [])

  if (authLoading) return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--bg-body)', color:'#5eead4', fontSize:'14px', fontWeight:'600'}}>
      Chargement...
    </div>
  )

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={
          <ProtectedRoute user={user}>
            <Home user={user} userData={userData} />
          </ProtectedRoute>
        } />
        <Route path="/budget" element={
          <ProtectedRoute user={user}>
            <Budget user={user} userData={userData} />
          </ProtectedRoute>
        } />
        <Route path="/membres" element={
          <ProtectedRoute user={user}>
            <Membres user={user} userData={userData} />
          </ProtectedRoute>
        } />
        <Route path="/presences" element={
          <ProtectedRoute user={user}>
            <Presences user={user} userData={userData} />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute user={user}>
            <Dashboard user={user} userData={userData} />
          </ProtectedRoute>
        } />
        <Route path="/evenements" element={
          <ProtectedRoute user={user}>
            <Evenements user={user} userData={userData} />
          </ProtectedRoute>
        } />
        <Route path="/parametres" element={
          <ProtectedRoute user={user}>
            <Parametres
              user={user}
              userData={userData}
              setUserData={setUserData}
            />
          </ProtectedRoute>
        } />
        <Route path="/documents" element={
          <ProtectedRoute user={user}>
            <Documents user={user} userData={userData} />
          </ProtectedRoute>
        } />
        <Route path="/notifications" element={
          <ProtectedRoute user={user}>
            <Notifications user={user} userData={userData} />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SpeedInsights />
    </BrowserRouter>
  )
}
