import { useEffect, useRef, useState } from 'react'
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
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i)
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

  const webpFile = new File([webpBlob], `${baseName}.webp`, { type: 'image/webp' })
  return { file: webpFile, width: targetWidth, height: targetHeight }
}

export default function MaterielFormModal({ open, onClose, onSubmit, members, initialData, C, saving }) {
  const fileRef = useRef()
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(initialData ? {
      ...EMPTY_FORM,
      ...initialData,
      valeurEstimee: initialData.valeurEstimee ?? '',
      seuilAlerte: initialData.seuilAlerte ?? '',
    } : EMPTY_FORM)
    setError('')
    setUploadingPhoto(false)
  }, [initialData, open])

  if (!open) return null

  function updateField(name, value) {
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function onResponsibleChange(value) {
    const member = members.find(item => item.id === value)
    setForm(prev => ({
      ...prev,
      responsableId: value,
      responsableNom: member ? (member.nomPrefere || member.prenoms || member.nom || '') : '',
    }))
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

      const processed = await toWebpWithMaxHeight(file)
      const storageRef = ref(storage, `materiels/${Date.now()}_${processed.file.name}`)
      const snapshot = await uploadBytes(storageRef, processed.file, { contentType: 'image/webp' })
      const url = await getDownloadURL(snapshot.ref)
      updateField('photoUrl', url)
    } catch (err) {
      setError(err?.message || "Impossible d'envoyer la photo.")
    }
    setUploadingPhoto(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nom.trim()) return setError('Le nom est obligatoire.')
    if (!form.categorie.trim()) return setError('La catégorie est obligatoire.')
    if (Number(form.quantite) < 0) return setError('La quantité doit être positive.')

    const payload = {
      ...form,
      nom: form.nom.trim(),
      categorie: form.categorie.trim(),
      quantite: Number(form.quantite || 0),
      valeurEstimee: form.valeurEstimee === '' ? null : Number(form.valeurEstimee),
      seuilAlerte: form.seuilAlerte === '' ? null : Number(form.seuilAlerte),
      notes: form.notes.trim(),
      lieuActuel: form.lieuActuel.trim(),
    }
    setError('')
    await onSubmit(payload)
  }

  return (
    <Portal>
      <div className="bottom-sheet-overlay" onClick={onClose}>
        <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
          <div className="bottom-sheet-handle" />
          <div className="dialog-title mb-16">{initialData ? 'Modifier le matériel' : 'Ajouter un matériel'}</div>
          {error && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: C.coralD, color: C.coral, fontSize: 'var(--font-sm)', fontWeight: 600 }}>{error}</div>}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
            <label className="form-label">Nom *</label>
            <input className="form-input" value={form.nom} onChange={e => updateField('nom', e.target.value)} />
            <div className="materiel-form-grid">
              <div>
                <label className="form-label">Catégorie *</label>
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
            <div className="materiel-form-grid">
              <div>
                <label className="form-label">État</label>
                <select className="form-input" value={form.etat} onChange={e => updateField('etat', e.target.value)}>
                  <option value="bon">Bon</option>
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
                  {form.type === 'consommable' && <option value="stock_faible">Stock faible</option>}
                </select>
              </div>
            </div>
            <label className="form-label">Lieu actuel</label>
            <input className="form-input" value={form.lieuActuel} onChange={e => updateField('lieuActuel', e.target.value)} />
            <label className="form-label">Responsable</label>
            <select className="form-input" value={form.responsableId} onChange={e => onResponsibleChange(e.target.value)}>
              <option value="">Aucun</option>
              {members.map(member => (
                <option key={member.id} value={member.id}>{member.nomPrefere || member.prenoms || member.nom}</option>
              ))}
            </select>
            <div className="materiel-form-grid">
              <div>
                <label className="form-label">Valeur estimée</label>
                <input className="form-input" type="number" min="0" value={form.valeurEstimee} onChange={e => updateField('valeurEstimee', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Seuil d'alerte</label>
                <input className="form-input" type="number" min="0" value={form.seuilAlerte} onChange={e => updateField('seuilAlerte', e.target.value)} disabled={form.type !== 'consommable'} />
              </div>
            </div>
            <label className="form-label">Photo</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}>{uploadingPhoto ? 'Envoi...' : 'Choisir une photo'}</button>
              {form.photoUrl && <button type="button" className="btn-secondary" onClick={() => updateField('photoUrl', '')}>Retirer</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
            {form.photoUrl && <img src={form.photoUrl} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 14 }} />}
            <label className="form-label">Notes</label>
            <textarea className="form-input" value={form.notes} onChange={e => updateField('notes', e.target.value)} rows={4} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
              <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
              <button type="submit" style={{ border: 'none', borderRadius: 12, background: C.teal, color: '#fff', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', padding: 12, opacity: saving ? 0.6 : 1 }} disabled={saving || uploadingPhoto}>
                {saving ? 'Enregistrement...' : initialData ? 'Mettre à jour' : 'Ajouter'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  )
}
