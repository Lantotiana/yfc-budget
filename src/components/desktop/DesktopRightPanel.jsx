import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { generateNewVerse, getVerseOfDay } from '../../services/verseOfDay'

function isOnline(user) {
  if (!user?.lastSeen?.toDate) return false
  return Date.now() - user.lastSeen.toDate().getTime() < 2 * 60_000
}

function getInitials(nameOrEmail = '') {
  const parts = String(nameOrEmail || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return String(parts[0] || '?').slice(0, 2).toUpperCase()
}

function activityLabel(user) {
  return user?.currentActivity || 'Utilise l’application'
}

export default function DesktopRightPanel({ user }) {
  const [verse, setVerse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [expanded, setExpanded] = useState(false)
  const [users, setUsers] = useState([])
  const cardRef = useRef(null)

  useEffect(() => {
    getVerseOfDay().then(setVerse)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, () => setUsers([]))
  }, [])

  useEffect(() => {
    if (!expanded) return undefined

    function onPointerDown(event) {
      if (cardRef.current?.contains(event.target)) return
      setExpanded(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [expanded])

  async function refreshVerse() {
    if (loading) return
    setLoading(true)
    const next = await generateNewVerse()
    if (next) setVerse(next)
    setLoading(false)
  }

  const currentHour = now.getHours()
  const isNight = currentHour >= 18 || currentHour < 6
  const onlineUsers = users
    .filter(u => u.approuve === true && isOnline(u))
    .sort((a, b) => String(a.nom || a.email || '').localeCompare(String(b.nom || b.email || ''), 'fr'))

  return (
    <aside className={`desktop-right-panel desktop-verse-panel${expanded ? ' verse-expanded' : ''}`}>
      <div
        ref={cardRef}
        className={`desktop-right-card desktop-verse-card daily-verse-card ${isNight ? 'night' : 'day'}${expanded ? ' expanded' : ''}`}
        onClick={() => setExpanded(true)}
      >
        <div className="daily-sky">
          <div className="daily-stars" />
          <div className="daily-sun" />
          <div className="daily-cloud daily-cloud-one" />
          <div className="daily-cloud daily-cloud-two" />
          <div className="daily-hill daily-hill-back" />
          <div className="daily-hill daily-hill-front" />
        </div>

        <button
          type="button"
          className={`desktop-verse-refresh${loading ? ' loading' : ''}`}
          onClick={e => {
            e.stopPropagation()
            refreshVerse()
          }}
          disabled={loading}
          aria-label="Renouveler le verset"
          title="Générer"
        >
          <RefreshCw size={16} />
        </button>

        {verse ? (
          <div className="daily-verse-content desktop-verse-content">
            <div className="daily-verse-label">Verset du jour</div>
            <p className="desktop-verse-text">"{verse.text}"</p>
            <strong className="desktop-verse-ref">{verse.ref}</strong>
            {verse.explanation && <small className="desktop-verse-expl">{verse.explanation}</small>}
          </div>
        ) : (
          <div className="desktop-verse-empty">
            <Sparkles size={20} />
            <p>Le verset sera disponible après la connexion aux fonctions Firebase.</p>
          </div>
        )}
      </div>

      <div className="desktop-right-card desktop-online-card">
        <div className="desktop-online-head">
          <span>Connectés</span>
          <strong>({onlineUsers.length})</strong>
        </div>
        <div className="desktop-online-list">
          {onlineUsers.length > 0 ? onlineUsers.map(onlineUser => {
            const name = onlineUser.nom || onlineUser.displayName || onlineUser.email || 'Staff'
            return (
              <div className="desktop-online-user" key={onlineUser.id}>
                <div className="desktop-online-avatar">
                  {onlineUser.photoURL
                    ? <img src={onlineUser.photoURL} alt="" />
                    : <span>{getInitials(name)}</span>}
                </div>
                <div>
                  <strong>{name.split(/\s+/)[0]}</strong>
                  <small>{activityLabel(onlineUser)}</small>
                </div>
              </div>
            )
          }) : (
            <div className="desktop-online-empty">Aucun utilisateur connecté</div>
          )}
        </div>
      </div>
    </aside>
  )
}
