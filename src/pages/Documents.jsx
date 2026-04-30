import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Upload, Download, Trash2, FileText, File } from 'lucide-react'

const C = '#7C3AED'
const CLOUD_NAME = 'dvtyebpmr'
const UPLOAD_PRESET = 'yfc_documents'
const MAX_SIZE_MB = 20

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' o'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko'
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo'
}

function FileIcon({ type }) {
  const isImage = type?.startsWith('image/')
  const isPdf = type === 'application/pdf'
  const Icon = isImage || isPdf ? FileText : File
  return <Icon size={20} />
}

export default function Documents({ user, userData }) {
  const navigate = useNavigate()
  const fileRef = useRef()
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'documents'), orderBy('uploadedAt', 'desc'))
    return onSnapshot(q, snap => {
      setDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Fichier trop volumineux (max ${MAX_SIZE_MB} Mo)`)
      setTimeout(() => setError(''), 3000)
      return
    }

    setUploading(true)
    setUploadProgress('Envoi en cours...')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('upload_preset', UPLOAD_PRESET)

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
        { method: 'POST', body: fd }
      )
      const data = await res.json()

      if (!data.secure_url) {
        const msg = data.error?.message || JSON.stringify(data)
        throw new Error(msg)
      }

      await addDoc(collection(db, 'documents'), {
        nom: file.name,
        url: data.secure_url,
        taille: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        uploadedBy: userData?.nom || user.email,
      })
      setUploadProgress('')
    } catch(e) {
      setError(e.message || 'Erreur lors de l\'envoi.')
      setTimeout(() => setError(''), 6000)
      setUploadProgress('')
    }
    setUploading(false)
  }

  async function handleDelete() {
    if (!confirmDel) return
    await deleteDoc(doc(db, 'documents', confirmDel.id))
    setConfirmDel(null)
  }

  function formatDate(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="page-container">

      {/* Header */}
      <div className="page-header" style={{ background: C, padding: '18px 16px 2.5rem' }}>
        <div className="flex-center gap-12">
          <button onClick={() => navigate('/')} className="page-back-btn">‹</button>
          <div className="flex-1">
            <h1 className="page-title">Documents</h1>
            <p className="page-subtitle">{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="header-btn-sm"
            style={{ background: 'rgba(255,255,255,0.2)', opacity: uploading ? 0.6 : 1 }}
          >
            <Upload size={15} /> {uploading ? 'Envoi...' : 'Ajouter'}
          </button>
          <input
            ref={fileRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ paddingTop: '0.75rem', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', marginTop: '-1.5rem', background: 'var(--bg-body)', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '2rem' }}>

        {/* Toast erreur */}
        {error && (
          <div style={{ margin: '8px 16px 0', padding: '12px 14px', background: '#FEF0F4', borderRadius: '12px', color: '#D63B5E', fontSize: '13px', fontWeight: '600' }}>
            {error}
          </div>
        )}

        {/* Progress upload */}
        {uploading && uploadProgress && (
          <div style={{ margin: '8px 16px 0', padding: '12px 14px', background: `${C}15`, borderRadius: '12px', color: C, fontSize: '13px', fontWeight: '600' }}>
            {uploadProgress}
          </div>
        )}

        {documents.length === 0 && !uploading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem 1rem', fontSize: '13px' }}>
            Aucun document. Appuyez sur « Ajouter » pour en uploader un.
          </div>
        ) : (
          <div className="card" style={{ margin: '8px 16px 0' }}>
            {documents.map((doc, i) => (
              <div
                key={doc.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 0',
                  borderBottom: i < documents.length - 1 ? '0.5px solid var(--border-input)' : 'none',
                }}
              >
                {/* Icône */}
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                  background: `${C}15`, color: C,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FileIcon type={doc.type} />
                </div>

                {/* Infos */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.nom}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {fmtSize(doc.taille)} · {formatDate(doc.uploadedAt)}
                  </div>
                </div>

                {/* Boutons */}
                <a
                  href={doc.url}
                  download={doc.nom}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: `${C}15`, border: 'none', borderRadius: '8px', padding: '7px 9px', cursor: 'pointer', color: C, display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}
                >
                  <Download size={15} />
                </a>
                <button
                  onClick={() => setConfirmDel(doc)}
                  style={{ background: 'var(--del-btn-bg)', border: 'none', borderRadius: '8px', padding: '7px 9px', cursor: 'pointer', color: '#D63B5E', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation suppression */}
      {confirmDel && (
        <div className="modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title" style={{ marginBottom: '8px' }}>Supprimer ce document ?</h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: '13px', color: 'var(--text-secondary)' }}>
              « {confirmDel.nom} » sera définitivement supprimé.
            </p>
            <div className="dialog-footer">
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, padding: '12px', border: '1.5px solid var(--border-input)', borderRadius: '12px', background: 'transparent', color: 'var(--text-secondary)', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button onClick={handleDelete} style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '12px', background: '#E8445A', color: '#fff', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
