import { useEffect, useState } from 'react'
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import Portal from '../Portal'
import { db } from '../../firebase'
import { createNotification } from '../../notifications'
import { canDeleteMateriel, canEditMateriel } from '../../utils/materielPermissions'
import { computeStockStatus, formatMovementLabel, getEtatMeta, getStatutMeta } from './materielHelpers'

function MovementRow({ movement, C }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: `1px solid ${C.bord}` }}>
      <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: C.t1 }}>{formatMovementLabel(movement.type)}</div>
      <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 2 }}>
        {movement.createdAt ? new Date(movement.createdAt).toLocaleString('fr-FR') : 'Date inconnue'} · {movement.userName || 'Utilisateur'}
      </div>
      {movement.commentaire && <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 4 }}>{movement.commentaire}</div>}
      {(movement.dateRetourPrevue || movement.dateRetourReelle) && (
        <div style={{ fontSize: 'var(--font-xs)', color: C.t3, marginTop: 4 }}>
          {movement.dateRetourPrevue && <span>Retour prévu : {new Date(movement.dateRetourPrevue).toLocaleDateString('fr-FR')}</span>}
          {movement.dateRetourPrevue && movement.dateRetourReelle && <span> · </span>}
          {movement.dateRetourReelle && <span>Retour réel : {new Date(movement.dateRetourReelle).toLocaleDateString('fr-FR')}</span>}
        </div>
      )}
      {(movement.quantite != null || movement.etatAvant || movement.etatApres) && (
        <div style={{ fontSize: 'var(--font-xs)', color: C.t3, marginTop: 4 }}>
          {movement.quantite != null && <span>Quantité : {movement.quantite}</span>}
          {movement.quantite != null && (movement.etatAvant || movement.etatApres) && <span> · </span>}
          {movement.etatAvant && <span>Avant : {movement.etatAvant}</span>}
          {movement.etatAvant && movement.etatApres && <span> · </span>}
          {movement.etatApres && <span>Après : {movement.etatApres}</span>}
        </div>
      )}
    </div>
  )
}

function ActionModal({ title, fields, onClose, onConfirm, saving, C }) {
  const [form, setForm] = useState(() => Object.fromEntries(fields.map(field => [field.name, field.defaultValue ?? ''])))

  return (
    <Portal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="dialog-title" style={{ marginBottom: 14 }}>{title}</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {fields.map(field => (
              <div key={field.name}>
                <label className="form-label">{field.label}{field.required ? ' *' : ''}</label>
                {field.type === 'textarea' ? (
                  <textarea className="form-input" rows={4} value={form[field.name]} onChange={e => setForm(prev => ({ ...prev, [field.name]: e.target.value }))} />
                ) : field.type === 'select' ? (
                  <select className="form-input" value={form[field.name]} onChange={e => setForm(prev => ({ ...prev, [field.name]: e.target.value }))}>
                    {field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : (
                  <input className="form-input" type={field.type || 'text'} min={field.min} value={form[field.name]} onChange={e => setForm(prev => ({ ...prev, [field.name]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
          <div className="dialog-footer" style={{ marginTop: 18 }}>
            <button className="btn-secondary" onClick={onClose}>Annuler</button>
            <button
              style={{ border: 'none', borderRadius: 12, background: C.teal, color: '#fff', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', padding: '12px 16px', opacity: saving ? 0.6 : 1 }}
              disabled={saving}
              onClick={() => onConfirm(form)}
            >
              {saving ? 'Enregistrement...' : 'Confirmer'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}

export default function MaterielDetailModal({
  materiel, open, onClose, onRefresh, onEdit, C, user, userData, currentMember,
}) {
  const [movements, setMovements] = useState([])
  const [action, setAction] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !materiel?.id) return undefined
    const q = query(collection(db, 'mouvementsMateriels'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      setMovements(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(item => item.materielId === materiel.id))
    })
  }, [materiel?.id, open])

  if (!open || !materiel) return null

  const canEdit = canEditMateriel(user, userData, currentMember)
  const canArchive = canDeleteMateriel(user, userData, currentMember)
  const statut = getStatutMeta(materiel.statut, C)
  const etat = getEtatMeta(materiel.etat, C)

  async function addMovement(type, extra = {}) {
    await addDoc(collection(db, 'mouvementsMateriels'), {
      materielId: materiel.id,
      materielNom: materiel.nom,
      type,
      userId: user.uid,
      userName: userData?.nom || user.email,
      dateSortie: extra.dateSortie || null,
      dateRetourPrevue: extra.dateRetourPrevue || null,
      dateRetourReelle: extra.dateRetourReelle || null,
      evenementNom: extra.evenementNom || null,
      personneResponsable: extra.personneResponsable || null,
      quantite: extra.quantite ?? null,
      etatAvant: extra.etatAvant || null,
      etatApres: extra.etatApres || null,
      commentaire: extra.commentaire || '',
      createdAt: new Date().toISOString(),
      createdAtServer: serverTimestamp(),
    })
  }

  async function updateMateriel(patch, movementType, movementData, notificationTitle) {
    setSaving(true)
    try {
      const next = { ...patch, updatedAt: serverTimestamp() }
      await updateDoc(doc(db, 'materiels', materiel.id), next)
      await addMovement(movementType, movementData)
      if (notificationTitle) {
        await createNotification({
          type: 'document',
          titre: notificationTitle,
          detail: materiel.nom,
          cible: materiel.nom,
          route: '/documents',
        })
      }
      setAction(null)
      onRefresh?.()
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive() {
    if (!window.confirm(`Archiver ${materiel.nom} ?`)) return
    await updateMateriel(
      { statut: 'archive', archivedAt: new Date().toISOString() },
      'archivage',
      { commentaire: 'Archivage du matériel' },
      'Matériel archivé'
    )
  }

  const actionConfig = {
    sortie: {
      title: 'Sortir le matériel',
      fields: [
        { name: 'personneResponsable', label: 'Personne qui prend', required: true },
        { name: 'evenementNom', label: 'Motif ou événement' },
        { name: 'dateSortie', label: 'Date de sortie', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
        { name: 'dateRetourPrevue', label: 'Date de retour prévue', type: 'date', required: true },
        {
          name: 'etatAvant',
          label: 'État avant sortie',
          type: 'select',
          defaultValue: materiel.etat,
          options: [
            { value: 'bon', label: 'Bon' },
            { value: 'a_verifier', label: 'À vérifier' },
            { value: 'endommage', label: 'Endommagé' },
            { value: 'en_reparation', label: 'En réparation' },
            { value: 'perdu', label: 'Perdu' },
          ],
        },
        { name: 'commentaire', label: 'Commentaire', type: 'textarea' },
      ],
      async confirm(form) {
        if (!form.personneResponsable || !form.dateRetourPrevue) return
        await updateMateriel({
          statut: 'emprunte',
          lieuActuel: form.personneResponsable,
          responsableNom: form.personneResponsable,
          currentBorrower: form.personneResponsable,
          currentDueAt: form.dateRetourPrevue,
          currentBorrowedAt: form.dateSortie,
          currentEventName: form.evenementNom || '',
        }, 'sortie', form, 'Matériel sorti')
      },
    },
    retour: {
      title: 'Retour du matériel',
      fields: [
        { name: 'dateRetourReelle', label: 'Date de retour réelle', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
        {
          name: 'etatApres',
          label: 'État au retour',
          type: 'select',
          defaultValue: materiel.etat,
          options: [
            { value: 'bon', label: 'Bon' },
            { value: 'a_verifier', label: 'À vérifier' },
            { value: 'endommage', label: 'Endommagé' },
            { value: 'en_reparation', label: 'En réparation' },
            { value: 'perdu', label: 'Perdu' },
          ],
        },
        { name: 'lieuActuel', label: 'Lieu de retour', required: true, defaultValue: materiel.lieuActuel || 'Local YFC' },
        { name: 'commentaire', label: 'Commentaire', type: 'textarea' },
      ],
      async confirm(form) {
        const nextStatut = form.etatApres === 'bon' ? 'disponible' : form.etatApres === 'perdu' ? 'perdu' : 'en_reparation'
        await updateMateriel({
          statut: nextStatut,
          etat: form.etatApres,
          lieuActuel: form.lieuActuel,
          responsableNom: '',
          currentBorrower: '',
          currentDueAt: null,
          currentBorrowedAt: null,
          currentEventName: '',
        }, 'retour', { ...form, etatAvant: materiel.etat }, 'Matériel retourné')
      },
    },
    stock_ajout: {
      title: 'Ajouter du stock',
      fields: [
        { name: 'quantite', label: 'Quantité ajoutée', type: 'number', min: '1', required: true, defaultValue: 1 },
        { name: 'commentaire', label: 'Commentaire', type: 'textarea' },
      ],
      async confirm(form) {
        const quantity = Number(form.quantite || 0)
        if (quantity <= 0) return
        const nextQty = Number(materiel.quantite || 0) + quantity
        await updateMateriel({
          quantite: nextQty,
          statut: computeStockStatus({ ...materiel, quantite: nextQty }),
        }, 'stock_ajout', { quantite: quantity, commentaire: form.commentaire }, 'Stock matériel ajouté')
      },
    },
    stock_retrait: {
      title: 'Retirer du stock',
      fields: [
        { name: 'quantite', label: 'Quantité retirée', type: 'number', min: '1', required: true, defaultValue: 1 },
        { name: 'commentaire', label: 'Commentaire', type: 'textarea' },
      ],
      async confirm(form) {
        const quantity = Number(form.quantite || 0)
        const current = Number(materiel.quantite || 0)
        if (quantity <= 0 || quantity > current) return
        const nextQty = current - quantity
        await updateMateriel({
          quantite: nextQty,
          statut: computeStockStatus({ ...materiel, quantite: nextQty }),
        }, 'stock_retrait', { quantite: quantity, commentaire: form.commentaire }, 'Stock matériel retiré')
      },
    },
    maintenance: {
      title: 'Mettre en réparation',
      fields: [{ name: 'commentaire', label: 'Commentaire', type: 'textarea' }],
      async confirm(form) {
        await updateMateriel(
          { etat: 'en_reparation', statut: 'en_reparation' },
          'maintenance',
          { etatAvant: materiel.etat, etatApres: 'en_reparation', commentaire: form.commentaire },
          'Matériel en réparation'
        )
      },
    },
    perte: {
      title: 'Marquer comme perdu',
      fields: [{ name: 'commentaire', label: 'Commentaire', type: 'textarea' }],
      async confirm(form) {
        await updateMateriel(
          { etat: 'perdu', statut: 'perdu' },
          'perte',
          { etatAvant: materiel.etat, etatApres: 'perdu', commentaire: form.commentaire },
          'Matériel perdu'
        )
      },
    },
  }

  return (
    <Portal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal materiel-detail-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ width: 88, height: 88, borderRadius: 18, overflow: 'hidden', background: C.surf2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {materiel.photoUrl ? <img src={materiel.photoUrl} alt={materiel.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ fontSize: 28, color: C.teal }}>□</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div className="dialog-title" style={{ marginBottom: 6 }}>{materiel.nom}</div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={onEdit}
                    style={{
                      border: '1px solid rgba(16,181,163,.22)',
                      borderRadius: 12,
                      background: C.tealD,
                      color: C.teal,
                      padding: '10px 12px',
                      fontWeight: 700,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Modifier
                  </button>
                )}
              </div>
              <div style={{ fontSize: 'var(--font-sm)', color: C.t2 }}>{materiel.categorie} · {materiel.type === 'consommable' ? 'Consommable' : 'Durable'}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                <span style={{ padding: '5px 10px', borderRadius: 999, background: statut.bg, color: statut.fg, fontSize: 'var(--font-xs)', fontWeight: 700 }}>{statut.label}</span>
                <span style={{ padding: '5px 10px', borderRadius: 999, background: etat.bg, color: etat.fg, fontSize: 'var(--font-xs)', fontWeight: 700 }}>{etat.label}</span>
              </div>
            </div>
          </div>

          <div className="materiel-detail-grid">
            <div><strong>Quantité</strong><div>{materiel.quantite || 0} {materiel.unite || 'pièce'}</div></div>
            <div><strong>Lieu</strong><div>{materiel.lieuActuel || 'Non renseigné'}</div></div>
            <div><strong>Responsable</strong><div>{materiel.responsableNom || 'Aucun'}</div></div>
            <div><strong>Valeur estimée</strong><div>{materiel.valeurEstimee != null ? `${Number(materiel.valeurEstimee).toLocaleString('fr-FR')} Ar` : 'Non renseignée'}</div></div>
            {materiel.currentDueAt && <div><strong>Retour prévu</strong><div>{new Date(materiel.currentDueAt).toLocaleDateString('fr-FR')}</div></div>}
            {materiel.seuilAlerte != null && <div><strong>Seuil d'alerte</strong><div>{materiel.seuilAlerte}</div></div>}
          </div>

          {materiel.notes && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: C.t3, textTransform: 'uppercase', marginBottom: 6 }}>Notes</div>
              <div style={{ fontSize: 'var(--font-sm)', color: C.t2, lineHeight: 1.5 }}>{materiel.notes}</div>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
            {canEdit && materiel.type === 'durable' && materiel.statut === 'disponible' && <button className="btn-secondary" onClick={() => setAction('sortie')}>Sortir</button>}
            {canEdit && materiel.type === 'durable' && materiel.statut === 'emprunte' && <button className="btn-secondary" onClick={() => setAction('retour')}>Retourner</button>}
            {canEdit && materiel.type === 'consommable' && <button className="btn-secondary" onClick={() => setAction('stock_ajout')}>Ajouter du stock</button>}
            {canEdit && materiel.type === 'consommable' && <button className="btn-secondary" onClick={() => setAction('stock_retrait')}>Retirer du stock</button>}
            {canEdit && materiel.etat !== 'en_reparation' && materiel.statut !== 'archive' && <button className="btn-secondary" onClick={() => setAction('maintenance')}>Mettre en réparation</button>}
            {canEdit && materiel.statut !== 'perdu' && materiel.statut !== 'archive' && <button className="btn-secondary" onClick={() => setAction('perte')}>Marquer comme perdu</button>}
            {canArchive && materiel.statut !== 'archive' && <button className="btn-secondary" onClick={handleArchive}>Archiver</button>}
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: C.t3, textTransform: 'uppercase', marginBottom: 8 }}>Historique</div>
            {movements.length === 0 ? (
              <div style={{ color: C.t2, fontSize: 'var(--font-sm)' }}>Aucun mouvement pour le moment.</div>
            ) : (
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {movements.map(item => <MovementRow key={item.id} movement={item} C={C} />)}
              </div>
            )}
          </div>

          <div className="dialog-footer" style={{ marginTop: 18 }}>
            <button className="btn-secondary" onClick={onClose}>Fermer</button>
          </div>
        </div>
      </div>
      {action && (
        <ActionModal
          title={actionConfig[action].title}
          fields={actionConfig[action].fields}
          onClose={() => setAction(null)}
          onConfirm={actionConfig[action].confirm}
          saving={saving}
          C={C}
        />
      )}
    </Portal>
  )
}
