import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Trash2, X } from 'lucide-react'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import Portal from '../Portal'
import { storage } from '../../firebase'
import { MATERIEL_CATEGORIES, MATERIEL_UNITES } from './materielHelpers'

const EMPTY_FORM = {
  nom: '',
  categorie: 'Sonorisation',
  type: 'durable',
  quantite: 1,
  unite: 'piece',
  etat: 'bon',
  statut: 'disponible',
  lieuActuel: '',
  responsableId: '',
  responsableNom: '',
  responsablesIds: [],
  responsablesNoms: [],
  photoUrl: '',
  valeurEstimee: '',
  seuilAlerte: '',
  notes: '',
}

const MAX_IMAGE_HEIGHT = 500
const WEBP_QUALITY = 0.82

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Lecture image impossible.'))
    reader.readAsDataURL(file)
  })
}

function dataUrlToBlob(dataUrl) {
  const [meta, base64] = String(dataUrl).split(',')
  const mime = (meta.match(/data:(.*?);base64/) || [])[1] || 'image/webp'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

async function toWebpWithMaxHeight(file) {
  const sourceUrl = await readFileAsDataUrl(file)
  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image invalide.'))
    img.src = sourceUrl
  })

  const ratio = image.naturalWidth / image.naturalHeight || 1
  const targetHeight = Math.min(image.naturalHeight || MAX_IMAGE_HEIGHT, MAX_IMAGE_HEIGHT)
  const targetWidth = Math.max(1, Math.round(targetHeight * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponible pour la conversion image.')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight)

  const webpDataUrl = canvas.toDataURL('image/webp', WEBP_QUALITY)
  const webpBlob = dataUrlToBlob(webpDataUrl)
  const baseName = (file.name || 'materiel')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')

  return new File([webpBlob], `${baseName}.webp`, { type: 'image/webp' })
}

async function uploadToFirebaseStorage(file) {
  const storageRef = ref(storage, `materiels/${Date.now()}_${file.name}`)
  const snapshot = await uploadBytes(storageRef, file, { contentType: 'image/webp' })
  return getDownloadURL(snapshot.ref)
}

export default function MaterielFormModal({ open, onClose, onSubmit, onDelete, members, initialData, C, saving }) {
  const fileRef = useRef(null)
  const searchRef = useRef(null)
  const responsibleRef = useRef(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [responsibleSearch, setResponsibleSearch] = useState('')
  const [responsibleOpen, setResponsibleOpen] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open) return
    const initialResponsablesIds = Array.isArray(initialData?.responsablesIds)
      ? initialData.responsablesIds
      : (initialData?.responsableId ? [initialData.responsableId] : [])
    const initialResponsablesNoms = Array.isArray(initialData?.responsablesNoms)
      ? initialData.responsablesNoms
      : (initialData?.responsableNom ? [initialData.responsableNom] : [])

    setForm(initialData ? {
      ...EMPTY_FORM,
      ...initialData,
      responsablesIds: initialResponsablesIds,
      responsablesNoms: initialResponsablesNoms,
      valeurEstimee: initialData.valeurEstimee ?? '',
      seuilAlerte: initialData.seuilAlerte ?? '',
    } : EMPTY_FORM)
    setError('')
    setResponsibleSearch('')
    setResponsibleOpen(false)
    setUploadingPhoto(false)
  }, [initialData, open])

  useEffect(() => {
    if (!responsibleOpen) return undefined

    function onPointerDown(event) {
      if (responsibleRef.current?.contains(event.target)) return
      setResponsibleOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [responsibleOpen])

  if (!open) return null

  function updateField(name, value) {
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function getMemberName(member) {
    return member?.nomPrefere || member?.prenoms || member?.nom || ''
  }

  const filteredResponsibles = members.filter(member => {
    const term = responsibleSearch.trim().toLowerCase()
    if (!term) return true
    return [getMemberName(member), member.nom, member.prenoms, member.email]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(term)
  })

  const selectedResponsibles = members.filter(member => form.responsablesIds.includes(member.id))

  function openResponsibleDropdown() {
    setResponsibleOpen(true)
    window.setTimeout(() => searchRef.current?.focus(), 0)
  }

  function toggleResponsible(id, closeAfter = false) {
    const nextIds = form.responsablesIds.includes(id)
      ? form.responsablesIds.filter(item => item !== id)
      : [...form.responsablesIds, id]
    const selected = members.filter(member => nextIds.includes(member.id))
    const nextNames = selected.map(getMemberName).filter(Boolean)

    setForm(prev => ({
      ...prev,
      responsablesIds: nextIds,
      responsablesNoms: nextNames,
      responsableId: nextIds[0] || '',
      responsableNom: nextNames.join(', '),
    }))
    if (closeAfter) {
      setResponsibleOpen(false)
      setResponsibleSearch('')
    }
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    setError('')
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Veuillez choisir une image valide.')
      }
      const processedFile = await toWebpWithMaxHeight(file)
      const url = await uploadToFirebaseStorage(processedFile)
      updateField('photoUrl', url)
    } catch (err) {
      setError(err?.message || "Impossible d'envoyer la photo.")
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nom.trim()) return setError('Le nom est obligatoire.')
    if (!form.categorie.trim()) return setError('La categorie est obligatoire.')
    if (Number(form.quantite) < 0) return setError('La quantite doit etre positive.')

    const payload = {
      ...form,
      nom: form.nom.trim(),
      categorie: form.categorie.trim(),
      quantite: Number(form.quantite || 0),
      valeurEstimee: form.valeurEstimee === '' ? null : Number(form.valeurEstimee),
      seuilAlerte: form.seuilAlerte === '' ? null : Number(form.seuilAlerte),
      notes: form.notes.trim(),
      lieuActuel: form.lieuActuel.trim(),
      responsableId: form.responsablesIds[0] || '',
      responsableNom: form.responsablesNoms.join(', '),
    }
    setError('')
    await onSubmit(payload)
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await onDelete()
      setConfirmingDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
    {confirmingDelete && (
      <Portal>
        <div className="modal-overlay" onClick={() => setConfirmingDelete(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="dialog-title" style={{ marginBottom: 8 }}>Supprimer ce matériel ?</div>
            <p style={{ fontSize: 'var(--font-sm)', color: C.t2, marginBottom: 20 }}>Cette action est irréversible.</p>
            <div className="dialog-footer">
              <button className="btn-secondary materiel-footer-btn" onClick={() => setConfirmingDelete(false)}>Annuler</button>
              <button
                className="materiel-primary-btn"
                style={{ background: C.coral, color: '#fff' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      </Portal>
    )}
    <Portal>
      <div className="bottom-sheet-overlay" onClick={onClose}>
        <div className="bottom-sheet materiel-form-sheet" onClick={e => e.stopPropagation()}>
          <div className="bottom-sheet-handle" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="dialog-title" style={{ margin: 0 }}>{initialData ? 'Modifier le materiel' : 'Ajouter un materiel'}</div>
            {initialData && onDelete && (
              <button
                type="button"
                className="task-icon-btn"
                onClick={() => setConfirmingDelete(true)}
                style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#ef4444' }}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
            <div className="dialog-content" style={{ display: 'grid', gap: 12 }}>
              {error && (
                <div style={{ padding: '10px 12px', borderRadius: 12, background: C.coralD, color: C.coral, fontSize: 'var(--font-sm)', fontWeight: 600 }}>
                  {error}
                </div>
              )}

              <label className="form-label">Nom *</label>
              <input className="form-input" value={form.nom} onChange={e => updateField('nom', e.target.value)} />

              <div className="materiel-form-grid">
                <div>
                  <label className="form-label">Categorie *</label>
                  <select className="form-input" value={form.categorie} onChange={e => updateField('categorie', e.target.value)}>
                    {MATERIEL_CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Type</label>
                  <select className="form-input" value={form.type} onChange={e => updateField('type', e.target.value)}>
                    <option value="durable">Durable</option>
                    <option value="consommable">Consommable</option>
                  </select>
                </div>
              </div>

              <div className="materiel-form-grid">
                <div>
                  <label className="form-label">Quantite *</label>
                  <input className="form-input" type="number" min="0" value={form.quantite} onChange={e => updateField('quantite', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Unite</label>
                  <select className="form-input" value={form.unite} onChange={e => updateField('unite', e.target.value)}>
                    {MATERIEL_UNITES.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
              </div>

              <div className="materiel-form-grid">
                <div>
                  <label className="form-label">Etat</label>
                  <select className="form-input" value={form.etat} onChange={e => updateField('etat', e.target.value)}>
                    <option value="bon">Bon</option>
                    <option value="a_verifier">A verifier</option>
                    <option value="endommage">Endommage</option>
                    <option value="perdu">Perdu</option>
                    <option value="en_reparation">En reparation</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Statut</label>
                  <select className="form-input" value={form.statut} onChange={e => updateField('statut', e.target.value)}>
                    <option value="disponible">Disponible</option>
                    <option value="reserve">Reserve</option>
                    <option value="en_reparation">En reparation</option>
                    <option value="perdu">Perdu</option>
                    {form.type === 'consommable' && <option value="stock_faible">Stock faible</option>}
                  </select>
                </div>
              </div>

              <label className="form-label">Lieu actuel</label>
              <input className="form-input" value={form.lieuActuel} onChange={e => updateField('lieuActuel', e.target.value)} />

              <div>
                <label className="form-label">Responsables</label>
                {members.length === 0 ? (
                  <div className="task-empty-inline">Aucun membre disponible</div>
                ) : (
                  <div className="task-assignee-dropdown" ref={responsibleRef}>
                    <button
                      type="button"
                      className={`task-assignee-trigger${responsibleOpen ? ' open' : ''}`}
                      onClick={openResponsibleDropdown}
                    >
                      <span>
                        {selectedResponsibles.length === 0
                          ? 'Aucun responsable'
                          : `${selectedResponsibles.length} responsable${selectedResponsibles.length > 1 ? 's' : ''} selectionne${selectedResponsibles.length > 1 ? 's' : ''}`}
                      </span>
                      <ChevronDown size={16} />
                    </button>

                    {selectedResponsibles.length > 0 && (
                      <div className="task-selected-assignees">
                        {selectedResponsibles.map(member => (
                          <span key={member.id}>
                            {getMemberName(member)}
                            <button type="button" onClick={() => toggleResponsible(member.id)} aria-label={`Retirer ${getMemberName(member)}`}>
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {responsibleOpen && (
                      <div className="task-assignee-menu">
                        <div className="task-assignee-search">
                          <input
                            ref={searchRef}
                            type="search"
                            value={responsibleSearch}
                            onChange={e => setResponsibleSearch(e.target.value)}
                            placeholder="Rechercher un membre..."
                          />
                        </div>
                        <div className="task-assignee-options">
                          {filteredResponsibles.length === 0 ? (
                            <div className="task-assignee-empty">Aucun membre trouve</div>
                          ) : filteredResponsibles.map(member => {
                            const selected = form.responsablesIds.includes(member.id)
                            return (
                              <button
                                key={member.id}
                                type="button"
                                className={selected ? 'selected' : ''}
                                onClick={() => toggleResponsible(member.id, true)}
                              >
                                <span>
                                  {getMemberName(member)}
                                  <small>{member.email || member.telephone || 'Membre'}</small>
                                </span>
                                {selected && <Check size={16} />}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="materiel-form-grid">
                <div>
                  <label className="form-label">Valeur estimee</label>
                  <input className="form-input" type="number" min="0" value={form.valeurEstimee} onChange={e => updateField('valeurEstimee', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Seuil d'alerte</label>
                  <input className="form-input" type="number" min="0" value={form.seuilAlerte} onChange={e => updateField('seuilAlerte', e.target.value)} disabled={form.type !== 'consommable'} />
                </div>
              </div>

              <label className="form-label">Photo</label>
              <div className="materiel-photo-actions">
                <button
                  type="button"
                  className="btn-secondary materiel-photo-btn"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? 'Envoi...' : form.photoUrl ? 'Changer la photo' : 'Choisir une photo'}
                </button>
                {form.photoUrl && (
                  <button
                    type="button"
                    className="btn-secondary materiel-photo-btn"
                    onClick={() => updateField('photoUrl', '')}
                  >
                    Retirer
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
              {form.photoUrl && <img src={form.photoUrl} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 14 }} />}

              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                value={form.notes}
                onChange={e => updateField('notes', e.target.value)}
                rows={4}
                style={{ minHeight: 110, resize: 'vertical', lineHeight: 1.45, paddingTop: 10, paddingBottom: 10 }}
              />
            </div>

            <div className="dialog-footer">
              <button type="button" className="btn-secondary materiel-footer-btn" onClick={onClose}>Annuler</button>
              <button
                type="submit"
                className="materiel-primary-btn"
                disabled={saving || uploadingPhoto}
              >
                {saving ? 'Enregistrement...' : initialData ? 'Mettre a jour' : 'Ajouter'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
    </>
  )
}
