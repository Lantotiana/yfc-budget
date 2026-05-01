import { useMemo, useRef, useState, useEffect } from 'react'
import { ArrowLeft, Send, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { addDoc, collection, doc, getDoc, updateDoc } from 'firebase/firestore'
import { auth } from '../auth'
import { db } from '../firebase'
import { createNotification } from '../notifications'
import { generateAppAssistant } from '../services/fampaherezana'
import { useTheme } from '../context/ThemeContext'

const WELCOME = 'Bonjour 😊 Que souhaitez-vous faire dans l’application ? (voir les données, ajouter un événement, enregistrer une dépense, etc.)\n\nSalama 😊 Inona no tianao hatao ato amin’ny application ? (hijery données, hanampy événement, hanoratra dépense, sns.)'
const STORAGE_PREFIX = 'yfc_app_assistant_chat_'

const ACTION_LABELS = {
  create_member: 'Créer un membre',
  update_member: 'Modifier un membre',
  create_event: 'Créer un événement',
  update_event: 'Modifier un événement',
  create_expense: 'Créer une dépense',
  create_contribution: 'Créer une cotisation / entrée',
  send_message: 'Préparer un message',
}

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

function saveChat(uid, messages) {
  try {
    const key = storageKey(uid)
    Object.keys(localStorage)
      .filter(k => k.startsWith(STORAGE_PREFIX) && k !== key)
      .forEach(k => localStorage.removeItem(k))
    localStorage.setItem(key, JSON.stringify({ messages }))
  } catch {}
}

function formatActionValue(value) {
  if (value === null || value === undefined || value === '') return 'À préciser'
  if (typeof value === 'number') return value.toLocaleString('fr-FR')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function normalizeDate(value) {
  return value || new Date().toISOString().slice(0, 10)
}

function getActionTitle(data = {}) {
  return data.motif || data.title || data.titre || data.nom || data.name || data.subject || ''
}

function getActionAmount(data = {}) {
  return Number(data.montant ?? data.amount ?? 0)
}

async function getCreatedBy() {
  const user = auth.currentUser
  if (!user) return null

  let nom = user.displayName || user.email || 'Utilisateur'
  let photoURL = user.photoURL || null
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid))
    if (userDoc.exists()) {
      const data = userDoc.data()
      nom = data.nom || data.displayName || data.prenom || nom
      photoURL = data.photoURL || photoURL
    }
  } catch {}

  return {
    uid: user.uid,
    nom,
    email: user.email,
    photoURL,
  }
}

async function executeAssistantAction(action) {
  const data = action?.data || {}

  if (action.action === 'create_member') {
    const nom = data.nom || data.name
    if (!nom) throw new Error('Le nom du membre est manquant.')

    await addDoc(collection(db, 'membres'), {
      nom: String(nom).trim(),
      prenoms: String(data.prenoms || data.firstname || '').trim(),
      nomPrefere: String(data.nomPrefere || '').trim(),
      adresse: String(data.adresse || data.address || '').trim(),
      telephone: String(data.telephone || data.phone || '').trim(),
      email: String(data.email || '').trim(),
      tailleTshirt: data.tailleTshirt || '',
      dateAjout: new Date().toISOString().slice(0, 10),
    })
    await createNotification({
      type: 'membre',
      titre: 'Nouveau membre ajouté',
      detail: String(nom).trim(),
      cible: String(nom).trim(),
      route: '/membres',
    })
    return 'Membre ajouté avec succès.'
  }

  if (action.action === 'update_member') {
    const id = data.id || data.memberId || data.membreId
    if (!id) throw new Error('L’identifiant du membre est manquant.')
    const patch = {}
    ;['nom', 'prenoms', 'nomPrefere', 'adresse', 'telephone', 'email', 'tailleTshirt'].forEach(key => {
      if (data[key] !== undefined) patch[key] = data[key]
    })
    if (Object.keys(patch).length === 0) throw new Error('Aucune modification détectée.')
    await updateDoc(doc(db, 'membres', id), patch)
    await createNotification({
      type: 'membre',
      titre: 'Membre modifié',
      detail: patch.nom || id,
      cible: patch.nom || id,
      route: '/membres',
    })
    return 'Membre modifié avec succès.'
  }

  if (action.action === 'create_event') {
    const nom = data.nom || data.title || data.titre
    if (!nom) throw new Error('Le titre de l’événement est manquant.')
    const dateDebut = normalizeDate(data.dateDebut || data.date || data.startDate)

    await addDoc(collection(db, 'evenements_agenda'), {
      nom: String(nom).trim(),
      dateDebut,
      dateFin: data.dateFin || data.endDate || dateDebut,
      heureDebut: data.heureDebut || data.startTime || '',
      heureFin: data.heureFin || data.endTime || '',
      lieu: String(data.lieu || data.location || '').trim(),
      description: String(data.description || '').trim(),
    })
    await createNotification({
      type: 'evenement',
      titre: 'Nouvel événement créé',
      detail: `${nom} - ${dateDebut}`,
      cible: String(nom),
      route: '/evenements',
    })
    return 'Événement créé avec succès.'
  }

  if (action.action === 'update_event') {
    const id = data.id || data.eventId || data.evenementId
    if (!id) throw new Error('L’identifiant de l’événement est manquant.')
    const patch = {}
    ;['nom', 'dateDebut', 'dateFin', 'heureDebut', 'heureFin', 'lieu', 'description'].forEach(key => {
      if (data[key] !== undefined) patch[key] = data[key]
    })
    if (data.title && !patch.nom) patch.nom = data.title
    if (data.titre && !patch.nom) patch.nom = data.titre
    if (data.date && !patch.dateDebut) patch.dateDebut = data.date
    if (Object.keys(patch).length === 0) throw new Error('Aucune modification détectée.')
    await updateDoc(doc(db, 'evenements_agenda', id), patch)
    await createNotification({
      type: 'evenement',
      titre: 'Événement modifié',
      detail: patch.nom || id,
      cible: patch.nom || id,
      route: '/evenements',
    })
    return 'Événement modifié avec succès.'
  }

  if (action.action === 'create_expense' || action.action === 'create_contribution') {
    const isExpense = action.action === 'create_expense'
    const motif = getActionTitle(data)
    const montant = getActionAmount(data)
    if (!motif) throw new Error('Le motif est manquant.')
    if (!montant || Number.isNaN(montant)) throw new Error('Le montant est manquant.')

    await addDoc(collection(db, 'transactions'), {
      type: isExpense ? 'depense' : 'entree',
      date: normalizeDate(data.date),
      montant,
      motif,
      note: data.note || data.description || '',
      createdBy: await getCreatedBy(),
      createdAt: new Date().toISOString(),
    })
    await createNotification({
      type: 'budget',
      titre: isExpense ? 'Nouvelle dépense budget' : 'Nouvelle entrée budget',
      detail: `${motif} - ${montant.toLocaleString('fr-FR')} Ar`,
      cible: motif,
      route: '/budget',
    })
    return isExpense ? 'Dépense enregistrée avec succès.' : 'Entrée enregistrée avec succès.'
  }

  if (action.action === 'send_message') {
    const message = data.corps || data.body || data.message || data.text || data.content || ''
    const titre = data.sujet || data.title || data.titre || 'Message'
    if (!message) throw new Error('Le contenu du message est manquant.')
    await createNotification({
      type: 'message',
      titre,
      detail: String(message),
      cible: data.destinataires || data.target || data.cible || 'Tous',
      route: '/notifications',
    })
    return 'Message préparé et ajouté aux notifications.'
  }

  throw new Error('Action non prise en charge.')
}

function ActionCard({ action, status, onConfirm, onCancel }) {
  const entries = Object.entries(action?.data || {})
  const done = status === 'confirmed' || status === 'cancelled'
  const saving = status === 'saving'
  return (
    <div className="assistant-action-card">
      <div className="assistant-action-kicker">Action proposée</div>
      <div className="assistant-action-title">
        {ACTION_LABELS[action.action] || action.action}
      </div>
      {entries.length > 0 && (
        <div className="assistant-action-details">
          {entries.map(([key, value]) => (
            <div key={key} className="assistant-action-row">
              <span>{key}</span>
              <strong className={value === null || value === undefined || value === '' ? 'missing' : ''}>
                {formatActionValue(value)}
              </strong>
            </div>
          ))}
        </div>
      )}
      {status === 'confirmed' && <div className="assistant-action-note success">Action confirmée.</div>}
      {status === 'cancelled' && <div className="assistant-action-note">Action annulée.</div>}
      {!done && (
        <div className="assistant-action-buttons">
          <button type="button" className="confirm" onClick={onConfirm} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Confirmer'}
          </button>
          <button type="button" className="cancel" onClick={onCancel} disabled={saving}>
            Annuler
          </button>
        </div>
      )}
    </div>
  )
}

export default function Fampaherezana({ user }) {
  const navigate = useNavigate()
  const { C } = useTheme()
  const [messages, setMessages] = useState(() => loadSavedChat(user?.uid)?.messages || [{ role: 'assistant', text: WELCOME }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef(null)

  const assistantLabel = useMemo(() => 'Assistant IA', [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    saveChat(user?.uid, messages)
  }, [messages, user?.uid])

  async function handleSubmit(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', text }])

    const result = await generateAppAssistant(text)
    setMessages(prev => [...prev, {
      role: 'assistant',
      text: result.text,
      action: result.action || null,
    }])
    setLoading(false)
  }

  async function confirmAction(index, action) {
    setMessages(prev => prev.map((m, i) => i === index ? { ...m, actionStatus: 'saving' } : m))
    try {
      const result = await executeAssistantAction(action)
      setMessages(prev => [
        ...prev.map((m, i) => i === index ? { ...m, actionStatus: 'confirmed' } : m),
        { role: 'assistant', text: result },
      ])
    } catch (err) {
      setMessages(prev => [
        ...prev.map((m, i) => i === index ? { ...m, actionStatus: null } : m),
        { role: 'assistant', text: err?.message || 'Impossible d’exécuter cette action.' },
      ])
    }
  }

  function cancelAction(index) {
    setMessages(prev => [
      ...prev.map((m, i) => i === index ? { ...m, actionStatus: 'cancelled' } : m),
      { role: 'assistant', text: 'D’accord, action annulée.' },
    ])
  }

  return (
    <div className="famp-page" style={{ background: C.bg }}>
      <header className="famp-header">
        <button className="famp-back" onClick={() => navigate('/')} aria-label="Retour">
          <ArrowLeft size={20} />
        </button>
        <div className="famp-title-wrap">
          <div className="famp-kicker">YFC App</div>
          <h1>Assistant virtuel</h1>
        </div>
        <div className="famp-quota">{assistantLabel}</div>
      </header>

      <main className="famp-chat" ref={listRef}>
        {messages.map((message, index) => (
          <div key={index} className={`famp-message-row ${message.role}`}>
            {message.role === 'assistant' && (
              <div className="famp-avatar">
                <Sparkles size={16} />
              </div>
            )}
            {message.action ? (
              <ActionCard
                action={message.action}
                status={message.actionStatus}
                onConfirm={() => confirmAction(index, message.action)}
                onCancel={() => cancelAction(index)}
              />
            ) : (
              <div className={`famp-bubble ${message.role}`}>
                {message.text.split('\n').map((line, i, arr) => (
                  <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                ))}
              </div>
            )}
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
          placeholder="Écrivez votre demande..."
          maxLength={800}
        />
        <button type="submit" disabled={loading || !input.trim()} aria-label="Envoyer">
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
