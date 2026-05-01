import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { ArrowLeft, ArrowRight, Bell, CalendarCheck, CalendarDays, FolderOpen, LayoutDashboard, MessageCircle, RefreshCw, Settings, Users, Wallet } from 'lucide-react'
import { db } from '../firebase'
import { useTheme } from '../context/ThemeContext'
import { generateNewVerse, getVerseOfDay } from '../services/verseOfDay'

function getPrenom(fullName) {
  if (!fullName) return null
  return fullName.trim().split(' ')[0]
}

function getLocalDayKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getFallbackVerseIndex(dayKey) {
  const [year, month, day] = dayKey.split('-').map(Number)
  return Math.floor(new Date(year, month - 1, day).getTime() / 86400000) % dailyVerses.length
}

const modules = [
  { path: '/dashboard', Icon: LayoutDashboard, label: 'Tableau de bord', desc: 'Vue globale',          color: '#2563eb' },
  { path: '/budget',    Icon: Wallet,          label: 'Budget YFC',      desc: 'Entrées & dépenses',   color: '#10b981' },
  { path: '/presences', Icon: CalendarCheck,   label: 'Présences',       desc: 'Suivi Alimbavaka',     color: '#7c3aed' },
  { path: '/membres',   Icon: Users,           label: 'Membres',         desc: 'Liste des membres',    color: '#f43f5e' },
  { path: '/evenements',Icon: CalendarDays,    label: 'Événements',      desc: 'Agenda YFC',           color: '#f59e0b' },
  { path: '/documents', Icon: FolderOpen,      label: 'Documents',       desc: 'Ressources partagées', color: '#06b6d4' },
]

const dailyVerses = [
  {
    text: "L'Éternel est mon berger: je ne manquerai de rien.",
    ref: 'Psaume 23:1',
    explanation: "Ce verset nous rappelle que Dieu prend soin de nous comme un berger attentif veille sur ses brebis. Il pourvoit à tous nos besoins — matériels, spirituels, émotionnels. Rien de ce dont nous avons vraiment besoin ne nous manquera si nous nous confions en Lui.",
  },
  {
    text: 'Je puis tout par celui qui me fortifie.',
    ref: 'Philippiens 4:13',
    explanation: "Paul écrit ces mots depuis la prison, ayant appris à être content en toutes circonstances. Cette force ne vient pas de nous-mêmes, mais du Christ qui nous habite. Quand nous nous sentons faibles, c'est là que Sa puissance se manifeste le plus pleinement.",
  },
  {
    text: 'Ta parole est une lampe à mes pieds, et une lumière sur mon sentier.',
    ref: 'Psaume 119:105',
    explanation: "La Bible n'est pas juste un livre d'histoire : c'est une lumière vivante qui éclaire nos décisions quotidiennes. Une lampe éclaire suffisamment pour le prochain pas — pas toujours tout le chemin. Dieu nous guide pas à pas, à travers Sa Parole.",
  },
  {
    text: "Recommande ton sort à l'Éternel, mets en lui ta confiance, et il agira.",
    ref: 'Psaume 37:5',
    explanation: "Confier nos projets à Dieu n'est pas une passivité, c'est un acte de foi profonde. Le mot hébreu signifie littéralement « rouler son fardeau sur Lui ». Quand on lâche prise et qu'on fait confiance, Il prend la situation en main et agit en notre faveur.",
  },
  {
    text: 'Ne crains rien, car je suis avec toi.',
    ref: 'Ésaïe 41:10',
    explanation: "Dieu s'adresse à Israël en exil, mais ce message traverse les siècles et nous atteint aujourd'hui. Sa présence ne supprime pas les difficultés, mais elle les transforme. Savoir qu'Il est à nos côtés change tout — la peur cède la place à une paix qui dépasse notre compréhension.",
  },
  {
    text: 'Que tout ce que vous faites se fasse avec amour.',
    ref: '1 Corinthiens 16:14',
    explanation: "Paul conclut sa lettre par cet appel simple mais profond : l'amour doit être le motif derrière chaque action. Pas seulement les grandes décisions, mais aussi les petits gestes du quotidien. L'amour de Dieu en nous devient le moteur de notre vie entière.",
  },
  {
    text: "L'Éternel combattra pour vous; et vous, gardez le silence.",
    ref: 'Exode 14:14',
    explanation: "Moïse dit ces mots au peuple piégé entre la mer Rouge et l'armée de Pharaon. « Garder le silence » ne signifie pas ne rien faire, mais faire confiance plutôt que paniquer. Il y a des batailles que Dieu réserve pour Lui seul — notre rôle est de rester fermes dans la foi.",
  },
]

export default function Home({ user, userData }) {
  const navigate = useNavigate()
  const { C } = useTheme()
  const [verseOpen, setVerseOpen] = useState(false)
  const [verseClosing, setVerseClosing] = useState(false)
  const [verseHistoryPushed, setVerseHistoryPushed] = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [aiVerse, setAiVerse] = useState(null)
  const [generatingVerse, setGeneratingVerse] = useState(false)
  const [fallbackOffset, setFallbackOffset] = useState(0)
  const [now, setNow] = useState(() => new Date())
  const dayKey = getLocalDayKey(now)

  useEffect(() => {
    setFallbackOffset(0)
    getVerseOfDay().then(v => { if (v) setAiVerse(v) })
  }, [dayKey])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const modalBlocking = verseOpen || verseClosing
    const modalVisible = verseOpen && !verseClosing
    document.body.style.overflow = modalBlocking ? 'hidden' : ''
    document.body.toggleAttribute('data-verse-modal-open', modalBlocking)
    document.body.toggleAttribute('data-verse-modal-visible', modalVisible)
    return () => {
      document.body.style.overflow = ''
      document.body.removeAttribute('data-verse-modal-open')
      document.body.removeAttribute('data-verse-modal-visible')
    }
  }, [verseOpen, verseClosing])

  useEffect(() => {
    function onPopState(e) {
      if (!verseOpen) return
      // Ensure the global Back guard doesn't show the Home exit toast for this Back press.
      document.body.setAttribute('data-ignore-next-pop', 'true')
      // Intercept Back while verse is open so the global Back guard doesn't show the Home exit toast.
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation()
      if (typeof e.stopPropagation === 'function') e.stopPropagation()
      if (typeof e.preventDefault === 'function') e.preventDefault()
      if (e.state?.yfcVerseModal) return
      setVerseClosing(true)
      window.setTimeout(() => {
        setVerseOpen(false)
        setVerseClosing(false)
        setVerseHistoryPushed(false)
      }, 260)
    }

    window.addEventListener('popstate', onPopState, { capture: true })
    return () => window.removeEventListener('popstate', onPopState, { capture: true })
  }, [verseOpen])


  const prenom = getPrenom(userData?.nom) || user?.email?.split('@')[0]

  useEffect(() => {
    if (!user?.uid) return
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(20))
    return onSnapshot(q, snap => {
      const unread = snap.docs.filter(d => {
        const targetUserId = d.data().targetUserId
        const targetUserEmail = d.data().targetUserEmail
        if (targetUserId && targetUserId !== user.uid) return false
        if (targetUserEmail && targetUserEmail !== user.email) return false
        const readBy = d.data().readBy || []
        return !readBy.includes(user.uid)
      })
      setNotifCount(unread.length)
    }, () => setNotifCount(0))
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid) return
    const q = query(collection(db, 'staffMessages'), orderBy('createdAt', 'desc'), limit(50))
    return onSnapshot(q, snap => {
      let saved = {}
      try { saved = JSON.parse(localStorage.getItem(`staffMsg_reactions_${user.uid}`) || '{}') } catch {}

      let count = 0
      snap.docs.forEach(d => {
        const data = d.data()
        if (data.deleted) return
        if (!(data.readBy || []).includes(user.uid)) count++
        if (data.senderId === user.uid) {
          const current = Object.values(data.reactions || {}).reduce((sum, uids) => {
            return sum + (uids || []).filter(id => id !== user.uid).length
          }, 0)
          if (current > (saved[d.id] || 0)) count++
        }
      })
      setUnreadMessages(count)
    }, () => setUnreadMessages(0))
  }, [user?.uid])

  const initials = (userData?.nom || user?.email || '?').slice(0, 2).toUpperCase()
  const dailyVerse = aiVerse ?? dailyVerses[(getFallbackVerseIndex(dayKey) + fallbackOffset) % dailyVerses.length]
  const currentHour = now.getHours()
  const isNight = currentHour >= 18 || currentHour < 6

  async function handleGenerateVerse(e) {
    e.stopPropagation()
    if (generatingVerse) return
    setGeneratingVerse(true)
    const verse = await generateNewVerse()
    if (verse) setAiVerse(verse)
    else {
      setAiVerse(null)
      setFallbackOffset(prev => prev + 1)
    }
    setGeneratingVerse(false)
  }

  function openVerse() {
    setVerseClosing(false)
    setVerseOpen(true)
    if (!verseHistoryPushed) {
      window.history.pushState({ yfcVerseModal: true }, '', window.location.href)
      setVerseHistoryPushed(true)
    }
  }

  function closeVerse() {
    setVerseClosing(true)
    window.setTimeout(() => {
      setVerseOpen(false)
      setVerseClosing(false)
      if (verseHistoryPushed) {
        setVerseHistoryPushed(false)
        document.body.setAttribute('data-ignore-next-pop', 'true')
        window.history.back()
      }
    }, 260)
  }

  return (
    <div className="page-container sin" style={{ paddingBottom: 'calc(86px + env(safe-area-inset-bottom))', background: C.bg }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 24px', paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Avatar */}
          <div
            onClick={() => navigate('/parametres')}
            style={{
              width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
              background: C.surf2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 19, fontWeight: 700, color: '#fff', cursor: 'pointer',
              overflow: 'hidden',
              boxShadow: C.shadow,
            }}
          >
            {userData?.photoURL
              ? <img src={userData.photoURL} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials
            }
          </div>

          {/* Greeting */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: C.t2, marginBottom: 2 }}>Bonjour</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.t1, lineHeight: 1.1, letterSpacing: '-.4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {prenom}
            </div>
            <div style={{ fontSize: 10, color: C.t2, fontWeight: 700, letterSpacing: '1px', marginTop: 2, textTransform: 'uppercase' }}>
              Young For Christ
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Messages Staff */}
            <button
              onClick={() => navigate('/messages')}
              style={{ width: 40, height: 40, borderRadius: 14, border: `1px solid ${C.bord}`, background: C.surf, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', position: 'relative' }}
              aria-label="Messages Staff"
            >
              <MessageCircle size={17} />
              {unreadMessages > 0 && (
                <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999, background: '#10b981', color: '#fff', border: `2px solid ${C.bg}`, fontSize: 9, fontWeight: 800, lineHeight: '13px', textAlign: 'center' }}>
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </button>

            {/* Notifications */}
            <button
              onClick={() => navigate('/notifications')}
              style={{ width: 40, height: 40, borderRadius: 14, border: `1px solid ${C.bord}`, background: C.surf, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.t2, position: 'relative' }}
              aria-label="Notifications"
            >
              <Bell size={17} />
              {notifCount > 0 && (
                <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999, background: C.coral, color: '#fff', border: `2px solid ${C.bg}`, fontSize: 9, fontWeight: 800, lineHeight: '13px', textAlign: 'center' }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>

            {/* Paramètres */}
            <button
              onClick={() => navigate('/parametres')}
              style={{ width: 40, height: 40, borderRadius: 14, border: `1px solid ${C.bord}`, background: C.surf, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.t2 }}
              aria-label="Paramètres"
            >
              <Settings size={17} />
            </button>
          </div>
        </div>
      </div>

      {/* Daily verse */}
      <div style={{ padding: '0 20px 16px' }}>
        <div
          className={`daily-verse-card ${isNight ? 'night' : 'day'}`}
          onClick={openVerse}
          style={{ cursor: 'pointer' }}
        >
          <div className="daily-sky">
            <div className="daily-stars" />
            <div className="daily-sun" />
            <div className="daily-cloud daily-cloud-one" />
            <div className="daily-cloud daily-cloud-two" />
            <div className="daily-hill daily-hill-back" />
            <div className="daily-hill daily-hill-front" />
          </div>
          <div className="daily-verse-content">
            <div className="daily-verse-label">Verset du jour</div>
            <div className="daily-verse-text">"{dailyVerse.text}"</div>
            <div className="daily-verse-ref">{dailyVerse.ref}</div>
          </div>
          <button
            type="button"
            className={`verse-modal-generate${generatingVerse ? ' loading' : ''}`}
            onClick={handleGenerateVerse}
            aria-label="Générer un autre verset"
            title="Générer"
          >
            <RefreshCw size={16} />
          </button>
          <div className="daily-verse-open-cue" aria-hidden="true">
            <ArrowRight size={15} />
          </div>
        </div>
      </div>

      {/* Modules grid */}
      <div style={{ padding: '0 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {modules.map((m, i) => (
              <button
                key={m.path}
                onClick={() => navigate(m.path)}
                style={{
                  background: m.color,
                  border: '0',
                  borderRadius: 20,
                  padding: '18px 16px',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  textAlign: 'left',
                  boxShadow: `0 14px 30px ${m.color}33`,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: 'radial-gradient(circle at 12px 12px, rgba(255,255,255,.24) 0 2px, transparent 2.5px), linear-gradient(135deg, rgba(255,255,255,.16) 0 1px, transparent 1px)',
                    backgroundSize: '28px 28px, 18px 18px',
                    opacity: .55,
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
                  <m.Icon size={18} color="#fff" />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3, lineHeight: 1.3, position: 'relative' }}>{m.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.78)', position: 'relative' }}>{m.desc}</div>
              </button>
          ))}
        </div>
      </div>

      {!(verseOpen || verseClosing) && createPortal((
        <button
          type="button"
          className="famp-floating-btn"
          onClick={() => navigate('/assistant')}
          aria-label="Assistant virtuel"
          title="Assistant virtuel"
        >
          <MessageCircle size={23} />
        </button>
      ), document.body)}

      <div
        className={`verse-modal ${verseOpen ? 'open' : 'closed'}${verseClosing ? ' closing' : ''}${isNight ? ' night' : ''}`}
        aria-hidden={!verseOpen}
      >
          <div className="daily-sky">
            <div className="daily-stars" />
            <div className="daily-sun" />
            <div className="daily-cloud daily-cloud-one" />
            <div className="daily-cloud daily-cloud-two" />
            <div className="daily-hill daily-hill-back" />
            <div className="daily-hill daily-hill-front" />
          </div>
          <div className="verse-modal-overlay" />
          <button className="verse-modal-back" onClick={closeVerse} tabIndex={verseOpen ? 0 : -1}>
            <ArrowLeft size={20} />
          </button>
          <button
            type="button"
            className={`verse-modal-generate${generatingVerse ? ' loading' : ''}`}
            onClick={handleGenerateVerse}
            tabIndex={verseOpen ? 0 : -1}
            aria-label="Générer un autre verset"
            title="Générer"
          >
            <RefreshCw size={16} />
          </button>
          <div className="verse-modal-scroll">
            <div className="verse-modal-header">
              <div className="verse-modal-tag">Verset du jour</div>
              <p className="verse-modal-verse">&ldquo;{dailyVerse.text}&rdquo;</p>
              <p className="verse-modal-ref">{dailyVerse.ref}</p>
            </div>
            <div className="verse-modal-body">
              <div className="verse-modal-sep" />
              <p className="verse-modal-expl">{dailyVerse.explanation}</p>
            </div>
          </div>
        </div>

    </div>
  )
}
