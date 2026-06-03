import { useEffect, useRef, useState } from 'react'
import { Heart, Sparkles } from 'lucide-react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { createNotification } from '../../notifications'
import {
  getDateKey,
  getOrCreateSharedVerse,
  subscribeToSharedVerse,
  toggleHeart,
} from '../../services/verseOfDay'

function isOnline(user) {
  if (!user?.lastSeen?.toDate) return false
  return Date.now() - user.lastSeen.toDate().getTime() < 2.5 * 60_000
}

function getInitials(nameOrEmail = '') {
  const parts = String(nameOrEmail || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return String(parts[0] || '?').slice(0, 2).toUpperCase()
}

function activityLabel(user) {
  return user?.currentActivity || 'Utilise l’application'
}

export default function DesktopRightPanel({ user, userData }) {
  const [verse, setVerse] = useState(null)
  const [now, setNow] = useState(() => new Date())
  const [expanded, setExpanded] = useState(false)
  const [users, setUsers] = useState([])
  const [heartLoading, setHeartLoading] = useState(false)
  const cardRef = useRef(null)
  const dateKey = getDateKey(now)

  // Subscribe to shared verse (real-time hearts + verse updates)
  useEffect(() => {
    // Show cached verse immediately, subscribe for live updates
    getOrCreateSharedVerse(dateKey).then(v => { if (v) setVerse(v) }).catch(() => {})
    return subscribeToSharedVerse(dateKey, v => { if (v) setVerse(v) }, () => {})
  }, [dateKey])

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

  async function handleHeart(e) {
    e.stopPropagation()
    e.preventDefault()
    if (!user?.uid || heartLoading || !verse) return
    const isLiked = verse.hearts?.includes(user.uid) ?? false
    const userInfo = { photoURL: userData?.photoURL || user.photoURL || '', name: userData?.nom || user.displayName || user.email || '' }

    // Optimistic update — UI responds instantly
    setVerse(v => {
      if (!v) return v
      const hearts = isLiked ? (v.hearts || []).filter(h => h !== user.uid) : [...(v.hearts || []), user.uid]
      const heartsInfo = { ...(v.heartsInfo || {}) }
      if (isLiked) delete heartsInfo[user.uid]
      else heartsInfo[user.uid] = userInfo
      return { ...v, hearts, heartsInfo }
    })

    setHeartLoading(true)
    await toggleHeart(dateKey, user.uid, isLiked, userInfo).catch(() => {
      setVerse(v => v)
    })
    if (!isLiked) {
      createNotification({
        type: 'verset',
        titre: `${userInfo.name || user?.email || 'Quelqu\'un'} a aimé le verset du jour`,
        route: '/',
        actorOverride: { uid: user.uid, nom: userInfo.name || user?.email || '', email: user?.email || '', photoURL: userInfo.photoURL || '' },
      })
    }
    setHeartLoading(false)
  }

  const currentHour = now.getHours()
  const isNight = currentHour >= 18 || currentHour < 6
  const onlineUsers = users
    .filter(u => u.approuve === true && isOnline(u))
    .sort((a, b) => String(a.nom || a.email || '').localeCompare(String(b.nom || b.email || ''), 'fr'))

  const isLiked = Boolean(verse?.hearts?.includes(user?.uid))
  const heartCount = verse?.hearts?.length ?? 0

  return (
    <aside className={`desktop-right-panel desktop-verse-panel${expanded ? ' verse-expanded' : ''}`}>
      <div
        ref={cardRef}
        className={`desktop-right-card desktop-verse-card daily-verse-card ${isNight ? 'night' : 'day'}${expanded ? ' expanded' : ''}`}
        style={{ position: 'relative' }}
        onClick={() => setExpanded(v => !v)}
      >
        <div className="daily-sky">
          <div className="daily-stars" />
          <div className="daily-sun" />
          <div className="daily-cloud daily-cloud-one" />
          <div className="daily-cloud daily-cloud-two" />
          <div className="daily-hill daily-hill-back" />
          <div className="daily-hill daily-hill-front" />
        </div>

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

        {/* Heart — always visible at bottom-right of card */}
        {verse && (
          <button
            type="button"
            onClick={handleHeart}
            disabled={heartLoading}
            aria-label={isLiked ? 'Retirer mon cœur' : 'Réagir avec un cœur'}
            style={{
              position: 'absolute', bottom: 12, right: 12,
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'none', border: 'none', padding: '4px',
              cursor: heartLoading ? 'default' : 'pointer',
              color: isLiked ? '#f43f5e' : 'rgba(255,255,255,0.85)',
              fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
              transition: 'all 0.15s',
              opacity: heartLoading ? 0.6 : 1,
              zIndex: 50, pointerEvents: 'all',
              whiteSpace: 'nowrap',
            }}
          >
            {/* Avatars of reactors */}
            {verse.heartsInfo && Object.keys(verse.heartsInfo).length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {Object.entries(verse.heartsInfo).slice(0, 3).map(([uid, info], i) => (
                  <div key={uid} style={{
                    width: 18, height: 18, borderRadius: '50%', overflow: 'hidden',
                    marginLeft: i === 0 ? 0 : -5, flexShrink: 0,
                    border: '1.5px solid rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                  }}>
                    {info.photoURL && (
                      <img src={info.photoURL} alt="" onError={e => { e.currentTarget.style.display = 'none' }}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <span style={{ fontSize: 7, fontWeight: 800, color: '#fff' }}>
                      {(info.name?.charAt(0) || '?').toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Heart
              size={18}
              fill={isLiked ? '#f43f5e' : 'none'}
              color={isLiked ? '#f43f5e' : 'rgba(255,255,255,0.85)'}
              strokeWidth={2.5}
              style={{ flexShrink: 0 }}
            />
            {heartCount > 0 && <span>{heartCount}</span>}
          </button>
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
