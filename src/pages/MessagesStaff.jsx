import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { ArrowLeft, Check, Edit3, MessageCircle, MoreHorizontal, Pin, Search, Send, Trash2, X } from 'lucide-react'
import { db } from '../firebase'
import { ADMIN_EMAIL } from '../constants'
import { createNotification } from '../notifications'
import { canModerateStaffMessagesRole, sameEmail } from '../utils/access'
import { useTheme } from '../context/ThemeContext'

const INITIAL_LIMIT = 30
const PAGE_SIZE = 30
const MAX_MESSAGE_LENGTH = 1000
const MAX_MENTIONS = 10
const EDIT_WINDOW_MS = 15 * 60 * 1000
const REACTIONS = ['👍', '❤️', '🙏', '✅', '😂', '👀']

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function toMillis(iso) {
  const time = new Date(iso || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

function cleanMessage(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_MESSAGE_LENGTH)
}

function getDisplayName(userDoc) {
  return userDoc?.nom || userDoc?.displayName || userDoc?.prenom || userDoc?.email?.split('@')[0] || 'Staff'
}

function getMentionToken(name) {
  return '@' + String(name || 'Staff').trim().split(/\s+/)[0]
}

export default function MessagesStaff({ user, userData }) {
  const navigate = useNavigate()
  const { C } = useTheme()
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const longPressTimer = useRef(null)
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
  const [detailsId, setDetailsId] = useState(null)
  const [reactionPickerId, setReactionPickerId] = useState(null)
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0, mine: false })
  const [showSearch, setShowSearch] = useState(false)

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
  const canAccess = Boolean(user?.uid && userData?.approuve !== false)

  const pinnedMessage = pinnedMessages.find(m => !m.deleted) || null

  const filteredMessages = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return messages
    return messages.filter(m =>
      String(m.text || '').toLowerCase().includes(term) ||
      String(m.senderName || '').toLowerCase().includes(term)
    )
  }, [messages, search])

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return staffUsers
      .filter(s => s.uid !== user?.uid)
      .filter(s => !mentions.some(m => m.uid === s.uid))
      .filter(s => s.name.toLowerCase().includes(q) || s.mention.toLowerCase().includes('@' + q))
      .slice(0, 6)
  }, [mentionQuery, staffUsers, mentions, user?.uid])

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
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 108)}px`
  }, [input])

  useEffect(() => {
    return () => clearTimeout(longPressTimer.current)
  }, [])

  function showReactionPicker(rect, message, mine) {
    setPickerPos({
      top: Math.max(8, rect.top - 54),
      left: mine ? 'auto' : rect.left,
      right: mine ? window.innerWidth - rect.right : 'auto',
      mine,
    })
    setReactionPickerId(message.id)
  }

  function startReactionPress(e, message, mine, compact) {
    clearTimeout(longPressTimer.current)
    if (message.deleted || compact) return
    const rect = e.currentTarget.getBoundingClientRect()
    longPressTimer.current = setTimeout(() => showReactionPicker(rect, message, mine), 430)
  }

  function stopReactionPress() {
    clearTimeout(longPressTimer.current)
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

    setSending(true)
    try {
      const senderName = userData?.nom || currentStaff?.name || user?.displayName || user?.email || 'Staff'
      const senderRole = currentMember?.staffRole || currentStaff?.role || 'Staff'
      const senderPhoto = userData?.photoURL || currentStaff?.photoURL || user?.photoURL || null
      await addDoc(collection(db, 'staffMessages'), {
        text,
        senderId: user.uid,
        senderName,
        senderRole,
        senderPhoto,
        mentions: validMentions.map(m => m.uid),
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

      await Promise.all(validMentions.map(m => createNotification({
        type: 'message',
        titre: `${senderName} vous a mentionné dans Messages Staff.`,
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

  async function toggleReaction(message, emoji) {
    if (!canAccess || message.deleted) return
    const current = message.reactions?.[emoji] || []
    const ref = doc(db, 'staffMessages', message.id)
    await updateDoc(ref, {
      [`reactions.${emoji}`]: current.includes(user.uid) ? arrayRemove(user.uid) : arrayUnion(user.uid),
    })
    setReactionPickerId(null)
  }

  function startEdit(message) {
    setEditingId(message.id)
    setEditText(message.text || '')
  }

  async function saveEdit(message) {
    if (message.senderId !== user.uid) return
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
    const ownsMessage = message.senderId === user.uid
    if (!ownsMessage && !canModerate) return
    await updateDoc(doc(db, 'staffMessages', message.id), {
      deleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy: user.uid,
      pinned: false,
    })
  }

  async function togglePin(message) {
    if (!canModerate || message.deleted) return
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

  function renderMessage(message, compact = false) {
    const mine = message.senderId === user?.uid
    const canEdit = mine && !message.deleted && Date.now() - toMillis(message.createdAt) <= EDIT_WINDOW_MS
    const canDelete = !message.deleted && (mine || canModerate)
    const readCount = (message.readBy || []).length
    const pickerOpen = reactionPickerId === message.id
    const existingReactions = REACTIONS.filter(e => (message.reactions?.[e] || []).length > 0)

    return (
      <div key={message.id} className={`staff-message-row${mine ? ' mine' : ''}${compact ? ' pinned' : ''}`}>
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
            <span>{message.senderName || 'Staff'}</span>
            <small>{formatTime(message.createdAt)}</small>
            {message.edited && <small>modifié</small>}
          </div>

          <div className="staff-message-bubble-shell">
            <div
              className={`staff-message-bubble${mine ? ' mine' : ''}${existingReactions.length > 0 ? ' has-reactions' : ''}`}
              onClick={() => {
                if (pickerOpen) setReactionPickerId(null)
              }}
              onPointerDown={e => startReactionPress(e, message, mine, compact)}
              onPointerUp={stopReactionPress}
              onPointerCancel={stopReactionPress}
              onPointerLeave={stopReactionPress}
              onContextMenu={e => {
                e.preventDefault()
                if (message.deleted || compact) return
                showReactionPicker(e.currentTarget.getBoundingClientRect(), message, mine)
              }}
              style={{ cursor: message.deleted || compact ? 'default' : 'pointer' }}
            >
              {message.deleted ? (
                <span className="staff-message-deleted">Message supprimé</span>
              ) : editingId === message.id ? (
                <div className="staff-message-edit">
                  <textarea value={editText} onChange={e => setEditText(e.target.value.slice(0, MAX_MESSAGE_LENGTH))} maxLength={MAX_MESSAGE_LENGTH} />
                  <div className="staff-message-edit-actions">
                    <button type="button" onClick={() => saveEdit(message)}><Check size={14} /> Enregistrer</button>
                    <button type="button" onClick={() => setEditingId(null)}><X size={14} /> Annuler</button>
                  </div>
                </div>
              ) : (
                <p>{message.text}</p>
              )}
            </div>

            {existingReactions.length > 0 && !message.deleted && (
              <div className="staff-reactions-summary">
                {existingReactions.map(emoji => {
                  const users = message.reactions[emoji]
                  const active = users.includes(user.uid)
                  return (
                    <button
                      key={emoji}
                      type="button"
                      className={active ? 'active' : ''}
                      onClick={() => toggleReaction(message, emoji)}
                      title={getUsersByIds(users)}
                    >
                      <span>{emoji}</span>
                      <strong>{users.length}</strong>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {!message.deleted && (
            <div className="staff-message-tools">
              {canEdit && <button type="button" onClick={() => startEdit(message)} title="Modifier"><Edit3 size={14} /></button>}
              {canDelete && <button type="button" onClick={() => softDelete(message)} title="Supprimer"><Trash2 size={14} /></button>}
              {canModerate && <button type="button" onClick={() => togglePin(message)} title={message.pinned ? 'Désépingler' : 'Épingler'}><Pin size={14} /></button>}
            </div>
          )}

          <button type="button" className="staff-read-indicator" onClick={() => setDetailsId(detailsId === message.id ? null : message.id)}>
            {readCount > 1 ? `Vu par ${readCount}` : 'Lu'}
          </button>
          {detailsId === message.id && (
            <div className="staff-read-details">
              {getUsersByIds(message.readBy) || 'Aucun lecteur'}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="page-container-locked sin" style={{ background: C.bg }}>
        <div className="textured-page-header" style={{ '--header-color': '#10b981', padding: '20px', paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
          <div className="header-title" style={{ fontSize: 22, fontWeight: 700, color: C.t1 }}>Messages Staff</div>
        </div>
        <div className="page-content">
          <div className="staff-empty-state">Cette page est réservée aux Staffs approuvés.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="staff-messages-page sin" style={{ background: C.bg }}>
      <header className="staff-messages-header">
        <button type="button" onClick={() => navigate('/')} className="staff-header-back" aria-label="Retour">
          <ArrowLeft size={19} />
        </button>
        <div className="staff-header-avatar">
          <MessageCircle size={18} />
        </div>
        <div className="staff-header-title">
          <h1>Messages Staff</h1>
          <p>Discussion interne entre les Staffs de YFC</p>
        </div>
        <button
          type="button"
          className={`staff-header-icon${showSearch ? ' active' : ''}`}
          onClick={() => setShowSearch(v => !v)}
          aria-label="Rechercher un message"
        >
          <Search size={19} />
        </button>
      </header>

      {(showSearch || search) && (
        <div className="staff-message-search">
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

      <main className="staff-message-list" ref={listRef} onClick={e => { if (!e.target.closest('.staff-message-bubble, .staff-reaction-picker')) setReactionPickerId(null) }} onScroll={() => setReactionPickerId(null)}>
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

      {reactionPickerId && (() => {
        const msg = messages.find(m => m.id === reactionPickerId)
        if (!msg) return null
        return (
          <div
            className="staff-reaction-picker"
            style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.mine ? 'auto' : pickerPos.left, right: pickerPos.mine ? pickerPos.right : 'auto' }}
          >
            {REACTIONS.map(emoji => {
              const active = (msg.reactions?.[emoji] || []).includes(user.uid)
              return (
                <button key={emoji} type="button" className={active ? 'active' : ''} onClick={() => toggleReaction(msg, emoji)}>
                  {emoji}
                </button>
              )
            })}
          </div>
        )
      })()}

      <form className="staff-message-composer" onSubmit={sendMessage}>
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
          <div className="staff-composer-box">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => handleInputChange(e.target.value)}
              placeholder="Message"
              maxLength={MAX_MESSAGE_LENGTH}
              rows={1}
            />
            <span className="staff-composer-count">{input.length}/{MAX_MESSAGE_LENGTH}</span>
          </div>
          <button className="staff-composer-send" type="submit" disabled={sending || !cleanMessage(input)}>
            {sending ? <MoreHorizontal size={18} /> : <Send size={18} />}
          </button>
        </div>
      </form>
    </div>
  )
}
