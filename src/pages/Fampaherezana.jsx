import { useMemo, useRef, useState, useEffect } from 'react'
import { ArrowLeft, Send } from 'lucide-react'
import assistantAvatar from '../assets/assistant_avatar.jpg'
import { useNavigate } from 'react-router-dom'
import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { auth } from '../auth'
import { db } from '../firebase'
import { createNotification } from '../notifications'
import { generateAppAssistant } from '../services/fampaherezana'
import { useTheme } from '../context/ThemeContext'
import { ADMIN_EMAIL } from '../constants'
import { canManageBudgetRole, sameEmail } from '../utils/access'
import { trackUserActivity } from '../utils/userActivity'

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

async function currentUserCanManageBudget() {
  const user = auth.currentUser
  if (!user?.email) return false
  const [membresSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, 'membres')),
    getDocs(collection(db, 'users')),
  ])
  const member = membresSnap.docs.map(d => d.data()).find(m => sameEmail(m.email, user.email))
  const userDoc = usersSnap.docs.map(d => d.data()).find(u => sameEmail(u.email, user.email))
  const effectiveRole = member?.staffRole || userDoc?.staffRole || ''
  return canManageBudgetRole(effectiveRole)
}

function statLabel(statut) {
  const map = {
    disponible: 'disponible', emprunte: 'emprunté', sorti: 'sorti',
    reserve: 'réservé', reserve_emprunt: 'réservé emprunt', reserve_evenement: 'réservé événement',
    en_reparation: 'en réparation', perdu: 'perdu', stock_faible: 'stock faible',
    kit_incomplet: 'kit incomplet', archive: 'archivé',
  }
  return map[statut] || statut
}

async function resolveDataQuery(text) {
  const t = text.toLowerCase()

  const isMateriel = /mat[eé]riel|équipement|kit|sono|stock/.test(t)
  const isMembre = /membre|personne|liste.*membre/.test(t)
  const isBudget = /budget|dépense|dépenses|entrée|solde|transaction/.test(t)
  const isEvenement = /[eé]v[eé]nement|agenda|calendrier/.test(t)

  // ── Matériels ─────────────────────────────────────────────
  if (isMateriel) {
    const snap = await getDocs(collection(db, 'materiels'))
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    const active = all.filter(m => m.statut !== 'archive')

    // Par section
    if (/section/.test(t)) {
      const grouped = {}
      active.forEach(m => {
        const s = m.section?.trim() || 'Sans section'
        if (!grouped[s]) grouped[s] = []
        grouped[s].push(m)
      })
      const sorted = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, 'fr'))
      if (sorted.length === 0) return 'Aucun matériel enregistré.'
      const lines = sorted.map(([section, mats]) => {
        const items = mats.map(m => `  • ${m.nom}${m.statut !== 'disponible' ? ` (${statLabel(m.statut)})` : ''}`).join('\n')
        return `${section} — ${mats.length} matériel${mats.length > 1 ? 's' : ''}\n${items}`
      })
      return `Matériels par section :\n\n${lines.join('\n\n')}`
    }

    // Kits uniquement
    if (/kit/.test(t)) {
      const kits = active.filter(m => m.typeMatériel === 'kit')
      if (kits.length === 0) return 'Aucun kit enregistré.'
      return `${kits.length} kit${kits.length > 1 ? 's' : ''} :\n${kits.map(m => `• ${m.nom} — ${statLabel(m.statut)}${m.section ? ` (${m.section})` : ''}`).join('\n')}`
    }

    // Disponibles
    if (/disponible/.test(t)) {
      const dispo = active.filter(m => m.statut === 'disponible')
      if (dispo.length === 0) return 'Aucun matériel disponible en ce moment.'
      return `${dispo.length} matériel${dispo.length > 1 ? 's' : ''} disponible${dispo.length > 1 ? 's' : ''} :\n${dispo.map(m => `• ${m.nom}${m.section ? ` — ${m.section}` : ''}`).join('\n')}`
    }

    // Empruntés / sortis
    if (/emprunt[eé]|sorti/.test(t)) {
      const out = active.filter(m => m.statut === 'emprunte' || m.statut === 'sorti')
      if (out.length === 0) return 'Aucun matériel emprunté ou sorti en ce moment.'
      return `${out.length} matériel${out.length > 1 ? 's' : ''} sorti${out.length > 1 ? 's' : ''} :\n${out.map(m => `• ${m.nom} — ${statLabel(m.statut)}${m.currentBorrower ? ` (${m.currentBorrower})` : ''}`).join('\n')}`
    }

    // Alertes
    if (/alerte|r[eé]paration|stock faible|incomplet/.test(t)) {
      const alerts = active.filter(m => ['en_reparation', 'stock_faible', 'kit_incomplet', 'perdu'].includes(m.statut))
      if (alerts.length === 0) return 'Aucune alerte matériel en ce moment.'
      return `${alerts.length} alerte${alerts.length > 1 ? 's' : ''} :\n${alerts.map(m => `• ${m.nom} — ${statLabel(m.statut)}`).join('\n')}`
    }

    // Liste générale
    if (active.length === 0) return 'Aucun matériel enregistré.'
    return `${active.length} matériel${active.length > 1 ? 's' : ''} enregistré${active.length > 1 ? 's' : ''} :\n${active.map(m => `• ${m.nom} — ${statLabel(m.statut)}${m.section ? ` (${m.section})` : ''}`).join('\n')}`
  }

  // ── Membres ───────────────────────────────────────────────
  if (isMembre) {
    const snap = await getDocs(collection(db, 'membres'))
    const membres = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    if (membres.length === 0) return 'Aucun membre enregistré.'
    const staff = membres.filter(m => m.staff)
    const lines = membres.map(m => `• ${m.nomPrefere || m.prenoms || m.nom}${m.staff ? ' (staff)' : ''}`)
    return `${membres.length} membre${membres.length > 1 ? 's' : ''} (dont ${staff.length} staff) :\n${lines.join('\n')}`
  }

  // ── Budget ────────────────────────────────────────────────
  if (isBudget) {
    const snap = await getDocs(collection(db, 'transactions'))
    const txs = snap.docs.map(d => d.data())
    const entrees = txs.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.montant || 0), 0)
    const depenses = txs.filter(t => t.type === 'depense').reduce((s, t) => s + Number(t.montant || 0), 0)
    const solde = entrees - depenses
    return `Résumé budget :\n• Entrées : ${entrees.toLocaleString('fr-FR')} Ar\n• Dépenses : ${depenses.toLocaleString('fr-FR')} Ar\n• Solde : ${solde.toLocaleString('fr-FR')} Ar`
  }

  // ── Événements ────────────────────────────────────────────
  if (isEvenement) {
    const today = new Date().toISOString().slice(0, 10)
    const snap = await getDocs(collection(db, 'evenements_agenda'))
    const upcoming = snap.docs
      .map(d => d.data())
      .filter(e => (e.dateFin || e.dateDebut) >= today)
      .sort((a, b) => a.dateDebut < b.dateDebut ? -1 : 1)
      .slice(0, 10)
    if (upcoming.length === 0) return 'Aucun événement à venir.'
    return `Prochains événements :\n${upcoming.map(e => `• ${e.nom} — ${e.dateDebut}${e.lieu ? ` à ${e.lieu}` : ''}`).join('\n')}`
  }

  return null
}

async function executeAssistantAction(action) {
  const data = action?.data || {}
  const canAssignStaffRole = auth.currentUser?.email === ADMIN_EMAIL

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
      staff: data.staff === true,
      staffRole: data.staff === true && canAssignStaffRole ? String(data.staffRole || data.role || '').trim() : '',
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
    ;['nom', 'prenoms', 'nomPrefere', 'adresse', 'telephone', 'email', 'tailleTshirt', 'staff'].forEach(key => {
      if (data[key] !== undefined) patch[key] = data[key]
    })
    if (canAssignStaffRole) {
      if (data.staffRole !== undefined) patch.staffRole = data.staffRole
      if (data.role !== undefined && patch.staffRole === undefined) patch.staffRole = data.role
    }
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
    if (!(await currentUserCanManageBudget())) {
      throw new Error('Vous pouvez consulter le budget, mais seuls les Présidents, Vice-présidents et Trésoriers peuvent le modifier.')
    }
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

export default function Fampaherezana({ user, embedded = false }) {
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
    trackUserActivity(user, 'Écrit à l’assistant', '/assistant')

    setInput('')
    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', text }])

    const localAnswer = await resolveDataQuery(text).catch(() => null)
    if (localAnswer) {
      setMessages(prev => [...prev, { role: 'assistant', text: localAnswer }])
      setLoading(false)
      return
    }

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
    <div className={`famp-page${embedded ? ' embedded' : ''}`} style={{ background: C.bg }}>
      <header className="famp-header">
        {!embedded && (
          <button className="famp-back" onClick={() => navigate('/')} aria-label="Retour">
            <ArrowLeft size={20} />
          </button>
        )}
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
                <img src={assistantAvatar} alt="Assistant" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
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
              <img src={assistantAvatar} alt="Assistant" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
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
