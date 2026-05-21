import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { Download, FileText, ShieldCheck } from 'lucide-react'
import { db } from '../firebase'
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

export default function PublicDocument() {
  const { id } = useParams()
  const [documentData, setDocumentData] = useState(null)
  const [status, setStatus] = useState('loading')

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
            <a
              className="public-document-download"
              href={documentData.url}
              download={documentData.nom}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download size={20} />
              Telecharger le PDF
            </a>
            <div className="public-document-note">
              <ShieldCheck size={16} />
              <span>Ce lien fonctionne uniquement tant que le document reste marque public par YFC.</span>
            </div>
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
