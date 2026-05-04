import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { Calendar, CalendarCheck, Check, Clock, Copy, Edit3, MapPin, Megaphone, MessageCircle, MoreHorizontal, Pin, Search, Send, Trash2, Users, X } from 'lucide-react'
import { db } from '../firebase'
import { ADMIN_EMAIL } from '../constants'
import { createNotification } from '../notifications'
import { canModerateStaffMessagesRole, normalizeAccessText, sameEmail } from '../utils/access'
import { useTheme } from '../context/ThemeContext'

const INITIAL_LIMIT = 30
const PAGE_SIZE = 30
const MAX_MESSAGE_LENGTH = 1000
const MAX_ANNOUNCEMENT_TITLE = 80
const MAX_ANNOUNCEMENT_DETAILS = 1000
const MAX_MENTIONS = 10
const EDIT_WINDOW_MS = 15 * 60 * 1000
const REACTIONS = ['👍', '❤️', '🙏', '✅', '😂', '👀']
const MENTION_EVERYONE_ID = '__everyone__'
const MENTION_EVERYONE = { uid: MENTION_EVERYONE_ID, name: 'Tous le monde', mention: '@Tous', role: 'Notifier tout le monde' }
const StaffHeaderIcon = MessageCircle
const CLOUDINARY_CLOUD = 'dtthz84ie'
const CLOUDINARY_PRESET = 'yfc_profiles'

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function toMillis(iso) {
  const time = new Date(iso || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

function cleanMessage(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH)
}

function cleanField(value, maxLength) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function getDisplayName(userDoc) {
  return userDoc?.nom || userDoc?.displayName || userDoc?.prenom || userDoc?.email?.split('@')[0] || 'Staff'
}

function getMentionToken(name) {
  return '@' + String(name || 'Staff').trim().split(/\s+/)[0]
}

function renderLinkedText(text) {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi
  return String(text || '').split(urlRegex).map((part, index) => {
    if (!part.match(urlRegex)) return part
    const href = part.startsWith('www.') ? `https://${part}` : part
    return (
      <a
        key={`${part}-${index}`}
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={e => e.stopPropagation()}
      >
        {part}
      </a>
    )
  })
}

function formatAnnouncementDate(value) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}


export default function MessagesStaff({ user, userData }) {
  const { C } = useTheme()
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const composerRef = useRef(null)
  const groupPhotoInputRef = useRef(null)
  const longPressTimer = useRef(null)
  const longPressTriggered = useRef(false)
  const longPressRect = useRef(null)
  const longPressStartPos = useRef(null)
  const initialScrollDone = useRef(false)
  const [users, setUsers] = useState([])
  const [membres, setMembres] = useState([])
  const [messages, setMessages] = useState([])
  const [pinnedMessages, setPinnedMessages] = useState([])
  const [messageLimit, setMessageLimit] = useState(INITIAL_LIMIT)
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [mentions, setMentions] = useState([])
  const [mentionQuery, setMentionQuery] = useState(null)
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [editAnnouncementForm, setEditAnnouncementForm] = useState({
    title: '',
    details: '',
    announcementDate: '',
    announcementTime: '',
    location: '',
  })
  const [detailsId, setDetailsId] = useState(null)
  const [contextMsg, setContextMsg] = useState(null)
  const [contextPos, setContextPos] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const [groupPhotoURL, setGroupPhotoURL] = useState('')
  const [uploadingGroupPhoto, setUploadingGroupPhoto] = useState(false)
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [publishingAnnouncement, setPublishingAnnouncement] = useState(false)
  const [announcementError, setAnnouncementError] = useState('')
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    details: '',
    announcementDate: '',
    announcementTime: '',
    location: '',
  })

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.approuve === true))
    })
    const unsubMembers = onSnapshot(collection(db, 'membres'), snap => {
      setMembres(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => {
      unsubUsers()
      unsubMembers()
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    const q = query(collection(db, 'staffMessages'), orderBy('createdAt', 'desc'), limit(messageLimit))
    return onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse())
      setLoading(false)
    }, () => setLoading(false))
  }, [messageLimit])

  useEffect(() => {
    const q = query(collection(db, 'staffMessages'), where('pinned', '==', true), limit(1))
    return onSnapshot(q, snap => {
      setPinnedMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  useEffect(() => {
    return onSnapshot(doc(db, 'appSettings', 'messages'), snap => {
      setGroupPhotoURL(snap.exists() ? (snap.data().groupPhotoURL || '') : '')
    })
  }, [])

  const staffUsers = useMemo(() => {
    return users.map(u => {
      const member = membres.find(m => sameEmail(m.email, u.email))
      const name = getDisplayName(u)
      return {
        id: u.id,
        uid: u.id,
        email: u.email || '',
        name,
        mention: getMentionToken(name),
        role: member?.staffRole || (member?.staff ? 'Staff' : 'Staff'),
        photoURL: u.photoURL || member?.photoURL || '',
      }
    })
  }, [users, membres])

  const currentMember = useMemo(() => membres.find(m => sameEmail(m.email, user?.email)), [membres, user?.email])
  const currentStaff = useMemo(() => staffUsers.find(s => s.uid === user?.uid), [staffUsers, user?.uid])
  const isAdmin = user?.email === ADMIN_EMAIL
  const canModerate = isAdmin || canModerateStaffMessagesRole(currentMember?.staffRole)
  const canModerateAnnouncement = isAdmin || ['president', 'vice president'].includes(normalizeAccessText(currentMember?.staffRole))
  const canAccess = Boolean(user?.uid && userData?.approuve !== false)

  const pinnedMessage = pinnedMessages.find(m => !m.deleted) || null
  const filteredMessages = useMemo(() => {
    const term = search.trim().toLowerCase()
    const visible = messages.filter(m => !m.deleted)
    if (!term) return visible
    return visible.filter(m =>
      String(m.text || '').toLowerCase().includes(term) ||
      String(m.title || '').toLowerCase().includes(term) ||
      String(m.details || '').toLowerCase().includes(term) ||
      String(m.senderName || '').toLowerCase().includes(term)
    )
  }, [messages, search])

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    const showEveryone = 'tous le monde'.includes(q) && !mentions.some(m => m.uid === MENTION_EVERYONE_ID)
    const individuals = staffUsers
      .filter(s => s.uid !== user?.uid)
      .filter(s => !mentions.some(m => m.uid === s.uid))
      .filter(s => s.name.toLowerCase().includes(q) || s.mention.toLowerCase().includes('@' + q))
      .slice(0, 5)
    return showEveryone ? [MENTION_EVERYONE, ...individuals] : individuals
  }, [mentionQuery, staffUsers, mentions, user?.uid])

  const latestReadMessageByUser = useMemo(() => {
    const latest = {}
    messages.forEach(message => {
      if (message.deleted) return
      ;(message.readBy || []).forEach(readerId => {
        if (readerId === message.senderId) return
        latest[readerId] = message.id
      })
    })
    return latest
  }, [messages])

  useEffect(() => {
    if (!user?.uid || messages.length === 0) return
    const unread = messages.filter(m => !m.deleted && !(m.readBy || []).includes(user.uid))
    if (unread.length === 0) return

    const batch = writeBatch(db)
    unread.forEach(m => batch.update(doc(db, 'staffMessages', m.id), { readBy: arrayUnion(user.uid) }))
    batch.commit().catch(err => console.warn('Messages non marqués comme lus', err))
  }, [messages, user?.uid])

  useEffect(() => {
    if (!user?.uid || messages.length === 0) return
    const snapshot = {}
    messages.forEach(m => {
      if (m.senderId !== user.uid || m.deleted) return
      snapshot[m.id] = Object.values(m.reactions || {}).reduce((sum, uids) => {
        return sum + (uids || []).filter(id => id !== user.uid).length
      }, 0)
    })
    try { localStorage.setItem(`staffMsg_reactions_${user.uid}`, JSON.stringify(snapshot)) } catch {}
  }, [messages, user?.uid])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    requestAnimationFrame(() => {
      if (!initialScrollDone.current) {
        el.scrollTop = el.scrollHeight
        initialScrollDone.current = true
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      }
    })
  }, [messages.length, input])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 108)}px`
  }, [input])

  useEffect(() => {
    const composer = composerRef.current
    if (!composer) return

    const updateComposerSpace = () => {
      document.documentElement.style.setProperty('--staff-composer-space', `${composer.offsetHeight + 68 + 24}px`)
    }

    updateComposerSpace()
    const observer = new ResizeObserver(updateComposerSpace)
    observer.observe(composer)
    window.addEventListener('resize', updateComposerSpace)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateComposerSpace)
      document.documentElement.style.removeProperty('--staff-composer-space')
    }
  }, [])

  useEffect(() => {
    return () => clearTimeout(longPressTimer.current)
  }, [])

  useEffect(() => {
    if (!contextMsg) return
    const exists = messages.some(m => m.id === contextMsg.id) || pinnedMessages.some(m => m.id === contextMsg.id)
    if (!exists) setContextMsg(null)
  }, [messages, pinnedMessages, contextMsg])

  function canEditMessage(message) {
    if (!message || message.senderId !== user.uid || message.deleted) return false
    if ((message.type || 'message') === 'presence_report') return false
    if ((message.type || 'message') === 'announcement') return true
    return Date.now() - toMillis(message.createdAt) <= EDIT_WINDOW_MS
  }

  function canDeleteMessage(message) {
    if (!message || message.deleted) return false
    if ((message.type || 'message') === 'announcement') return message.senderId === user.uid || canModerateAnnouncement
    if ((message.type || 'message') === 'presence_report') return message.senderId === user.uid || canModerateAnnouncement
    return message.senderId === user.uid || canModerate
  }

  function canPinMessage(message) {
    if (!message || message.deleted) return false
    if ((message.type || 'message') === 'announcement') return canModerateAnnouncement
    if ((message.type || 'message') === 'presence_report') return canModerateAnnouncement
    return canModerate
  }

  function openContextMenu(message, rect) {
    longPressTriggered.current = true
    navigator.vibrate?.(40)
    setContextMsg(message)
    setContextPos(rect || null)
  }

  function closeContextMenu() {
    setContextMsg(null)
    setContextPos(null)
  }

  function startReactionPress(e, message, compact) {
    clearTimeout(longPressTimer.current)
    if (message.deleted || compact) return
    longPressRect.current = e.currentTarget?.getBoundingClientRect() || null
    longPressStartPos.current = { x: e.clientX, y: e.clientY }
    longPressTimer.current = setTimeout(() => openContextMenu(message, longPressRect.current), 100)
  }

  function moveReactionPress(e) {
    if (!longPressStartPos.current) return
    const dx = e.clientX - longPressStartPos.current.x
    const dy = e.clientY - longPressStartPos.current.y
    if (Math.sqrt(dx * dx + dy * dy) > 8) {
      clearTimeout(longPressTimer.current)
      longPressStartPos.current = null
    }
  }

  function stopReactionPress() {
    clearTimeout(longPressTimer.current)
    longPressStartPos.current = null
  }

  function handleInputChange(value) {
    const next = value.slice(0, MAX_MESSAGE_LENGTH)
    setInput(next)
    const match = next.match(/(^|\s)@([A-Za-zÀ-ÖØ-öø-ÿ0-9_-]*)$/)
    setMentionQuery(match ? match[2] : null)
  }

  function insertMention(staff) {
    if (mentions.length >= MAX_MENTIONS) return
    const mentionText = staff.mention
    const next = input.replace(/(^|\s)@([A-Za-zÀ-ÖØ-öø-ÿ0-9_-]*)$/, match => {
      const prefix = match.startsWith(' ') ? ' ' : ''
      return `${prefix}${mentionText} `
    })
    setInput(next.slice(0, MAX_MESSAGE_LENGTH))
    setMentions(prev => prev.some(m => m.uid === staff.uid) ? prev : [...prev, staff].slice(0, MAX_MENTIONS))
    setMentionQuery(null)
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!canAccess || sending) return
    const text = cleanMessage(input)
    if (!text) return

    const validMentions = mentions
      .filter(m => text.includes(m.mention))
      .slice(0, MAX_MENTIONS)
    const hasEveryone = validMentions.some(m => m.uid === MENTION_EVERYONE_ID)
    const individualMentions = validMentions.filter(m => m.uid !== MENTION_EVERYONE_ID)
    const notifyTargets = hasEveryone
      ? staffUsers.filter(s => s.uid !== user.uid)
      : individualMentions
    const mentionUids = hasEveryone
      ? staffUsers.filter(s => s.uid !== user.uid).map(s => s.uid)
      : individualMentions.map(m => m.uid)

    setSending(true)
    try {
      const senderName = userData?.nom || currentStaff?.name || user?.displayName || user?.email || 'Staff'
      const senderRole = currentMember?.staffRole || currentStaff?.role || 'Staff'
      const senderPhoto = userData?.photoURL || currentStaff?.photoURL || user?.photoURL || null
      await addDoc(collection(db, 'staffMessages'), {
        type: 'message',
        text,
        senderId: user.uid,
        senderName,
        senderRole,
        senderPhoto,
        mentions: mentionUids,
        reactions: {},
        readBy: [user.uid],
        pinned: false,
        deleted: false,
        deletedAt: null,
        deletedBy: null,
        edited: false,
        editedAt: null,
        createdAt: new Date().toISOString(),
      })

      await Promise.all(notifyTargets.map(m => createNotification({
        type: 'message',
        titre: hasEveryone ? `${senderName} a mentionné tout le monde dans Messages Staff.` : `${senderName} vous a mentionné dans Messages Staff.`,
        detail: text,
        cible: m.uid,
        route: '/messages',
        targetUserId: m.uid,
        metadata: { source: 'staffMessages' },
      })))

      setInput('')
      setMentions([])
      setMentionQuery(null)
    } finally {
      setSending(false)
    }
  }

  async function updateGroupPhoto(e) {
    const file = e.target.files?.[0]
    if (!file || uploadingGroupPhoto) return
    setUploadingGroupPhoto(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('upload_preset', CLOUDINARY_PRESET)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!data.secure_url) throw new Error('Upload Cloudinary invalide')

      await setDoc(doc(db, 'appSettings', 'messages'), {
        groupPhotoURL: data.secure_url,
        groupPhotoUpdatedAt: new Date().toISOString(),
        groupPhotoUpdatedBy: user.uid,
      }, { merge: true })
      setGroupPhotoURL(data.secure_url)
    } catch (error) {
      console.warn('Photo de groupe non mise à jour', error)
    } finally {
      setUploadingGroupPhoto(false)
      e.target.value = ''
    }
  }

  async function createAnnouncement(e) {
    e.preventDefault()
    if (!canAccess || publishingAnnouncement) return
    const title = cleanField(announcementForm.title, MAX_ANNOUNCEMENT_TITLE)
    const details = cleanMessage(announcementForm.details).slice(0, MAX_ANNOUNCEMENT_DETAILS)
    const announcementDate = cleanField(announcementForm.announcementDate, 20)
    const announcementTime = cleanField(announcementForm.announcementTime, 10)
    const location = cleanField(announcementForm.location, 120)

    if (!title) {
      setAnnouncementError('Le titre de l’annonce est obligatoire.')
      return
    }
    if (!details) {
      setAnnouncementError('Les détails de l’annonce sont obligatoires.')
      return
    }

    setPublishingAnnouncement(true)
    setAnnouncementError('')
    try {
      const senderName = userData?.nom || currentStaff?.name || user?.displayName || user?.email || 'Staff'
      const senderRole = currentMember?.staffRole || currentStaff?.role || 'Staff'
      const senderPhoto = userData?.photoURL || currentStaff?.photoURL || user?.photoURL || null
      await addDoc(collection(db, 'staffMessages'), {
        type: 'announcement',
        title,
        details,
        announcementDate: announcementDate || null,
        announcementTime: announcementTime || null,
        location: location || null,
        senderId: user.uid,
        senderName,
        senderRole,
        senderPhoto,
        reactions: {},
        readBy: [user.uid],
        pinned: false,
        deleted: false,
        deletedAt: null,
        deletedBy: null,
        edited: false,
        editedAt: null,
        createdAt: new Date().toISOString(),
      })
      setAnnouncementForm({ title: '', details: '', announcementDate: '', announcementTime: '', location: '' })
      setShowAnnouncementForm(false)
    } catch (error) {
      console.warn('Annonce non publiée', error)
      setAnnouncementError('Impossible de publier l’annonce pour le moment.')
    } finally {
      setPublishingAnnouncement(false)
    }
  }

  async function toggleReaction(message, emoji) {
    if (!canAccess || message.deleted) return
    const ref = doc(db, 'staffMessages', message.id)
    if ((message.type || 'message') === 'announcement') {
      const next = { ...(message.reactions || {}) }
      const sameActive = (next[emoji] || []).includes(user.uid)
      Object.keys(next).forEach(key => {
        next[key] = (next[key] || []).filter(id => id !== user.uid)
        if (next[key].length === 0) delete next[key]
      })
      if (!sameActive) next[emoji] = [...(next[emoji] || []), user.uid]
      await updateDoc(ref, { reactions: next })
    } else {
      const current = message.reactions?.[emoji] || []
      await updateDoc(ref, {
        [`reactions.${emoji}`]: current.includes(user.uid) ? arrayRemove(user.uid) : arrayUnion(user.uid),
      })
    }
  }

  function startEdit(message) {
    setEditingId(message.id)
    if ((message.type || 'message') === 'announcement') {
      setEditText('')
      setEditAnnouncementForm({
        title: message.title || '',
        details: message.details || '',
        announcementDate: message.announcementDate || '',
        announcementTime: message.announcementTime || '',
        location: message.location || '',
      })
    } else {
      setEditText(message.text || '')
      setEditAnnouncementForm({ title: '', details: '', announcementDate: '', announcementTime: '', location: '' })
    }
  }

  async function copyMessage(message) {
    if (!message || message.deleted) return
    try {
      const text = (message.type || 'message') === 'announcement'
        ? `${message.title || ''}\n\n${message.details || ''}`.trim()
        : (message.text || '')
      await navigator.clipboard?.writeText(text)
    } catch {
      console.warn('Copie impossible')
    }
  }

  async function saveEdit(message) {
    if (message.senderId !== user.uid) return
    if ((message.type || 'message') === 'announcement') {
      const title = cleanField(editAnnouncementForm.title, MAX_ANNOUNCEMENT_TITLE)
      const details = cleanMessage(editAnnouncementForm.details).slice(0, MAX_ANNOUNCEMENT_DETAILS)
      const announcementDate = cleanField(editAnnouncementForm.announcementDate, 20)
      const announcementTime = cleanField(editAnnouncementForm.announcementTime, 10)
      const location = cleanField(editAnnouncementForm.location, 120)
      if (!title || !details) return
      await updateDoc(doc(db, 'staffMessages', message.id), {
        title,
        details,
        announcementDate: announcementDate || null,
        announcementTime: announcementTime || null,
        location: location || null,
        edited: true,
        editedAt: new Date().toISOString(),
      })
      setEditingId(null)
      setEditAnnouncementForm({ title: '', details: '', announcementDate: '', announcementTime: '', location: '' })
      return
    }
    if (Date.now() - toMillis(message.createdAt) > EDIT_WINDOW_MS) return
    const text = cleanMessage(editText)
    if (!text) return
    await updateDoc(doc(db, 'staffMessages', message.id), {
      text,
      edited: true,
      editedAt: new Date().toISOString(),
    })
    setEditingId(null)
    setEditText('')
  }

  async function softDelete(message) {
    if (!canDeleteMessage(message)) return
    await updateDoc(doc(db, 'staffMessages', message.id), {
      deleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy: user.uid,
      pinned: false,
    })
  }

  async function togglePin(message) {
    if (!canPinMessage(message)) return
    const batch = writeBatch(db)
    pinnedMessages.forEach(m => {
      if (m.id !== message.id) batch.update(doc(db, 'staffMessages', m.id), { pinned: false })
    })
    const nextPinned = !message.pinned
    batch.update(doc(db, 'staffMessages', message.id), {
      pinned: nextPinned,
      pinnedAt: nextPinned ? new Date().toISOString() : null,
      pinnedBy: nextPinned ? user.uid : null,
    })
    await batch.commit()
    await setDoc(doc(db, 'appSettings', 'messages'), {
      pinnedMessageId: nextPinned ? message.id : null,
      updatedAt: new Date().toISOString(),
    }, { merge: true })
  }

  function getUsersByIds(ids = []) {
    return ids
      .map(id => staffUsers.find(s => s.uid === id)?.name)
      .filter(Boolean)
      .join(', ')
  }

  function getFirstNamesByIds(ids = []) {
    return ids
      .map(id => staffUsers.find(s => s.uid === id)?.name)
      .filter(Boolean)
      .map(name => name.split(/\s+/)[0])
      .join(', ')
  }

  function renderMessageContent(text) {
    const tokens = [...staffUsers.map(s => s.mention), MENTION_EVERYONE.mention]
    if (!tokens.length) return renderLinkedText(text)
    const escaped = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const mentionRegex = new RegExp(`(${escaped.join('|')})`, 'gi')
    const mentionSet = new Set(tokens.map(t => t.toLowerCase()))
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi
    return String(text || '').split(mentionRegex).map((seg, i) => {
      if (mentionSet.has(seg.toLowerCase())) {
        return <strong key={i} className="staff-mention">{seg}</strong>
      }
      return seg.split(urlRegex).map((part, j) => {
        if (part.match(urlRegex)) {
          const href = part.startsWith('www.') ? `https://${part}` : part
          return <a key={`${i}-${j}`} href={href} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{part}</a>
        }
        return part
      })
    })
  }

  function renderReactionSummary(message) {
    const existingReactions = REACTIONS.filter(e => (message.reactions?.[e] || []).length > 0)
    if (existingReactions.length === 0 || message.deleted) return null
    return (
      <div className="staff-reactions-summary">
        {existingReactions.map(emoji => {
          const users = message.reactions[emoji]
          const active = users.includes(user.uid)
          return (
            <button
              key={emoji}
              type="button"
              className={active ? 'active' : ''}
              onClick={e => {
                e.stopPropagation()
                toggleReaction(message, emoji)
              }}
              title={getUsersByIds(users)}
            >
              <span>{emoji}</span>
              <strong>{users.length}</strong>
            </button>
          )
        })}
      </div>
    )
  }


  function renderAnnouncement(message, compact = false) {
    const existingReactions = REACTIONS.filter(e => (message.reactions?.[e] || []).length > 0)
    const readAvatars = !message.deleted && !compact
      ? (message.readBy || [])
        .filter(id => id !== message.senderId)
        .filter(id => latestReadMessageByUser[id] === message.id)
        .map(id => staffUsers.find(s => s.uid === id))
        .filter(Boolean)
        .slice(0, 3)
      : []

    return (
      <article key={message.id} className={`staff-announcement-row${compact ? ' pinned' : ''}${readAvatars.length > 0 ? ' has-read-avatars' : ''}${existingReactions.length > 0 ? ' has-reactions-row' : ''}`}>
        <div className="staff-announcement-avatar">
          {message.senderPhoto
            ? <img src={message.senderPhoto} alt="" />
            : <span>{(message.senderName || '?').charAt(0).toUpperCase()}</span>
          }
        </div>
        <div className="staff-announcement-content">
          <div className="staff-message-meta staff-announcement-meta">
            <span>{(message.senderName || 'Staff').split(/\s+/)[0]}</span>
            <small>{formatTime(message.createdAt)}</small>
          </div>
          <div
            className={`staff-announcement-card${message.pinned ? ' pinned' : ''}`}
            onPointerDown={e => startReactionPress(e, message, compact)}
            onPointerMove={moveReactionPress}
            onPointerUp={stopReactionPress}
            onPointerCancel={stopReactionPress}
            onPointerLeave={stopReactionPress}
            onContextMenu={e => e.preventDefault()}
          >
            {message.pinned && <div className="staff-announcement-pin"><Pin size={13} /> Épinglée</div>}
            {editingId === message.id ? (
              <div className="staff-announcement-edit" onPointerDown={e => e.stopPropagation()}>
                <input
                  value={editAnnouncementForm.title}
                  onChange={e => setEditAnnouncementForm(prev => ({ ...prev, title: e.target.value.slice(0, MAX_ANNOUNCEMENT_TITLE) }))}
                  maxLength={MAX_ANNOUNCEMENT_TITLE}
                  placeholder="Titre de l'annonce"
                />
                <textarea
                  value={editAnnouncementForm.details}
                  onChange={e => setEditAnnouncementForm(prev => ({ ...prev, details: e.target.value.slice(0, MAX_ANNOUNCEMENT_DETAILS) }))}
                  maxLength={MAX_ANNOUNCEMENT_DETAILS}
                  placeholder="Détails"
                  rows={4}
                />
                <div className="staff-announcement-edit-grid">
                  <input
                    type="date"
                    value={editAnnouncementForm.announcementDate}
                    onChange={e => setEditAnnouncementForm(prev => ({ ...prev, announcementDate: e.target.value }))}
                  />
                  <input
                    type="time"
                    value={editAnnouncementForm.announcementTime}
                    onChange={e => setEditAnnouncementForm(prev => ({ ...prev, announcementTime: e.target.value }))}
                  />
                </div>
                <input
                  value={editAnnouncementForm.location}
                  onChange={e => setEditAnnouncementForm(prev => ({ ...prev, location: e.target.value.slice(0, 120) }))}
                  maxLength={120}
                  placeholder="Lieu"
                />
                <div className="staff-message-edit-actions">
                  <button type="button" onClick={() => saveEdit(message)}><Check size={14} /> Enregistrer</button>
                  <button type="button" onClick={() => setEditingId(null)}><X size={14} /> Annuler</button>
                </div>
              </div>
            ) : (
              <>
                <div className="staff-announcement-label"><Megaphone size={15} /> Annonce</div>
                <h2>{message.title || 'Annonce'}</h2>
                <p className="staff-announcement-details">{renderLinkedText(message.details)}</p>

                {(message.announcementDate || message.announcementTime || message.location) && (
                  <div className="staff-announcement-info">
                    {message.announcementDate && <span><Calendar size={14} /> {formatAnnouncementDate(message.announcementDate)}</span>}
                    {message.announcementTime && <span><Clock size={14} /> {message.announcementTime}</span>}
                    {message.location && <span><MapPin size={14} /> {message.location}</span>}
                  </div>
                )}
              </>
            )}
          </div>
          {renderReactionSummary(message)}
        </div>

        {readAvatars.length > 0 && (
          <div className="staff-read-row">
            {detailsId === message.id && (
              <span className="staff-read-details">
                Vu par {getFirstNamesByIds((message.readBy || []).filter(id => id !== message.senderId)) || 'personne'}
              </span>
            )}
            <button type="button" className="staff-read-avatars" onClick={e => { e.stopPropagation(); setDetailsId(detailsId === message.id ? null : message.id) }}>
              {readAvatars.map(staff => (
                <span key={staff.uid}>{staff.photoURL ? <img src={staff.photoURL} alt="" /> : staff.name.charAt(0).toUpperCase()}</span>
              ))}
            </button>
          </div>
        )}
      </article>
    )
  }

  function renderPresenceReport(message, compact = false) {
    const readAvatars = !message.deleted && !compact
      ? (message.readBy || [])
          .filter(id => id !== message.senderId)
          .filter(id => latestReadMessageByUser[id] === message.id)
          .map(id => staffUsers.find(s => s.uid === id))
          .filter(Boolean)
          .slice(0, 3)
      : []
    const existingReactions = REACTIONS.filter(e => (message.reactions?.[e] || []).length > 0)

    return (
      <article key={message.id} className={`staff-announcement-row${compact ? ' pinned' : ''}${readAvatars.length > 0 ? ' has-read-avatars' : ''}${existingReactions.length > 0 ? ' has-reactions-row' : ''}`}>
        <div className="staff-announcement-avatar">
          {message.senderPhoto
            ? <img src={message.senderPhoto} alt="" />
            : <span>{(message.senderName || '?').charAt(0).toUpperCase()}</span>
          }
        </div>
        <div className="staff-announcement-content">
          <div className="staff-message-meta staff-announcement-meta">
            <span>{(message.senderName || 'Staff').split(/\s+/)[0]}</span>
            <small>{formatTime(message.createdAt)}</small>
            {message.edited && <small>modifié</small>}
          </div>
          <div
            className="staff-announcement-card"
            onPointerDown={e => startReactionPress(e, message, compact)}
            onPointerMove={moveReactionPress}
            onPointerUp={stopReactionPress}
            onPointerCancel={stopReactionPress}
            onPointerLeave={stopReactionPress}
            onContextMenu={e => e.preventDefault()}
          >
            <div className="staff-announcement-label" style={{ color: '#7c3aed' }}>
              <CalendarCheck size={15} /> Rapport de présence
            </div>
            <h2>{message.eventTitle || 'Rapport'}</h2>

            <div className="staff-announcement-info">
              <span><Calendar size={14} /> {formatAnnouncementDate(message.eventDate)}</span>
              {message.eventTags?.length > 0 && (
                <span><Users size={14} /> {message.groupLabel || message.eventTags.join(', ')}</span>
              )}
              <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
                👥 Total : {message.totalCount} personne{message.totalCount !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="staff-presence-report-box presents">
              <div className="staff-presence-report-box-header">
                ✅ Présents : {message.presentCount}
              </div>
              {message.presents?.length > 0 && (
                <div className="staff-presence-report-names">
                  {message.presents.map(p => p.displayName).join(', ')}
                </div>
              )}
            </div>

            <div className="staff-presence-report-box absents">
              <div className="staff-presence-report-box-header">
                ❌ Absents : {(message.totalCount || 0) - (message.presentCount || 0)}
              </div>
              {message.absents?.length > 0 && (
                <div className="staff-presence-report-names">
                  {message.absents.map(p => p.displayName).join(', ')}
                </div>
              )}
            </div>

            <div className="staff-presence-report-rate">
              Taux de présence : <strong>{message.presencePercent ?? 0} %</strong>
            </div>
          </div>
          {renderReactionSummary(message)}
        </div>

        {readAvatars.length > 0 && (
          <div className="staff-read-row">
            {detailsId === message.id && (
              <span className="staff-read-details">
                Vu par {getFirstNamesByIds((message.readBy || []).filter(id => id !== message.senderId)) || 'personne'}
              </span>
            )}
            <button type="button" className="staff-read-avatars" onClick={e => { e.stopPropagation(); setDetailsId(detailsId === message.id ? null : message.id) }}>
              {readAvatars.map(staff => (
                <span key={staff.uid}>{staff.photoURL ? <img src={staff.photoURL} alt="" /> : staff.name.charAt(0).toUpperCase()}</span>
              ))}
            </button>
          </div>
        )}
      </article>
    )
  }

  function renderMessage(message, compact = false) {
    if ((message.type || 'message') === 'announcement') return renderAnnouncement(message, compact)
    if ((message.type || 'message') === 'presence_report') return renderPresenceReport(message, compact)
    const mine = message.senderId === user?.uid
    const existingReactions = REACTIONS.filter(e => (message.reactions?.[e] || []).length > 0)
    const multiline = String(message.text || '').includes('\n')
    const readAvatars = !message.deleted && !compact
      ? (message.readBy || [])
        .filter(id => id !== message.senderId)
        .filter(id => latestReadMessageByUser[id] === message.id)
        .map(id => staffUsers.find(s => s.uid === id))
        .filter(Boolean)
        .slice(0, 3)
      : []

    return (
      <div key={message.id} className={`staff-message-row${mine ? ' mine' : ''}${compact ? ' pinned' : ''}${readAvatars.length > 0 ? ' has-read-avatars' : ''}${existingReactions.length > 0 ? ' has-reactions-row' : ''}`}>
        {!mine && (
          <div className="staff-message-avatar">
            {message.senderPhoto
              ? <img src={message.senderPhoto} alt="" />
              : <span>{(message.senderName || '?').charAt(0).toUpperCase()}</span>
            }
          </div>
        )}
        <div className="staff-message-bubble-wrap">
          <div className="staff-message-meta">
            <span>{(message.senderName || 'Staff').split(/\s+/)[0]}</span>
            <small>{formatTime(message.createdAt)}</small>
            {message.edited && <small>modifié</small>}
          </div>

          <div className="staff-message-bubble-shell">
            <div
              className={`staff-message-bubble${mine ? ' mine' : ''}${existingReactions.length > 0 ? ' has-reactions' : ''}${multiline ? ' multiline' : ''}`}
              onPointerDown={e => startReactionPress(e, message, compact)}
              onPointerMove={moveReactionPress}
              onPointerUp={stopReactionPress}
              onPointerCancel={stopReactionPress}
              onPointerLeave={stopReactionPress}
              onContextMenu={e => e.preventDefault()}
            >
              {editingId === message.id ? (
                <div className="staff-message-edit">
                  <textarea value={editText} onChange={e => setEditText(e.target.value.slice(0, MAX_MESSAGE_LENGTH))} maxLength={MAX_MESSAGE_LENGTH} />
                  <div className="staff-message-edit-actions">
                    <button type="button" onClick={() => saveEdit(message)}><Check size={14} /> Enregistrer</button>
                    <button type="button" onClick={() => setEditingId(null)}><X size={14} /> Annuler</button>
                  </div>
                </div>
              ) : (
                <p>{renderMessageContent(message.text)}</p>
              )}
            </div>

            {renderReactionSummary(message)}
          </div>
        </div>

        {readAvatars.length > 0 && (
          <div className="staff-read-row">
            {detailsId === message.id && (
              <span className="staff-read-details">
                Vu par {getFirstNamesByIds((message.readBy || []).filter(id => id !== message.senderId)) || 'personne'}
              </span>
            )}
            <button type="button" className="staff-read-avatars" onClick={e => { e.stopPropagation(); setDetailsId(detailsId === message.id ? null : message.id) }}>
              {readAvatars.map(staff => (
                <span key={staff.uid}>{staff.photoURL ? <img src={staff.photoURL} alt="" /> : staff.name.charAt(0).toUpperCase()}</span>
              ))}
            </button>
          </div>
        )}
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="page-container-locked sin" style={{ background: C.bg }}>
        <div className="textured-page-header" style={{ '--header-color': '#10b981', padding: '20px', paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
          <div className="header-title" style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: C.t1 }}>Messages Staff</div>
        </div>
        <div className="page-content">
          <div className="staff-empty-state">Cette page est réservée aux Staffs approuvés.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="staff-messages-page sin" style={{ background: C.bg }}>
      <header className="staff-messages-header textured-page-header" style={{ '--header-color': '#10b981', padding: '20px 20px 14px', paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="staff-header-avatar"
              onClick={() => groupPhotoInputRef.current?.click()}
              aria-label="Changer la photo du groupe"
              title="Changer la photo du groupe"
            >
              {uploadingGroupPhoto ? (
                <MoreHorizontal size={18} />
              ) : groupPhotoURL ? (
                <img src={groupPhotoURL} alt="" />
              ) : (
                <StaffHeaderIcon size={18} />
              )}
            </button>
            <input
              ref={groupPhotoInputRef}
              type="file"
              accept="image/*"
              onChange={updateGroupPhoto}
              style={{ display: 'none' }}
            />
            <div>
              <div className="header-title" style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>Messages Staff</div>
              <div className="header-subtitle" style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 2 }}>{staffUsers.length} membre{staffUsers.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="staff-header-icon"
              onClick={() => setShowAnnouncementForm(true)}
              aria-label="Créer une annonce"
              style={{ color: '#10b981' }}
            >
              <Megaphone size={19} />
            </button>
            <button
              type="button"
              className={`staff-header-icon${showSearch ? ' active' : ''}`}
              onClick={() => setShowSearch(v => !v)}
              aria-label="Rechercher un message"
            >
              <Search size={19} />
            </button>
          </div>
        </div>
      </header>

      {(showSearch || search) && (
        <div className="staff-message-search" onClick={e => e.stopPropagation()}>
          <Search size={15} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un message..." autoFocus />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Effacer la recherche">
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {pinnedMessage && (
        <section className="staff-pinned-card">
          <div className="staff-pinned-label"><Pin size={13} /> Message épinglé</div>
          {renderMessage(pinnedMessage, true)}
        </section>
      )}

      <main className="staff-message-list" ref={listRef} onClick={() => {
        if (longPressTriggered.current) { longPressTriggered.current = false; return }
        closeContextMenu()
        if (showSearch || search) {
          setShowSearch(false)
          setSearch('')
        }
      }}>
        {messages.length >= messageLimit && (
          <button type="button" className="staff-load-more" onClick={() => setMessageLimit(v => v + PAGE_SIZE)}>
            Voir plus
          </button>
        )}
        {loading ? (
          <div className="staff-empty-state">Chargement...</div>
        ) : filteredMessages.length === 0 ? (
          <div className="staff-empty-state">{search ? 'Aucun résultat.' : 'Aucun message pour le moment.'}</div>
        ) : (
          filteredMessages.map(message => renderMessage(message))
        )}
      </main>

      {contextMsg && !contextMsg.deleted && (
        <div className="staff-context-overlay" onClick={() => {
          if (longPressTriggered.current) { longPressTriggered.current = false; return }
          closeContextMenu()
        }}>
          {contextPos && (
            <div
              className="staff-reaction-picker"
              style={{
                position: 'fixed',
                top: Math.max(8, contextPos.top - 58),
                left: contextMsg.senderId !== user?.uid ? contextPos.left : 'auto',
                right: contextMsg.senderId === user?.uid ? (window.innerWidth - contextPos.right) : 'auto',
              }}
              onClick={e => e.stopPropagation()}
            >
              {REACTIONS.map(emoji => {
                const active = (contextMsg.reactions?.[emoji] || []).includes(user.uid)
                return (
                  <button key={emoji} type="button" className={active ? 'active' : ''}
                    onClick={() => { toggleReaction(contextMsg, emoji); closeContextMenu() }}>
                    {emoji}
                  </button>
                )
              })}
            </div>
          )}
          <div className="staff-context-panel" onClick={e => e.stopPropagation()}>
            <div className="staff-context-actions">
              <button type="button" onClick={() => { copyMessage(contextMsg); closeContextMenu() }}>
                <Copy size={15} /><span>Copier</span>
              </button>
              {canEditMessage(contextMsg) && (
                <button type="button" onClick={() => { startEdit(contextMsg); closeContextMenu() }}>
                  <Edit3 size={15} /><span>Modifier</span>
                </button>
              )}
              {canDeleteMessage(contextMsg) && (
                <button type="button" className="danger" onClick={() => { softDelete(contextMsg); closeContextMenu() }}>
                  <Trash2 size={15} /><span>Supprimer</span>
                </button>
              )}
              {canPinMessage(contextMsg) && (
                <button type="button" onClick={() => { togglePin(contextMsg); closeContextMenu() }}>
                  <Pin size={15} /><span>{contextMsg.pinned ? 'Désépingler' : 'Épingler'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showAnnouncementForm && (
        <div className="staff-announcement-modal" onClick={() => !publishingAnnouncement && setShowAnnouncementForm(false)}>
          <form className="staff-announcement-sheet" onClick={e => e.stopPropagation()} onSubmit={createAnnouncement}>
            <div className="staff-announcement-sheet-head">
              <div>
                <span><Megaphone size={15} /> Nouvelle annonce</span>
                <h2>Publier dans Messages Staff</h2>
              </div>
              <button type="button" onClick={() => !publishingAnnouncement && setShowAnnouncementForm(false)} aria-label="Fermer">
                <X size={18} />
              </button>
            </div>

            {announcementError && <div className="staff-announcement-error">{announcementError}</div>}

            <label className="staff-announcement-field">
              <span>Titre de l’annonce</span>
              <input
                value={announcementForm.title}
                onChange={e => setAnnouncementForm(prev => ({ ...prev, title: e.target.value.slice(0, MAX_ANNOUNCEMENT_TITLE) }))}
                maxLength={MAX_ANNOUNCEMENT_TITLE}
                placeholder="Réunion générale"
              />
              <small>{announcementForm.title.length}/{MAX_ANNOUNCEMENT_TITLE}</small>
            </label>

            <label className="staff-announcement-field">
              <span>Détails / description</span>
              <textarea
                value={announcementForm.details}
                onChange={e => setAnnouncementForm(prev => ({ ...prev, details: e.target.value.slice(0, MAX_ANNOUNCEMENT_DETAILS) }))}
                maxLength={MAX_ANNOUNCEMENT_DETAILS}
                placeholder="Tous les responsables sont invités..."
                rows={5}
              />
              <small>{announcementForm.details.length}/{MAX_ANNOUNCEMENT_DETAILS}</small>
            </label>

            <div className="staff-announcement-grid">
              <label className="staff-announcement-field">
                <span>Date</span>
                <input
                  type="date"
                  value={announcementForm.announcementDate}
                  onChange={e => setAnnouncementForm(prev => ({ ...prev, announcementDate: e.target.value }))}
                />
              </label>
              <label className="staff-announcement-field">
                <span>Heure</span>
                <input
                  type="time"
                  value={announcementForm.announcementTime}
                  onChange={e => setAnnouncementForm(prev => ({ ...prev, announcementTime: e.target.value }))}
                />
              </label>
            </div>

            <label className="staff-announcement-field">
              <span>Lieu</span>
              <input
                value={announcementForm.location}
                onChange={e => setAnnouncementForm(prev => ({ ...prev, location: e.target.value.slice(0, 120) }))}
                maxLength={120}
                placeholder="Salle principale"
              />
            </label>

            <div className="staff-announcement-form-actions">
              <button type="button" onClick={() => !publishingAnnouncement && setShowAnnouncementForm(false)}>Annuler</button>
              <button type="submit" disabled={publishingAnnouncement || !cleanField(announcementForm.title, MAX_ANNOUNCEMENT_TITLE) || !cleanMessage(announcementForm.details)}>
                {publishingAnnouncement ? <MoreHorizontal size={18} /> : <><Megaphone size={16} /> Publier l’annonce</>}
              </button>
            </div>
          </form>
        </div>
      )}

      <form className="staff-message-composer" ref={composerRef} onClick={e => e.stopPropagation()} onSubmit={sendMessage}>
        {mentionSuggestions.length > 0 && (
          <div className="staff-mention-menu">
            {mentionSuggestions.map(staff => (
              <button key={staff.uid} type="button" onClick={() => insertMention(staff)}>
                <span>{staff.name.charAt(0).toUpperCase()}</span>
                <div>
                  <strong>{staff.name}</strong>
                  <small>{staff.role}</small>
                </div>
              </button>
            ))}
          </div>
        )}
        <div className="staff-composer-row">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => handleInputChange(e.target.value)}
            placeholder="Message"
            maxLength={MAX_MESSAGE_LENGTH}
            rows={1}
          />
          <button type="submit" disabled={sending || !cleanMessage(input)}>
            {sending ? <MoreHorizontal size={18} /> : <Send size={18} />}
          </button>
        </div>
      </form>
    </div>
  )
}
