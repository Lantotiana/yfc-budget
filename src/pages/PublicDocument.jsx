import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { FileText, Send } from 'lucide-react'
import { db } from '../firebase'
import { cloudFunctions } from '../firebaseFunctions'
import Seo from '../components/Seo'
import logoYfc from '../assets/logo_yfc.png'

function fmtSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function getRequestErrorMessage(err) {
  const code = err?.code || ''
  const message = err?.message || ''

  if (code.includes('not-found')) {
    return "Le service d'envoi n'est pas encore deploye, ou ce document n'est plus disponible."
  }
  if (code.includes('failed-precondition')) {
    return 'Le service email n est pas encore configure.'
  }
  if (code.includes('invalid-argument')) {
    return 'Verifiez votre prenom et votre email.'
  }
  if (code.includes('internal') && message) {
    return message
  }
  if (message) return message
  return "Impossible d'envoyer le document pour le moment."
}

export default function PublicDocument() {
  const { id } = useParams()
  const [documentData, setDocumentData] = useState(null)
  const [status, setStatus] = useState('loading')
  const [form, setForm] = useState({ prenom: '', email: '' })
  const [sending, setSending] = useState(false)
  const [requestStatus, setRequestStatus] = useState('')
  const [requestError, setRequestError] = useState('')

  useEffect(() => {
    let active = true

    async function loadDocument() {
      setStatus('loading')
      try {
        const snap = await getDoc(doc(db, 'documents', id))
        if (!active) return

        if (!snap.exists() || snap.data().isPublic !== true) {
          setDocumentData(null)
          setStatus('not-found')
          return
        }

        setDocumentData({ id: snap.id, ...snap.data() })
        setStatus('ready')
      } catch {
        if (!active) return
        setDocumentData(null)
        setStatus('error')
      }
    }

    loadDocument()
    return () => { active = false }
  }, [id])

  const pageUrl = useMemo(() => `https://young-for-christ.com/public/document/${id}`, [id])
  const title = documentData?.nom ? `${documentData.nom} - YFC` : 'Document public YFC'
  const canSubmit = form.prenom.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())

  async function handleRequestCopy(e) {
    e.preventDefault()
    if (!canSubmit || sending) return
    setSending(true)
    setRequestError('')
    setRequestStatus('')

    try {
      const requestCopy = httpsCallable(cloudFunctions, 'requestPublicDocumentCopy')
      await requestCopy({
        documentId: id,
        prenom: form.prenom.trim(),
        email: form.email.trim(),
        userAgent: navigator.userAgent,
      })
      setRequestStatus('Demande envoyee. Verifiez votre boite mail.')
      setForm({ prenom: '', email: '' })
    } catch (err) {
      console.error('Public document request failed', err)
      setRequestError(getRequestErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="public-document-page">
      <Seo
        title={title}
        description="Page de telechargement d'un document public Young For Christ."
        canonical={pageUrl}
        robots="noindex, nofollow"
      />

      <section className="public-document-shell" aria-labelledby="public-document-title">
        <div className="public-document-brand">
          <img src={logoYfc} alt="Young For Christ" />
          <span>Young For Christ</span>
        </div>

        {status === 'loading' && (
          <div className="public-document-card">
            <div className="public-document-icon">
              <FileText size={30} />
            </div>
            <h1 id="public-document-title">Chargement du document...</h1>
            <p>La page de telechargement se prepare.</p>
          </div>
        )}

        {status === 'ready' && documentData && (
          <div className="public-document-card">
            <div className="public-document-icon">
              <FileText size={30} />
            </div>
            <p className="public-document-eyebrow">Document public YFC</p>
            <h1 id="public-document-title">{documentData.nom}</h1>
            <p className="public-document-meta">
              {[fmtSize(documentData.taille), formatDate(documentData.uploadedAt)].filter(Boolean).join(' · ')}
            </p>
            <form className="public-document-form" onSubmit={handleRequestCopy}>
              <p className="public-document-form-title">Recevoir une copie par email</p>
              <div className="public-document-fields">
                <label>
                  <span>Prenom</span>
                  <input
                    type="text"
                    value={form.prenom}
                    onChange={e => setForm(prev => ({ ...prev, prenom: e.target.value }))}
                    placeholder="Votre prenom"
                    autoComplete="given-name"
                  />
                </label>
                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="votre@email.com"
                    autoComplete="email"
                  />
                </label>
              </div>
              {requestError && <div className="public-document-form-msg error">{requestError}</div>}
              {requestStatus && <div className="public-document-form-msg success">{requestStatus}</div>}
              <button className="public-document-download" type="submit" disabled={!canSubmit || sending}>
                <Send size={19} />
                {sending ? 'Envoi...' : 'Recevoir le PDF'}
              </button>
            </form>
          </div>
        )}

        {(status === 'not-found' || status === 'error') && (
          <div className="public-document-card">
            <div className="public-document-icon">
              <FileText size={30} />
            </div>
            <h1 id="public-document-title">Document indisponible</h1>
            <p>Ce fichier n'est pas public, n'existe plus, ou le lien a expire.</p>
          </div>
        )}
      </section>
    </main>
  )
}
