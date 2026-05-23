import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import DesktopSidebar from '../components/desktop/DesktopSidebar'
import DesktopTopbar from '../components/desktop/DesktopTopbar'
import DesktopRightPanel from '../components/desktop/DesktopRightPanel'
import SettingsSubPanel from '../components/desktop/SettingsSubPanel'
import { DesktopToolbarContext } from '../context/DesktopToolbarContext'

export default function DesktopLayout({ user, userData, children }) {
  const location = useLocation()
  const isSettingsPage = location.pathname.startsWith('/parametres')
  const [membres, setMembres] = useState([])
  const [toolbar, setToolbar] = useState({ actions: null })
  const [searchData, setSearchData] = useState({
    membres: [],
    transactions: [],
    presenceEvents: [],
    agendaEvents: [],
    documents: [],
    messages: [],
  })

  useEffect(() => {
    const failSoft = label => error => {
      console.warn(`Chargement desktop ignore (${label})`, error?.code || error?.message || error)
    }
    const unsubs = [
      onSnapshot(collection(db, 'membres'), snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setMembres(data)
        setSearchData(prev => ({ ...prev, membres: data }))
      }, failSoft('membres')),
      onSnapshot(query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(80)), snap => {
        setSearchData(prev => ({ ...prev, transactions: snap.docs.map(d => ({ id: d.id, ...d.data() })) }))
      }, failSoft('transactions')),
      onSnapshot(query(collection(db, 'evenements'), orderBy('date', 'desc'), limit(60)), snap => {
        setSearchData(prev => ({ ...prev, presenceEvents: snap.docs.map(d => ({ id: d.id, ...d.data() })) }))
      }, failSoft('evenements')),
      onSnapshot(query(collection(db, 'evenements_agenda'), orderBy('dateDebut'), limit(60)), snap => {
        setSearchData(prev => ({ ...prev, agendaEvents: snap.docs.map(d => ({ id: d.id, ...d.data() })) }))
      }, failSoft('evenements_agenda')),
      onSnapshot(query(collection(db, 'documents'), orderBy('uploadedAt', 'desc'), limit(60)), snap => {
        setSearchData(prev => ({ ...prev, documents: snap.docs.map(d => ({ id: d.id, ...d.data() })) }))
      }, failSoft('documents')),
      onSnapshot(query(collection(db, 'staffMessages'), orderBy('createdAt', 'desc'), limit(80)), snap => {
        setSearchData(prev => ({ ...prev, messages: snap.docs.map(d => ({ id: d.id, ...d.data() })) }))
      }, failSoft('staffMessages')),
    ]

    return () => {
      unsubs.forEach(unsub => unsub())
    }
  }, [])

  useEffect(() => {
    function onError(event) {
      if (event.target?.tagName === 'IMG') return
      console.error('Desktop layout captured error', event.error || event.message)
    }
    window.addEventListener('error', onError)
    return () => window.removeEventListener('error', onError)
  }, [])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== 'Escape') return
      document.body.removeAttribute('data-desktop-popup-open')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const popupOpen = Boolean(
        document.querySelector('.modal-overlay, .bottom-sheet-overlay, .staff-announcement-modal, .staff-context-overlay, .verse-modal.open'),
      )
      if (popupOpen) document.body.setAttribute('data-desktop-popup-open', 'true')
      else document.body.removeAttribute('data-desktop-popup-open')
    })
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    document.body.setAttribute('data-desktop-layout', 'true')
    return () => document.body.removeAttribute('data-desktop-layout')
  }, [])

  return (
    <DesktopToolbarContext.Provider value={{ toolbar, setToolbar }}>
      <div className={`desktop-shell${isSettingsPage ? ' settings-mode' : ''}`}>
        <DesktopSidebar user={user} compact={isSettingsPage} />
        {isSettingsPage && <SettingsSubPanel user={user} userData={userData} />}
        <div className="desktop-main">
          <DesktopTopbar user={user} userData={userData} searchData={searchData} toolbar={toolbar} />
          <div className="desktop-workspace">
            <main className="desktop-content">
              {children}
            </main>
            <DesktopRightPanel user={user} />
          </div>
        </div>
      </div>
    </DesktopToolbarContext.Provider>
  )
}
