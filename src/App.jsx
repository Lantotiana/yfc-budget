import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { CalendarCheck, CheckSquare, Home as HomeIcon, LayoutDashboard, Users, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { auth } from './auth'
import { db } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import Login from './components/Login'
import Home from './pages/Home'
import Budget from './pages/Budget'
import Membres from './pages/Membres'
import Presences from './pages/Presences'
import PresenceDetail from './pages/PresenceDetail'
import Parametres from './pages/Parametres'
import Evenements from './pages/Evenements'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Notifications from './pages/Notifications'
import Fampaherezana from './pages/Fampaherezana'
import MessagesStaff from './pages/MessagesStaff'
import Tasks from './pages/Tasks'
import Admin from './components/Admin'
import VerifyReceipt from './pages/VerifyReceipt'
import AppLayout from './layouts/AppLayout'
import useMediaQuery from './hooks/useMediaQuery'
import { bindForegroundPushNotifications, syncPushNotifications } from './services/pushNotifications'
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

function BackNavigationGuard({ user }) {
  const location = useLocation()
  const [exitToast, setExitToast] = useState(false)
  const exitReady = useRef(false)

  useEffect(() => {
    if (!user || location.pathname === '/login') return

    // "Double back to exit" should ONLY apply on Home.
    // Everywhere else, we let the browser/React Router history behave naturally.
    if (location.pathname === '/' && !window.history.state?.yfcBackGuardHome) {
      window.history.pushState({ yfcBackGuardHome: true }, '', window.location.href)
    }

    function onPop(e) {
      // Used when we programmatically call history.back() (e.g. closing verse modal)
      // and don't want the Home "press back twice" toast.
      if (document.body.hasAttribute('data-ignore-next-pop')) {
        document.body.removeAttribute('data-ignore-next-pop')
        return
      }

      // If the verse fullscreen modal is open, Home.jsx handles Back to close it.
      if (document.body.hasAttribute('data-verse-modal-open')) return
      if (document.querySelector('.verse-modal.open')) return

      // Only handle the Home exit toast when we're *currently* on "/".
      // Important: on a real Back press, the URL may already have changed,
      // so read from window.location, not a possibly-stale React closure.
      const currentPath = window.location.pathname
      if (currentPath !== '/') return

      // If we just landed on the Home "guard" entry (e.g. coming back from Budget),
      // we should NOT show the exit toast. The next Back will pop to the base Home
      // entry, and *that* is what we treat as the "first back on Home".
      if (e?.state?.yfcBackGuardHome) {
        setExitToast(false)
        exitReady.current = false
        return
      }

      if (exitReady.current) {
        setExitToast(false)
        exitReady.current = false
        // Allow the Back to proceed (PWA may exit, browser may go back).
        return
      }

      // First Back on Home: show toast and keep user on Home by pushing a guard entry.
      exitReady.current = true
      setExitToast(true)
      window.history.pushState({ yfcBackGuardHome: true }, '', window.location.href)
      window.setTimeout(() => {
        exitReady.current = false
        setExitToast(false)
      }, 2000)
    }

    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [location.pathname, user])

  const { t } = useTranslation()
  if (!exitToast) return null

  return (
    <div className="toast" style={{ color: '#fff' }}>
      {t('common.appuieRetour')}
    </div>
  )
}

function BottomNav({ user }) {
  const location = useLocation()
  const navigate = useNavigate()
  const swipeStart = useRef(null)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const { t } = useTranslation()

  const bottomNavItems = [
    { path: '/', label: t('nav.accueil'), Icon: HomeIcon, color: '#2563eb' },
    { path: '/dashboard', label: t('nav.stats'), Icon: LayoutDashboard, color: '#2563eb' },
    { path: '/budget', label: t('nav.budget'), Icon: Wallet, color: '#10b981' },
    { path: '/presences', label: t('nav.presences'), Icon: CalendarCheck },
    { path: '/membres', label: t('nav.membres'), Icon: Users, color: '#f43f5e' },
    { path: '/tasks', label: t('nav.tasks'), Icon: CheckSquare, color: '#8b5cf6' },
  ]
  const baseVisible = Boolean(user && location.pathname !== '/login' && !location.pathname.startsWith('/verify'))
  const visible = baseVisible && !isDesktop

  useEffect(() => {
    if (visible) document.body.setAttribute('data-bottom-nav', 'true')
    else document.body.removeAttribute('data-bottom-nav')

    return () => document.body.removeAttribute('data-bottom-nav')
  }, [visible])

  useEffect(() => {
    if (!visible) return

    function getActiveIndex() {
      return bottomNavItems.findIndex(item => item.path === '/'
        ? location.pathname === '/'
        : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))
    }

    function isInteractiveTarget(target) {
      return target?.closest?.('input, textarea, select, [contenteditable="true"], .modal-overlay, .bottom-sheet-overlay') || document.body.hasAttribute('data-verse-modal-open')
    }

    function onTouchStart(e) {
      if (e.touches.length !== 1 || isInteractiveTarget(e.target)) return
      const touch = e.touches[0]
      swipeStart.current = { x: touch.clientX, y: touch.clientY }
    }

    function onTouchEnd(e) {
      if (!swipeStart.current || isInteractiveTarget(e.target)) {
        swipeStart.current = null
        return
      }

      const touch = e.changedTouches[0]
      const dx = touch.clientX - swipeStart.current.x
      const dy = touch.clientY - swipeStart.current.y
      swipeStart.current = null

      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.4) return

      const currentIndex = getActiveIndex()
      if (currentIndex < 0) return

      const nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1
      const nextItem = bottomNavItems[nextIndex]
      if (nextItem) navigate(nextItem.path)
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [location.pathname, navigate, visible])

  if (!visible) return null

  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {bottomNavItems.map(item => {
        const active = item.path === '/'
          ? location.pathname === '/'
          : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
        return (
          <button
            key={item.path}
            type="button"
            className={`bottom-nav-item${active ? ' active' : ''}`}
            style={{ '--bottom-nav-active': '#10b981' }}
            onClick={() => navigate(item.path)}
            aria-label={item.label}
          >
            <span className="bottom-nav-icon">
              <item.Icon size={20} strokeWidth={2} />
            </span>
            <span className="bottom-nav-label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function AppPage({ user, userData, children }) {
  return (
    <ProtectedRoute user={user}>
      <AppLayout user={user} userData={userData}>
        {children}
      </AppLayout>
    </ProtectedRoute>
  )
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

  useEffect(() => {
    if (!user) return
    const write = () => updateDoc(doc(db, 'users', user.uid), { lastSeen: serverTimestamp() }).catch(() => {})
    write()
    const id = setInterval(write, 60_000)
    return () => clearInterval(id)
  }, [user])

  useEffect(() => {
    if (!user?.uid) return
    syncPushNotifications().catch(() => {})
    bindForegroundPushNotifications(() => {}).catch(() => {})
  }, [user?.uid])

  if (authLoading) return (
    <div className="app-loader-screen" aria-label="Chargement">
      <div className="app-loader-icon" />
    </div>
  )

  return (
    <BrowserRouter>
      <ScrollToTop />
      <BackNavigationGuard user={user} />
      <BottomNav user={user} />
      <Routes>
        <Route path="/verify/:receiptNumber" element={<VerifyReceipt />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={
          <AppPage user={user} userData={userData}>
            <Home user={user} userData={userData} />
          </AppPage>
        } />
        <Route path="/budget" element={
          <AppPage user={user} userData={userData}>
            <Budget user={user} userData={userData} />
          </AppPage>
        } />
        <Route path="/budget/:detailType" element={
          <AppPage user={user} userData={userData}>
            <Budget user={user} userData={userData} />
          </AppPage>
        } />
        <Route path="/membres" element={
          <AppPage user={user} userData={userData}>
            <Membres user={user} userData={userData} />
          </AppPage>
        } />
        <Route path="/presences" element={
          <AppPage user={user} userData={userData}>
            <Presences user={user} userData={userData} />
          </AppPage>
        } />
        <Route path="/presences/:id" element={
          <AppPage user={user} userData={userData}>
            <PresenceDetail user={user} userData={userData} />
          </AppPage>
        } />
        <Route path="/dashboard" element={
          <AppPage user={user} userData={userData}>
            <Dashboard user={user} userData={userData} />
          </AppPage>
        } />
        <Route path="/evenements" element={
          <AppPage user={user} userData={userData}>
            <Evenements user={user} userData={userData} />
          </AppPage>
        } />
        <Route path="/parametres" element={
          <AppPage user={user} userData={userData}>
            <Parametres
              user={user}
              userData={userData}
              setUserData={setUserData}
            />
          </AppPage>
        } />
        <Route path="/documents" element={
          <AppPage user={user} userData={userData}>
            <Documents user={user} userData={userData} />
          </AppPage>
        } />
        <Route path="/tasks" element={
          <AppPage user={user} userData={userData}>
            <Tasks user={user} userData={userData} />
          </AppPage>
        } />
        <Route path="/notifications" element={
          <AppPage user={user} userData={userData}>
            <Notifications user={user} userData={userData} />
          </AppPage>
        } />
        <Route path="/messages" element={
          <AppPage user={user} userData={userData}>
            <MessagesStaff user={user} userData={userData} />
          </AppPage>
        } />
        <Route path="/admin" element={
          <AppPage user={user} userData={userData}>
            <Admin user={user} userData={userData} />
          </AppPage>
        } />
        <Route path="/assistant" element={
          <AppPage user={user} userData={userData}>
            <Fampaherezana user={user} userData={userData} />
          </AppPage>
        } />
        <Route path="/fampaherezana" element={
          <AppPage user={user} userData={userData}>
            <Fampaherezana user={user} userData={userData} />
          </AppPage>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SpeedInsights />
    </BrowserRouter>
  )
}
