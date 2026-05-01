import { useState, useEffect, useRef } from 'react'
import { db, storage } from '../firebase'
import { collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { Upload, Download, Trash2, FileText, File, X } from 'lucide-react'
import { createNotification } from '../notifications'
import { useTheme } from '../context/ThemeContext'
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
  const { C } = useTheme()
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
    <div className="page-container sin" style={{ background: C.bg, paddingBottom: 'calc(86px + env(safe-area-inset-bottom))' }}>

      {/* Header */}
      <div className="f1 textured-page-header" style={{ '--header-color': '#06b6d4', padding: '20px 20px 18px', paddingTop: 'max(20px, env(safe-area-inset-top))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>Documents</div>
          <div style={{ fontSize: 12, color: C.t2, marginTop: 2 }}>{documents.length} document{documents.length !== 1 ? 's' : ''}</div>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="header-action"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, border: 'none', background: C.teal, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: uploading ? 0.6 : 1 }}
        >
          <Upload size={14} /> {uploading ? 'Envoi...' : 'Ajouter'}
        </button>
        <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
      </div>

      {/* Content */}
      <div className="f2 scroll-bottom-safe" style={{ padding: '0 20px' }}>

        {error && (
          <div style={{ marginBottom: 8, padding: '12px 14px', background: C.coralD, borderRadius: 12, color: C.coral, fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}

        {uploading && uploadProgress && (
          <div style={{ marginBottom: 8, padding: '12px 14px', background: C.tealD, borderRadius: 12, color: C.teal, fontSize: 13, fontWeight: 600 }}>
            {uploadProgress}
          </div>
        )}

        {documents.length === 0 && !uploading ? (
          <div style={{ textAlign: 'center', color: C.t2, padding: '3rem 1rem', fontSize: 13 }}>
            Aucun document. Appuyez sur « Ajouter » pour en uploader un.
          </div>
        ) : (
          <div style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 18, overflow: 'hidden' }}>
            {documents.map((doc, i) => (
              <div
                key={doc.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 16px',
                  borderBottom: i < documents.length - 1 ? `1px solid ${C.bord}` : 'none',
                }}
              >
                <div
                  onClick={() => canPreview(doc.type) ? setPreview(doc) : null}
                  style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: C.tealD, color: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canPreview(doc.type) ? 'pointer' : 'default' }}
                >
                  <FileIcon type={doc.type} />
                </div>

                <div
                  onClick={() => canPreview(doc.type) ? setPreview(doc) : null}
                  style={{ flex: 1, minWidth: 0, cursor: canPreview(doc.type) ? 'pointer' : 'default' }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.nom}
                  </div>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
                    {fmtSize(doc.taille)} · {formatDate(doc.uploadedAt)}
                  </div>
                </div>

                <a
                  href={doc.url}
                  download={doc.nom}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.bord}`, background: 'transparent', color: C.t2, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}
                >
                  <Download size={14} />
                </a>

                <button
                  onClick={() => setConfirmDel(doc)}
                  style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.bord}`, background: 'transparent', cursor: 'pointer', color: C.coral, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  <Trash2 size={14} />
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
          <div
            onClick={e => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'rgba(0,0,0,0.6)', flexShrink: 0 }}
          >
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {preview.nom}
            </div>
            <a
              href={preview.url}
              download={preview.nom}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#fff', opacity: 0.7, display: 'flex', padding: 6 }}
              onClick={e => e.stopPropagation()}
            >
              <Download size={18} />
            </a>
            <button
              onClick={() => setPreview(null)}
              style={{ background: 'none', border: 'none', color: '#fff', opacity: 0.7, cursor: 'pointer', display: 'flex', padding: 6 }}
            >
              <X size={20} />
            </button>
          </div>

          <div onClick={e => e.stopPropagation()} style={{ flex: 1, overflow: 'hidden' }}>
            {preview.type?.startsWith('image/') ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <img src={preview.url} alt={preview.nom} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
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
            <h3 className="dialog-title" style={{ marginBottom: 8 }}>Supprimer ce document ?</h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: 13, color: C.t2 }}>
              « {confirmDel.nom} » sera définitivement supprimé.
            </p>
            <div className="dialog-footer">
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, padding: 12, border: `1.5px solid ${C.bord2}`, borderRadius: 12, background: 'transparent', color: C.t2, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button onClick={handleDelete} style={{ flex: 1, padding: 12, border: 'none', borderRadius: 12, background: C.coral, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
