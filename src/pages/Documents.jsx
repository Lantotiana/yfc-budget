import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, storage } from '../firebase'
import { collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { Upload, Download, Trash2, FileText, File, X } from 'lucide-react'
import { createNotification } from '../notifications'

const C = '#7C3AED'
const MAX_SIZE_MB = 20

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' o'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko'
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo'
}

function canPreview(type) {
  return type === 'application/pdf' || type?.startsWith('image/')
}

function FileIcon({ type }) {
  const Icon = type === 'application/pdf' || type?.startsWith('image/') ? FileText : File
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
  const [preview, setPreview] = useState(null) // { url, nom, type }

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
      const storageRef = ref(storage, `documents/${Date.now()}_${file.name}`)
      const snapshot = await uploadBytes(storageRef, file)
      const url = await getDownloadURL(snapshot.ref)

      await addDoc(collection(db, 'documents'), {
        nom: file.name,
        url,
        storagePath: snapshot.ref.fullPath,
        taille: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        uploadedBy: userData?.nom || user.email,
      })
      await createNotification({
        type: 'document',
        titre: 'Document ajouté',
        detail: file.name,
        cible: file.name,
        route: '/documents',
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
    try {
      if (confirmDel.storagePath) {
        await deleteObject(ref(storage, confirmDel.storagePath))
      }
    } catch {}
    await deleteDoc(doc(db, 'documents', confirmDel.id))
    await createNotification({
      type: 'document',
      titre: 'Document supprimé',
      detail: confirmDel.nom || '',
      cible: confirmDel.nom || '',
      route: '/documents',
    })
    setConfirmDel(null)
  }

  function formatDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
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
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
        </div>
      </div>

      {/* Content */}
      <div className="scroll-bottom-safe" style={{ paddingTop: '0.75rem', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', marginTop: '-1.5rem', background: 'var(--bg-body)', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '2rem' }}>

        {error && (
          <div style={{ margin: '8px 16px 0', padding: '12px 14px', background: '#FEF0F4', borderRadius: '12px', color: '#D63B5E', fontSize: '13px', fontWeight: '600' }}>
            {error}
          </div>
        )}

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
                <div
                  onClick={() => canPreview(doc.type) ? setPreview(doc) : null}
                  style={{ width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0, background: `${C}15`, color: C, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canPreview(doc.type) ? 'pointer' : 'default' }}
                >
                  <FileIcon type={doc.type} />
                </div>

                <div
                  onClick={() => canPreview(doc.type) ? setPreview(doc) : null}
                  style={{ flex: 1, minWidth: 0, cursor: canPreview(doc.type) ? 'pointer' : 'default' }}
                >
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.nom}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {fmtSize(doc.taille)} · {formatDate(doc.uploadedAt)}
                  </div>
                </div>

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

      {/* Visualiseur */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', flexDirection: 'column' }}
        >
          {/* Barre titre */}
          <div
            onClick={e => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'rgba(0,0,0,0.6)', flexShrink: 0 }}
          >
            <div style={{ flex: 1, fontSize: '13px', fontWeight: '600', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {preview.nom}
            </div>
            <a
              href={preview.url}
              download={preview.nom}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#fff', opacity: 0.7, display: 'flex', padding: '6px' }}
              onClick={e => e.stopPropagation()}
            >
              <Download size={18} />
            </a>
            <button
              onClick={() => setPreview(null)}
              style={{ background: 'none', border: 'none', color: '#fff', opacity: 0.7, cursor: 'pointer', display: 'flex', padding: '6px' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Contenu */}
          <div onClick={e => e.stopPropagation()} style={{ flex: 1, overflow: 'hidden' }}>
            {preview.type?.startsWith('image/') ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                <img src={preview.url} alt={preview.nom} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} />
              </div>
            ) : (
              <iframe
                src={preview.url}
                title={preview.nom}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            )}
          </div>
        </div>
      )}

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
