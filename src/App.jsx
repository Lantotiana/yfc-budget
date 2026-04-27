import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { auth } from './auth'
import { db } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import Login from './components/Login'
import Home from './pages/Home'
import './App.css'

const Budget = lazy(() => import('./pages/Budget'))
const Membres = lazy(() => import('./pages/Membres'))
const Presences = lazy(() => import('./pages/Presences'))
const Parametres = lazy(() => import('./pages/Parametres'))
const Evenements = lazy(() => import('./pages/Evenements'))
const Dashboard = lazy(() => import('./pages/Dashboard'))

const LoadingFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-body)', color: '#5eead4', fontSize: '14px', fontWeight: '600' }}>
    Chargement...
  </div>
)

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
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={
          <ProtectedRoute user={user}>
            <Home user={user} userData={userData} />
          </ProtectedRoute>
        } />
        <Route path="/budget" element={
          <ProtectedRoute user={user}>
            <Suspense fallback={<LoadingFallback />}>
              <Budget user={user} userData={userData} />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/membres" element={
          <ProtectedRoute user={user}>
            <Suspense fallback={<LoadingFallback />}>
              <Membres user={user} userData={userData} />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/presences" element={
          <ProtectedRoute user={user}>
            <Suspense fallback={<LoadingFallback />}>
              <Presences user={user} userData={userData} />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute user={user}>
            <Suspense fallback={<LoadingFallback />}>
              <Dashboard user={user} userData={userData} />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/evenements" element={
          <ProtectedRoute user={user}>
            <Suspense fallback={<LoadingFallback />}>
              <Evenements user={user} userData={userData} />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/parametres" element={
          <ProtectedRoute user={user}>
            <Suspense fallback={<LoadingFallback />}>
              <Parametres
                user={user}
                userData={userData}
                setUserData={setUserData}
              />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SpeedInsights />
    </BrowserRouter>
  )
}
