import { useMemo, useRef, useState, useEffect } from 'react'
import { ArrowLeft, Send, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { generateFampaherezana } from '../services/fampaherezana'
import { useTheme } from '../context/ThemeContext'

const WELCOME = 'Salama 😊 Inona ny fampaherezana ilainao androany? Ohatra: tahotra, hakiviana, adin-tsaina, fahakiviana, finoana malemy, aretina, olana ara-pianakaviana, na fanantenana.'
const STORAGE_PREFIX = 'yfc_fampaherezana_chat_'

function todayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function storageKey(uid) {
  return `${STORAGE_PREFIX}${uid || 'anonymous'}_${todayKey()}`
}

function loadSavedChat(uid) {
  try {
    const raw = localStorage.getItem(storageKey(uid))
    if (!raw) return null
    const saved = JSON.parse(raw)
    if (!Array.isArray(saved.messages) || saved.messages.length === 0) return null
    return saved
  } catch {
    return null
  }
}

function saveChat(uid, messages, remaining) {
  try {
    const key = storageKey(uid)
    Object.keys(localStorage)
      .filter(k => k.startsWith(STORAGE_PREFIX) && k !== key)
      .forEach(k => localStorage.removeItem(k))
    localStorage.setItem(key, JSON.stringify({ messages, remaining }))
  } catch {}
}

export default function Fampaherezana({ user }) {
  const navigate = useNavigate()
  const { C } = useTheme()
  const [messages, setMessages] = useState(() => loadSavedChat(user?.uid)?.messages || [{ role: 'assistant', text: WELCOME }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [remaining, setRemaining] = useState(() => loadSavedChat(user?.uid)?.remaining ?? null)
  const listRef = useRef(null)

  const quotaLabel = useMemo(() => {
    if (remaining === null) return '10 isan\'andro'
    return `${remaining}/10 sisa androany`
  }, [remaining])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    saveChat(user?.uid, messages, remaining)
  }, [messages, remaining, user?.uid])

  async function handleSubmit(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', text }])

    const result = await generateFampaherezana(text)
    if (result.remaining !== null) setRemaining(result.remaining)
    setMessages(prev => [...prev, {
      role: 'assistant',
      text: result.text,
      quota: result.quota || false,
    }])
    setLoading(false)
  }

  return (
    <div className="famp-page" style={{ background: C.bg }}>
      <header className="famp-header">
        <button className="famp-back" onClick={() => navigate('/')} aria-label="Retour">
          <ArrowLeft size={20} />
        </button>
        <div className="famp-title-wrap">
          <div className="famp-kicker">YFC App</div>
          <h1>Fampaherezana</h1>
        </div>
        <div className="famp-quota">{quotaLabel}</div>
      </header>

      <main className="famp-chat" ref={listRef}>
        {messages.map((message, index) => (
          <div key={index} className={`famp-message-row ${message.role}`}>
            {message.role === 'assistant' && (
              <div className="famp-avatar">
                <Sparkles size={16} />
              </div>
            )}
            <div className={`famp-bubble ${message.role}${message.quota ? ' quota' : ''}`}>
              {message.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="famp-message-row assistant">
            <div className="famp-avatar">
              <Sparkles size={16} />
            </div>
            <div className="famp-bubble assistant typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </main>

      <form className="famp-input-bar" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Soraty eto..."
          maxLength={800}
        />
        <button type="submit" disabled={loading || !input.trim()} aria-label="Envoyer">
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
