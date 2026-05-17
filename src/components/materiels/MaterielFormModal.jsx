import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Plus, Trash2, X } from 'lucide-react'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import Portal from '../Portal'
import { storage } from '../../firebaseStorage'
import { MATERIEL_CATEGORIES, MATERIEL_UNITES, TYPE_MATERIEL_OPTIONS } from './materielHelpers'

const EMPTY_FORM = {
  nom: '',
  section: '',
  categorie: 'Sonorisation',
  typeMatériel: 'principal',
  quantite: 1,
  unite: 'pièce',
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
  marque: '',
  couleur: '',
  dimensions: '',
  derniereVerification: '',
  kitElements: [],
  notes: '',
}

const MAX_IMAGE_HEIGHT = 500
const WEBP_QUALITY = 0.82

function createKitElement() {
  return { id: `el_${Date.now()}_${Math.random().toString(16).slice(2)}`, nom: '', quantitePrevue: 1, unite: 'pièce' }
}

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

export default function MaterielFormModal({ open, onClose, onSubmit, onDelete, members, sections, initialData, C, saving }) {
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
  const [addingSection, setAddingSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [localSections, setLocalSections] = useState([])

  useEffect(() => {
    if (!open) return
    const initialResponsablesIds = Array.isArray(initialData?.responsablesIds)
      ? initialData.responsablesIds
      : (initialData?.responsableId ? [initialData.responsableId] : [])
    const initialResponsablesNoms = Array.isArray(initialData?.responsablesNoms)
      ? initialData.responsablesNoms
      : (initialData?.responsableNom ? [initialData.responsableNom] : [])

    const derivedTypeMatériel = initialData?.typeMatériel
      || (initialData?.type === 'consommable' ? 'consommable_suivi' : initialData ? 'principal' : 'principal')

    setForm(initialData ? {
      ...EMPTY_FORM,
      ...initialData,
      section: initialData.section ?? '',
      typeMatériel: derivedTypeMatériel,
      responsablesIds: initialResponsablesIds,
      responsablesNoms: initialResponsablesNoms,
      valeurEstimee: initialData.valeurEstimee ?? '',
      seuilAlerte: initialData.seuilAlerte ?? '',
      marque: initialData.marque ?? '',
      couleur: initialData.couleur ?? '',
      dimensions: initialData.dimensions ?? '',
      derniereVerification: initialData.derniereVerification ?? '',
      kitElements: Array.isArray(initialData.kitElements) ? initialData.kitElements : [],
    } : EMPTY_FORM)
    setError('')
    setResponsibleSearch('')
    setResponsibleOpen(false)
    setUploadingPhoto(false)
    setAddingSection(false)
    setNewSectionName('')
    setLocalSections([])
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

  function addKitElement() {
    setForm(prev => ({ ...prev, kitElements: [...(prev.kitElements || []), createKitElement()] }))
  }

  function updateKitElement(id, patch) {
    setForm(prev => ({ ...prev, kitElements: (prev.kitElements || []).map(el => el.id === id ? { ...el, ...patch } : el) }))
  }

  function removeKitElement(id) {
    setForm(prev => ({ ...prev, kitElements: (prev.kitElements || []).filter(el => el.id !== id) }))
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
    if (!form.categorie.trim()) return setError('La catégorie est obligatoire.')
    if (Number(form.quantite) < 0) return setError('La quantité doit être positive.')
    if (form.typeMatériel === 'kit' && (form.kitElements || []).some(el => !el.nom.trim())) {
      return setError('Tous les éléments du kit doivent avoir un nom.')
    }

    const derivedType = form.typeMatériel === 'consommable_suivi' ? 'consommable' : 'durable'

    const payload = {
      ...form,
      type: derivedType,
      nom: form.nom.trim(),
      categorie: form.categorie.trim(),
      quantite: Number(form.quantite || 0),
      valeurEstimee: form.valeurEstimee === '' ? null : Number(form.valeurEstimee),
      seuilAlerte: form.seuilAlerte === '' ? null : Number(form.seuilAlerte),
      notes: form.notes.trim(),
      lieuActuel: form.lieuActuel.trim(),
      marque: form.marque.trim(),
      couleur: form.couleur.trim(),
      dimensions: form.dimensions.trim(),
      responsableId: form.responsablesIds[0] || '',
      responsableNom: form.responsablesNoms.join(', '),
      kitElements: form.typeMatériel === 'kit'
        ? (form.kitElements || []).filter(el => el.nom.trim()).map(el => ({ ...el, nom: el.nom.trim(), quantitePrevue: Number(el.quantitePrevue || 1) }))
        : [],
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

  const isKit = form.typeMatériel === 'kit'
  const isConsommable = form.typeMatériel === 'consommable_suivi'

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
            <div className="dialog-title" style={{ margin: 0 }}>{initialData ? 'Modifier le matériel' : 'Ajouter un matériel'}</div>
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
              <input className="form-input" value={form.nom} onChange={e => updateField('nom', e.target.value)} placeholder="Ex: Micro statique Shure SM58" />

              <div>
                <label className="form-label">Section</label>
                {addingSection ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="form-input"
                      style={{ flex: 1 }}
                      value={newSectionName}
                      onChange={e => setNewSectionName(e.target.value)}
                      placeholder="Nom de la section…"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const name = newSectionName.trim()
                          if (name) {
                            if (!localSections.includes(name)) setLocalSections(prev => [...prev, name])
                            updateField('section', name)
                          }
                          setAddingSection(false)
                          setNewSectionName('')
                        } else if (e.key === 'Escape') {
                          setAddingSection(false)
                          setNewSectionName('')
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const name = newSectionName.trim()
                        if (name) {
                          if (!localSections.includes(name)) setLocalSections(prev => [...prev, name])
                          updateField('section', name)
                        }
                        setAddingSection(false)
                        setNewSectionName('')
                      }}
                      style={{ flexShrink: 0, height: 42, padding: '0 14px', borderRadius: 12, border: 'none', background: C.teal, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 'var(--font-sm)', fontFamily: 'inherit' }}
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAddingSection(false); setNewSectionName('') }}
                      style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 12, border: `1px solid ${C.bord}`, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.t2 }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      className="form-input"
                      style={{ flex: 1 }}
                      value={form.section}
                      onChange={e => updateField('section', e.target.value)}
                    >
                      <option value="">— Aucune section —</option>
                      {[...new Set([...(sections || []), ...localSections])].sort().map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setAddingSection(true)}
                      title="Ajouter une section"
                      style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 12, border: `1px solid ${C.bord}`, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.teal }}
                    >
                      <Plus size={17} />
                    </button>
                  </div>
                )}
              </div>

              <div className="materiel-form-grid">
                <div>
                  <label className="form-label">Catégorie *</label>
                  <select className="form-input" value={form.categorie} onChange={e => updateField('categorie', e.target.value)}>
                    {MATERIEL_CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Type</label>
                  <select className="form-input" value={form.typeMatériel} onChange={e => updateField('typeMatériel', e.target.value)}>
                    {TYPE_MATERIEL_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="materiel-form-grid">
                <div>
                  <label className="form-label">Marque</label>
                  <input className="form-input" value={form.marque} onChange={e => updateField('marque', e.target.value)} placeholder="Shure, Yamaha…" />
                </div>
                <div>
                  <label className="form-label">Couleur</label>
                  <input className="form-input" value={form.couleur} onChange={e => updateField('couleur', e.target.value)} placeholder="Noir, rouge…" />
                </div>
              </div>

              <div>
                <label className="form-label">Dimensions / Taille</label>
                <input className="form-input" value={form.dimensions} onChange={e => updateField('dimensions', e.target.value)} placeholder="Ex: 120×60×75 cm" />
              </div>

              {!isKit && (
                <div className="materiel-form-grid">
                  <div>
                    <label className="form-label">Quantité *</label>
                    <input className="form-input" type="number" min="0" value={form.quantite} onChange={e => updateField('quantite', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Unité</label>
                    <select className="form-input" value={form.unite} onChange={e => updateField('unite', e.target.value)}>
                      {MATERIEL_UNITES.map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="materiel-form-grid">
                <div>
                  <label className="form-label">État</label>
                  <select className="form-input" value={form.etat} onChange={e => updateField('etat', e.target.value)}>
                    <option value="bon">Bon état</option>
                    <option value="a_verifier">À vérifier</option>
                    <option value="endommage">Endommagé</option>
                    <option value="perdu">Perdu</option>
                    <option value="en_reparation">En réparation</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Statut</label>
                  <select className="form-input" value={form.statut} onChange={e => updateField('statut', e.target.value)}>
                    <option value="disponible">Disponible</option>
                    <option value="reserve">Réservé</option>
                    <option value="en_reparation">En réparation</option>
                    <option value="perdu">Perdu</option>
                    {isConsommable && <option value="stock_faible">Stock faible</option>}
                  </select>
                </div>
              </div>

              <label className="form-label">Lieu actuel</label>
              <input className="form-input" value={form.lieuActuel} onChange={e => updateField('lieuActuel', e.target.value)} placeholder="Local YFC, Salle…" />

              <div>
                <label className="form-label">Dernière vérification</label>
                <input className="form-input" type="date" value={form.derniereVerification} onChange={e => updateField('derniereVerification', e.target.value)} />
              </div>

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
                          : `${selectedResponsibles.length} responsable${selectedResponsibles.length > 1 ? 's' : ''} sélectionné${selectedResponsibles.length > 1 ? 's' : ''}`}
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
                            <div className="task-assignee-empty">Aucun membre trouvé</div>
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
                  <label className="form-label">Valeur estimée</label>
                  <input className="form-input" type="number" min="0" value={form.valeurEstimee} onChange={e => updateField('valeurEstimee', e.target.value)} placeholder="Ar" />
                </div>
                <div>
                  <label className="form-label">Seuil d'alerte</label>
                  <input
                    className="form-input"
                    type="number" min="0"
                    value={form.seuilAlerte}
                    onChange={e => updateField('seuilAlerte', e.target.value)}
                    disabled={!isConsommable}
                    placeholder={isConsommable ? '' : 'Consommable uniquement'}
                  />
                </div>
              </div>

              {isKit && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label className="form-label" style={{ margin: 0 }}>Éléments du kit</label>
                    <button type="button" className="task-checklist-add" onClick={addKitElement} aria-label="Ajouter un élément">
                      <Plus size={15} />
                    </button>
                  </div>
                  {(form.kitElements || []).length === 0 ? (
                    <button type="button" className="task-checklist-create" onClick={addKitElement}>
                      <Plus size={15} /> Ajouter un élément
                    </button>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {(form.kitElements || []).map(el => (
                        <div key={el.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            className="form-input"
                            value={el.nom}
                            onChange={e => updateKitElement(el.id, { nom: e.target.value })}
                            placeholder="Nom de l'élément"
                            style={{ flex: 1 }}
                          />
                          <input
                            className="form-input"
                            type="number"
                            min="1"
                            value={el.quantitePrevue}
                            onChange={e => updateKitElement(el.id, { quantitePrevue: e.target.value })}
                            style={{ width: 60 }}
                          />
                          <select
                            className="form-input"
                            value={el.unite}
                            onChange={e => updateKitElement(el.id, { unite: e.target.value })}
                            style={{ width: 90 }}
                          >
                            {MATERIEL_UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeKitElement(el.id)}
                            style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, border: 'none', background: C.coralD, color: C.coral, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            aria-label="Retirer cet élément"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
                {saving ? 'Enregistrement...' : initialData ? 'Mettre à jour' : 'Ajouter'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
    </>
  )
}
