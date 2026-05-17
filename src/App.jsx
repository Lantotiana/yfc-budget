import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { CalendarCheck, CheckSquare, Home as HomeIcon, LayoutDashboard, Users, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { auth } from './auth'
import { db } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import Login from './components/Login'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import AppLayout from './layouts/AppLayout'
import useMediaQuery from './hooks/useMediaQuery'
import './App.css'

const loadBudget = () => import('./pages/Budget')
const loadMembres = () => import('./pages/Membres')
const loadPresences = () => import('./pages/Presences')
const loadPresenceDetail = () => import('./pages/PresenceDetail')
const loadParametres = () => import('./pages/Parametres')
const loadEvenements = () => import('./pages/Evenements')
const loadDocuments = () => import('./pages/Documents')
const loadNotifications = () => import('./pages/Notifications')
const loadFampaherezana = () => import('./pages/Fampaherezana')
const loadMessagesStaff = () => import('./pages/MessagesStaff')
const loadTasks = () => import('./pages/Tasks')
const loadAdmin = () => import('./components/Admin')
const loadVerifyReceipt = () => import('./pages/VerifyReceipt')

const Budget = lazy(loadBudget)
const Membres = lazy(loadMembres)
const Presences = lazy(loadPresences)
const PresenceDetail = lazy(loadPresenceDetail)
const Parametres = lazy(loadParametres)
const Evenements = lazy(loadEvenements)
const Documents = lazy(loadDocuments)
const Notifications = lazy(loadNotifications)
const Fampaherezana = lazy(loadFampaherezana)
const MessagesStaff = lazy(loadMessagesStaff)
const Tasks = lazy(loadTasks)
const Admin = lazy(loadAdmin)
const VerifyReceipt = lazy(loadVerifyReceipt)

const desktopPreloadQueue = [
  loadBudget,
  loadMembres,
  loadDocuments,
  loadTasks,
  loadPresences,
  loadEvenements,
  loadParametres,
  loadPresenceDetail,
  loadNotifications,
  loadMessagesStaff,
  loadAdmin,
  loadFampaherezana,
  loadVerifyReceipt,
]

const mobilePreloadQueue = [
  loadBudget,
  loadPresences,
  loadMembres,
  loadTasks,
  loadDocuments,
  loadEvenements,
  loadParametres,
  loadNotifications,
  loadMessagesStaff,
  loadAdmin,
  loadFampaherezana,
  loadPresenceDetail,
  loadVerifyReceipt,
]

function scheduleIdleTask(task, timeout = 1200) {
  if (typeof window === 'undefined') return null
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(task, { timeout })
  }
  return window.setTimeout(task, timeout)
}

function cancelIdleTask(id) {
  if (id == null || typeof window === 'undefined') return
  if ('cancelIdleCallback' in window) window.cancelIdleCallback(id)
  else window.clearTimeout(id)
}

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
        <Suspense fallback={<RouteFallback />}>
          {children}
        </Suspense>
      </AppLayout>
    </ProtectedRoute>
  )
}

function RouteFallback() {
  return (
    <div className="route-loader" aria-label="Chargement de la page">
      <div className="route-loader-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}

function HomeRoute({ user, userData }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  if (isDesktop) return <Navigate to="/dashboard" replace />

  return (
    <AppPage user={user} userData={userData}>
      <Home user={user} userData={userData} />
    </AppPage>
  )
}

function FallbackRoute() {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  return <Navigate to={isDesktop ? '/dashboard' : '/'} replace />
}

const LOADER_MESSAGES = [
  'On aligne les chaises imaginaires...',
  'On recompte les ariary avec sérieux...',
  'On réveille le tableau de bord...',
  'On vérifie les badges staff...',
  'On prépare les bonnes nouvelles...',
  'On range les fichiers YFC...',
]

export default function App() {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loaderMessageIndex, setLoaderMessageIndex] = useState(() => Math.floor(Math.random() * LOADER_MESSAGES.length))

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
    let active = true
    import('./services/pushNotifications')
      .then(({ bindForegroundPushNotifications, syncPushNotifications }) => {
        if (!active) return
        syncPushNotifications().catch(() => {})
        bindForegroundPushNotifications(() => {}).catch(() => {})
      })
      .catch(() => {})
    return () => { active = false }
  }, [user?.uid])

  useEffect(() => {
    if (authLoading || !user?.uid) return undefined

    let cancelled = false
    const timers = []
    const isDesktop = window.matchMedia?.('(min-width: 1024px)').matches
    const queue = isDesktop ? desktopPreloadQueue : mobilePreloadQueue

    const idleId = scheduleIdleTask(() => {
      queue.forEach((loadPage, index) => {
        const timer = window.setTimeout(() => {
          if (!cancelled) loadPage().catch(() => {})
        }, index * 300)
        timers.push(timer)
      })
    })

    return () => {
      cancelled = true
      cancelIdleTask(idleId)
      timers.forEach(timer => window.clearTimeout(timer))
    }
  }, [authLoading, user?.uid])

  useEffect(() => {
    if (!authLoading) return
    const id = setInterval(() => {
      setLoaderMessageIndex(current => {
        if (LOADER_MESSAGES.length <= 1) return current
        let next = current
        while (next === current) next = Math.floor(Math.random() * LOADER_MESSAGES.length)
        return next
      })
    }, 1700)
    return () => clearInterval(id)
  }, [authLoading])

  if (authLoading) return (
    <div className="app-loader-screen" aria-label="Chargement">
      <div className="app-loader-card">
        <div className="app-loader-brand">
          <span>YFC</span>
        </div>
        <h1>Young For Christ</h1>
        <p key={loaderMessageIndex}>{LOADER_MESSAGES[loaderMessageIndex]}</p>
        <div className="app-loader-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  )

  return (
    <BrowserRouter>
      <ScrollToTop />
      <BackNavigationGuard user={user} />
      <BottomNav user={user} />
      <Routes>
          <Route path="/verify/:receiptNumber" element={<Suspense fallback={<RouteFallback />}><VerifyReceipt /></Suspense>} />
          <Route path="/login" element={user ? <FallbackRoute /> : <Login />} />
          <Route path="/" element={<HomeRoute user={user} userData={userData} />} />
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
          <Route path="*" element={<FallbackRoute />} />
      </Routes>
      <SpeedInsights />
    </BrowserRouter>
  )
}
