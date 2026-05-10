import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { Upload, Download, Trash2, FileText, File, Search, X, Link2, Copy, ExternalLink } from 'lucide-react'
import { db } from '../../firebase'
import { storage } from '../../firebaseStorage'
import { createNotification } from '../../notifications'
import { useTheme } from '../../context/ThemeContext'
import { useDesktopToolbar } from '../../context/DesktopToolbarContext'

const MAX_SIZE_MB = 20

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function canPreview(type) {
  return type === 'application/pdf' || type?.startsWith('image/')
}

function FileIcon({ type }) {
  const Icon = canPreview(type) ? FileText : File
  return <Icon size={20} />
}

export default function DocumentsPanel({
  user,
  userData,
  embedded = false,
  title = null,
  subtitle = null,
  onAddReady = null,
  onAddLinkReady = null,
  highlightDocId = '',
  highlightLienId = '',
  onHighlightDone = null,
}) {
  const { t } = useTranslation()
  const { C } = useTheme()
  const { setToolbar } = useDesktopToolbar()
  const fileRef = useRef()
  const [documents, setDocuments] = useState([])
  const [links, setLinks] = useState([])
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [addLinkModal, setAddLinkModal] = useState(false)
  const [linkForm, setLinkForm] = useState({ nom: '', url: '' })
  const [expandedLink, setExpandedLink] = useState(null)
  const [confirmDelLink, setConfirmDelLink] = useState(null)
  const [highlightedId, setHighlightedId] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [addingLink, setAddingLink] = useState(false)
  const [deletingLink, setDeletingLink] = useState(false)

  useEffect(() => {
    const id = highlightDocId || highlightLienId
    if (!id) return
    if (highlightDocId && documents.length === 0) return
    if (highlightLienId && links.length === 0) return
    setHighlightedId(id)
    const t1 = setTimeout(() => {
      document.querySelector(`[data-item-id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 180)
    const t2 = setTimeout(() => {
      setHighlightedId('')
      onHighlightDone?.()
    }, 2600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [highlightDocId, highlightLienId, documents, links, onHighlightDone])

  useEffect(() => {
    if (!expandedLink) return
    function close() { setExpandedLink(null) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [expandedLink])

  const desktopActions = useMemo(() => (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        type="button"
        onClick={() => setAddLinkModal(true)}
        className="desktop-toolbar-btn"
      >
        <Link2 size={16} /> Lien
      </button>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="desktop-toolbar-btn"
      >
        <Upload size={16} /> {uploading ? t('common.saving') : t('common.add')}
      </button>
    </div>
  ), [uploading, t])

  useEffect(() => {
    setToolbar({ actions: desktopActions })
    return () => setToolbar({ actions: null })
  }, [desktopActions, setToolbar])

  useEffect(() => {
    if (embedded && onAddReady) onAddReady(() => fileRef.current?.click())
    if (embedded && onAddLinkReady) onAddLinkReady(() => setAddLinkModal(true))
  }, [embedded, onAddReady, onAddLinkReady])

  useEffect(() => {
    const q = query(collection(db, 'documents'), orderBy('uploadedAt', 'desc'))
    return onSnapshot(q, snap => {
      setDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'liens'), orderBy('addedAt', 'desc'))
    return onSnapshot(q, snap => {
      setLinks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
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

      const docRef = await addDoc(collection(db, 'documents'), {
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
        metadata: { docId: docRef.id },
      })
      setUploadProgress('')
    } catch (err) {
      setError(err.message || "Erreur lors de l'envoi.")
      setTimeout(() => setError(''), 6000)
      setUploadProgress('')
    }
    setUploading(false)
  }

  async function handleDelete() {
    if (!confirmDel) return
    setDeleting(true)
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
    setDeleting(false)
    setConfirmDel(null)
  }

  async function handleAddLink() {
    const nom = linkForm.nom.trim()
    let url = linkForm.url.trim()
    if (!nom || !url) return
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    setAddingLink(true)
    const lienRef = await addDoc(collection(db, 'liens'), {
      nom,
      url,
      addedAt: new Date().toISOString(),
      addedBy: userData?.nom || user.email,
    })
    await createNotification({
      type: 'document',
      titre: 'Lien ajouté',
      detail: nom,
      cible: nom,
      route: '/documents',
      metadata: { lienId: lienRef.id },
    })
    setAddingLink(false)
    setLinkForm({ nom: '', url: '' })
    setAddLinkModal(false)
  }

  async function handleDeleteLink() {
    if (!confirmDelLink) return
    setDeletingLink(true)
    await deleteDoc(doc(db, 'liens', confirmDelLink.id))
    setDeletingLink(false)
    setConfirmDelLink(null)
  }

  function formatDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const visibleDocuments = search.trim()
    ? documents.filter(d => d.nom?.toLowerCase().includes(search.trim().toLowerCase()))
    : documents

  const visibleLinks = search.trim()
    ? links.filter(l =>
        l.nom?.toLowerCase().includes(search.trim().toLowerCase()) ||
        l.url?.toLowerCase().includes(search.trim().toLowerCase())
      )
    : links

  const panelTitle = title || t('documents.title')
  const panelSubtitle = subtitle || `${documents.length} document${documents.length !== 1 ? 's' : ''}`

  if (!embedded) {
    return (
      <div className="page-container sin" style={{ background: C.bg, paddingBottom: 'calc(86px + env(safe-area-inset-bottom))' }}>
        <div className="f1 textured-page-header desktop-hide-page-header" style={{ '--header-color': '#06b6d4', padding: '20px 20px 18px', paddingTop: 'max(20px, env(safe-area-inset-top))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: C.t1, letterSpacing: '-.4px' }}>{panelTitle}</div>
            <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 2 }}>{panelSubtitle}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setAddLinkModal(true)}
              className="header-action"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 12, border: 'none', background: 'rgba(124,58,237,0.15)', color: '#7c3aed', cursor: 'pointer' }}
            >
              <Link2 size={16} />
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="header-action"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, border: 'none', background: C.teal, color: '#fff', cursor: 'pointer', fontSize: 'var(--font-sm)', fontWeight: 600, opacity: uploading ? 0.6 : 1 }}
            >
              <Upload size={14} /> {uploading ? t('common.saving') : t('common.add')}
            </button>
          </div>
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
        </div>
        <div className="f2 scroll-bottom-safe" style={{ padding: '0 20px' }}>
          <DocumentsPanelContent
            C={C}
            t={t}
            documents={documents}
            links={links}
            expandedLink={expandedLink}
            setExpandedLink={setExpandedLink}
            setConfirmDelLink={setConfirmDelLink}
            uploading={uploading}
            uploadProgress={uploadProgress}
            error={error}
            fileRef={fileRef}
            handleUpload={handleUpload}
            setPreview={setPreview}
            setConfirmDel={setConfirmDel}
            formatDate={formatDate}
            highlightedId={highlightedId}
          />
        </div>
        <DocumentsOverlay
          preview={preview}
          setPreview={setPreview}
          confirmDel={confirmDel}
          setConfirmDel={setConfirmDel}
          handleDelete={handleDelete}
          deleting={deleting}
          confirmDelLink={confirmDelLink}
          setConfirmDelLink={setConfirmDelLink}
          handleDeleteLink={handleDeleteLink}
          deletingLink={deletingLink}
          t={t}
          C={C}
        />
        {addLinkModal && (
          <AddLinkModal
            linkForm={linkForm}
            setLinkForm={setLinkForm}
            onSubmit={handleAddLink}
            onClose={() => { setAddLinkModal(false); setLinkForm({ nom: '', url: '' }) }}
            loading={addingLink}
            C={C}
          />
        )}
      </div>
    )
  }

  return (
    <>
      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
      <div className="tx-search-wrapper" style={{ marginBottom: 12 }}>
        <div className="tx-search-icon"><Search size={14} /></div>
        <input
          className="tx-search-input"
          type="search"
          placeholder="Rechercher un document..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 38, paddingRight: search ? 38 : 12 }}
        />
        {search && (
          <button type="button" className="tx-search-clear" onClick={() => setSearch('')}>
            <X size={14} />
          </button>
        )}
      </div>
      <DocumentsPanelContent
        C={C}
        t={t}
        documents={visibleDocuments}
        links={visibleLinks}
        expandedLink={expandedLink}
        setExpandedLink={setExpandedLink}
        setConfirmDelLink={setConfirmDelLink}
        uploading={uploading}
        uploadProgress={uploadProgress}
        error={error}
        fileRef={fileRef}
        handleUpload={handleUpload}
        setPreview={setPreview}
        setConfirmDel={setConfirmDel}
        formatDate={formatDate}
        highlightedId={highlightedId}
      />
      <DocumentsOverlay
        preview={preview}
        setPreview={setPreview}
        confirmDel={confirmDel}
        setConfirmDel={setConfirmDel}
        handleDelete={handleDelete}
        deleting={deleting}
        confirmDelLink={confirmDelLink}
        setConfirmDelLink={setConfirmDelLink}
        handleDeleteLink={handleDeleteLink}
        deletingLink={deletingLink}
        t={t}
        C={C}
      />
      {addLinkModal && (
        <AddLinkModal
          linkForm={linkForm}
          setLinkForm={setLinkForm}
          onSubmit={handleAddLink}
          onClose={() => { setAddLinkModal(false); setLinkForm({ nom: '', url: '' }) }}
          loading={addingLink}
          C={C}
        />
      )}
    </>
  )
}

function DocumentsPanelContent({
  C, t, documents, links, expandedLink, setExpandedLink, setConfirmDelLink,
  uploading, uploadProgress, error, setPreview, setConfirmDel, formatDate, highlightedId,
}) {
  const isEmpty = documents.length === 0 && links.length === 0 && !uploading

  return (
    <>
      {error && (
        <div style={{ marginBottom: 8, padding: '12px 14px', background: C.coralD, borderRadius: 12, color: C.coral, fontSize: 'var(--font-sm)', fontWeight: 600 }}>
          {error}
        </div>
      )}
      {uploading && uploadProgress && (
        <div style={{ marginBottom: 8, padding: '12px 14px', background: C.tealD, borderRadius: 12, color: C.teal, fontSize: 'var(--font-sm)', fontWeight: 600 }}>
          {uploadProgress}
        </div>
      )}
      {isEmpty ? (
        <div style={{ textAlign: 'center', color: C.t2, padding: '3rem 1rem', fontSize: 'var(--font-sm)' }}>
          {t('documents.aucun')}
        </div>
      ) : (
        <>
          {links.length > 0 && (
            <div style={{ marginBottom: 12, background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 18, overflow: 'hidden' }}>
              {links.map((link, i) => (
                <LinkCard
                  key={link.id}
                  link={link}
                  isExpanded={expandedLink === link.id}
                  onToggle={() => setExpandedLink(prev => prev === link.id ? null : link.id)}
                  onDelete={() => setConfirmDelLink(link)}
                  C={C}
                  isLast={i === links.length - 1}
                  isHighlighted={highlightedId === link.id}
                />
              ))}
            </div>
          )}
          {documents.length > 0 && (
            <div style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 18, overflow: 'hidden' }}>
              {documents.map((item, i) => (
                <div
                  key={item.id}
                  data-item-id={item.id}
                  className={highlightedId === item.id ? 'item-highlighted' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 16px',
                    borderBottom: i < documents.length - 1 ? `1px solid ${C.bord}` : 'none',
                  }}
                >
                  <div
                    onClick={() => canPreview(item.type) ? setPreview(item) : null}
                    style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: C.tealD, color: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canPreview(item.type) ? 'pointer' : 'default' }}
                  >
                    <FileIcon type={item.type} />
                  </div>
                  <div
                    onClick={() => canPreview(item.type) ? setPreview(item) : null}
                    style={{ flex: 1, minWidth: 0, cursor: canPreview(item.type) ? 'pointer' : 'default' }}
                  >
                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.nom}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: C.t3, marginTop: 2 }}>
                      {fmtSize(item.taille)} · {formatDate(item.uploadedAt)}
                    </div>
                  </div>
                  <a
                    href={item.url}
                    download={item.nom}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.bord}`, background: 'transparent', color: C.t2, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}
                  >
                    <Download size={14} />
                  </a>
                  <button
                    onClick={() => setConfirmDel(item)}
                    style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.bord}`, background: 'transparent', cursor: 'pointer', color: C.coral, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

function LinkCard({ link, isExpanded, onToggle, onDelete, C, isLast, isHighlighted }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(e) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(link.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div>
      <div
        data-item-id={link.id}
        className={isHighlighted ? 'item-highlighted' : undefined}
        onClick={e => { e.stopPropagation(); onToggle() }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '13px 16px',
          borderBottom: (!isLast || isExpanded) ? `1px solid ${C.bord}` : 'none',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: 'rgba(124,58,237,0.12)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Link2 size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {link.nom}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: C.t3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {link.url}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.bord}`, background: 'transparent', cursor: 'pointer', color: C.coral, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {isExpanded && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px 10px 68px',
            borderBottom: !isLast ? `1px solid ${C.bord}` : 'none',
            background: 'rgba(124,58,237,0.04)',
          }}
        >
          <div style={{ flex: 1, fontSize: 'var(--font-xs)', color: C.t3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {link.url}
          </div>
          <button
            onClick={handleCopy}
            title="Copier le lien"
            style={{
              width: 32, height: 32, borderRadius: 10,
              border: `1px solid ${C.bord}`,
              background: copied ? 'rgba(124,58,237,0.12)' : 'transparent',
              cursor: 'pointer',
              color: copied ? '#7c3aed' : C.t2,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            <Copy size={14} />
          </button>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            title="Ouvrir le lien"
            style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.bord}`, background: 'transparent', color: C.t2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none' }}
          >
            <ExternalLink size={14} />
          </a>
        </div>
      )}
    </div>
  )
}

function AddLinkModal({ linkForm, setLinkForm, onSubmit, onClose, loading, C }) {
  const canSubmit = linkForm.nom.trim() && linkForm.url.trim()

  function handleKeyDown(e) {
    if (e.key === 'Enter' && canSubmit) onSubmit()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <h3 className="dialog-title" style={{ marginBottom: 16 }}>Ajouter un lien</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <input
            autoFocus
            type="text"
            placeholder="Nom du lien"
            value={linkForm.nom}
            onChange={e => setLinkForm(f => ({ ...f, nom: e.target.value }))}
            style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.bord}`, background: C.bg, color: C.t1, fontSize: 'var(--font-sm)', outline: 'none' }}
          />
          <input
            type="url"
            placeholder="https://..."
            value={linkForm.url}
            onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))}
            style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.bord}`, background: C.bg, color: C.t1, fontSize: 'var(--font-sm)', outline: 'none' }}
          />
        </div>
        <div className="dialog-footer">
          <button onClick={onClose} className="btn-secondary materiel-footer-btn">
            Annuler
          </button>
          <button
            onClick={onSubmit}
            disabled={!canSubmit || loading}
            className="materiel-primary-btn"
            style={{ background: '#7c3aed', color: '#fff', opacity: canSubmit && !loading ? 1 : 0.5 }}
          >
            {loading ? <span className="btn-spinner" /> : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DocumentsOverlay({
  preview, setPreview,
  confirmDel, setConfirmDel, handleDelete, deleting,
  confirmDelLink, setConfirmDelLink, handleDeleteLink, deletingLink,
  t, C,
}) {
  return (
    <>
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'rgba(0,0,0,0.6)', flexShrink: 0 }}>
            <div style={{ flex: 1, fontSize: 'var(--font-sm)', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {preview.nom}
            </div>
            <a href={preview.url} download={preview.nom} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', opacity: 0.7, display: 'flex', padding: 6 }} onClick={e => e.stopPropagation()}>
              <Download size={18} />
            </a>
            <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', color: '#fff', opacity: 0.7, cursor: 'pointer', display: 'flex', padding: 6 }}>
              <X size={20} />
            </button>
          </div>
          <div onClick={e => e.stopPropagation()} style={{ flex: 1, overflow: 'hidden' }}>
            {preview.type?.startsWith('image/') ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <img src={preview.url} alt={preview.nom} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
              </div>
            ) : (
              <iframe src={preview.url} title={preview.nom} style={{ width: '100%', height: '100%', border: 'none' }} />
            )}
          </div>
        </div>
      )}
      {confirmDel && (
        <div className="modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title" style={{ marginBottom: 8 }}>{t('documents.supprimer')} ?</h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: 'var(--font-sm)', color: C.t2 }}>
              « {confirmDel.nom} » sera définitivement supprimé.
            </p>
            <div className="dialog-footer">
              <button onClick={() => setConfirmDel(null)} className="btn-secondary materiel-footer-btn">
                {t('common.cancel')}
              </button>
              <button onClick={handleDelete} disabled={deleting} className="materiel-primary-btn" style={{ background: C.coral, color: '#fff', opacity: deleting ? 0.6 : 1 }}>
                {deleting ? <span className="btn-spinner" /> : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDelLink && (
        <div className="modal-overlay" onClick={() => setConfirmDelLink(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title" style={{ marginBottom: 8 }}>Supprimer ce lien ?</h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: 'var(--font-sm)', color: C.t2 }}>
              « {confirmDelLink.nom} » sera définitivement supprimé.
            </p>
            <div className="dialog-footer">
              <button onClick={() => setConfirmDelLink(null)} className="btn-secondary materiel-footer-btn">
                {t('common.cancel')}
              </button>
              <button onClick={handleDeleteLink} disabled={deletingLink} className="materiel-primary-btn" style={{ background: C.coral, color: '#fff', opacity: deletingLink ? 0.6 : 1 }}>
                {deletingLink ? <span className="btn-spinner" /> : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
