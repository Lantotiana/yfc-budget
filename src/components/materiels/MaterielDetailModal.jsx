import { useEffect, useState } from 'react'
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { Camera } from 'lucide-react'
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
          {movement.dateRetourPrevue && <span>Retour prevu : {new Date(movement.dateRetourPrevue).toLocaleDateString('fr-FR')}</span>}
          {movement.dateRetourPrevue && movement.dateRetourReelle && <span> · </span>}
          {movement.dateRetourReelle && <span>Retour reel : {new Date(movement.dateRetourReelle).toLocaleDateString('fr-FR')}</span>}
        </div>
      )}
      {(movement.quantite != null || movement.etatAvant || movement.etatApres) && (
        <div style={{ fontSize: 'var(--font-xs)', color: C.t3, marginTop: 4 }}>
          {movement.quantite != null && <span>Quantite : {movement.quantite}</span>}
          {movement.quantite != null && (movement.etatAvant || movement.etatApres) && <span> · </span>}
          {movement.etatAvant && <span>Avant : {movement.etatAvant}</span>}
          {movement.etatAvant && movement.etatApres && <span> · </span>}
          {movement.etatApres && <span>Apres : {movement.etatApres}</span>}
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
          <div className="dialog-footer materiel-action-footer">
            <button className="btn-secondary materiel-footer-btn" onClick={onClose}>Annuler</button>
            <button
              className="materiel-primary-btn"
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
  const responsables = Array.isArray(materiel.responsablesNoms) && materiel.responsablesNoms.length > 0
    ? materiel.responsablesNoms.join(', ')
    : materiel.responsableNom

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
      { commentaire: 'Archivage du materiel' },
      'Materiel archive'
    )
  }

  const actionConfig = {
    sortie: {
      title: 'Sortir le materiel',
      fields: [
        { name: 'personneResponsable', label: 'Personne qui prend', required: true },
        { name: 'evenementNom', label: 'Motif ou evenement' },
        { name: 'dateSortie', label: 'Date de sortie', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
        { name: 'dateRetourPrevue', label: 'Date de retour prevue', type: 'date', required: true },
        { name: 'etatAvant', label: 'Etat avant sortie', type: 'select', defaultValue: materiel.etat, options: [
          { value: 'bon', label: 'Bon' }, { value: 'a_verifier', label: 'A verifier' }, { value: 'endommage', label: 'Endommage' }, { value: 'en_reparation', label: 'En reparation' }, { value: 'perdu', label: 'Perdu' },
        ] },
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
        }, 'sortie', form, 'Materiel sorti')
      },
    },
    retour: {
      title: 'Retour du materiel',
      fields: [
        { name: 'dateRetourReelle', label: 'Date de retour reelle', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
        { name: 'etatApres', label: 'Etat au retour', type: 'select', defaultValue: materiel.etat, options: [
          { value: 'bon', label: 'Bon' }, { value: 'a_verifier', label: 'A verifier' }, { value: 'endommage', label: 'Endommage' }, { value: 'en_reparation', label: 'En reparation' }, { value: 'perdu', label: 'Perdu' },
        ] },
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
        }, 'retour', { ...form, etatAvant: materiel.etat }, 'Materiel retourne')
      },
    },
    stock_ajout: {
      title: 'Ajouter du stock',
      fields: [
        { name: 'quantite', label: 'Quantite ajoutee', type: 'number', min: '1', required: true, defaultValue: 1 },
        { name: 'commentaire', label: 'Commentaire', type: 'textarea' },
      ],
      async confirm(form) {
        const quantity = Number(form.quantite || 0)
        if (quantity <= 0) return
        const nextQty = Number(materiel.quantite || 0) + quantity
        await updateMateriel({
          quantite: nextQty,
          statut: computeStockStatus({ ...materiel, quantite: nextQty }),
        }, 'stock_ajout', { quantite: quantity, commentaire: form.commentaire }, 'Stock materiel ajoute')
      },
    },
    stock_retrait: {
      title: 'Retirer du stock',
      fields: [
        { name: 'quantite', label: 'Quantite retiree', type: 'number', min: '1', required: true, defaultValue: 1 },
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
        }, 'stock_retrait', { quantite: quantity, commentaire: form.commentaire }, 'Stock materiel retire')
      },
    },
    maintenance: {
      title: 'Mettre en reparation',
      fields: [{ name: 'commentaire', label: 'Commentaire', type: 'textarea' }],
      async confirm(form) {
        await updateMateriel({ etat: 'en_reparation', statut: 'en_reparation' }, 'maintenance', { etatAvant: materiel.etat, etatApres: 'en_reparation', commentaire: form.commentaire }, 'Materiel en reparation')
      },
    },
    perte: {
      title: 'Marquer comme perdu',
      fields: [{ name: 'commentaire', label: 'Commentaire', type: 'textarea' }],
      async confirm(form) {
        await updateMateriel({ etat: 'perdu', statut: 'perdu' }, 'perte', { etatAvant: materiel.etat, etatApres: 'perdu', commentaire: form.commentaire }, 'Materiel perdu')
      },
    },
  }

  return (
    <Portal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal materiel-detail-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
          <div className="materiel-detail-content">
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
              <div className="materiel-detail-photo" style={{ background: C.surf2 }}>
                {materiel.photoUrl ? (
                  <img src={materiel.photoUrl} alt={materiel.nom} />
                ) : (
                  <Camera size={30} color={C.teal} strokeWidth={2.2} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div className="dialog-title" style={{ marginBottom: 6 }}>{materiel.nom}</div>
                <div style={{ fontSize: 'var(--font-sm)', color: C.t2 }}>{materiel.categorie} · {materiel.type === 'consommable' ? 'Consommable' : 'Durable'}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  <span style={{ padding: '5px 10px', borderRadius: 999, background: statut.bg, color: statut.fg, fontSize: 'var(--font-xs)', fontWeight: 700 }}>{statut.label}</span>
                  <span style={{ padding: '5px 10px', borderRadius: 999, background: etat.bg, color: etat.fg, fontSize: 'var(--font-xs)', fontWeight: 700 }}>{etat.label}</span>
                </div>
              </div>
            </div>

            <div className="materiel-detail-grid">
              <div><strong>Quantite</strong><div>{materiel.quantite || 0} {materiel.unite || 'piece'}</div></div>
              <div><strong>Lieu</strong><div>{materiel.lieuActuel || 'Non renseigne'}</div></div>
              <div><strong>Responsables</strong><div>{responsables || 'Aucun'}</div></div>
              <div><strong>Valeur estimee</strong><div>{materiel.valeurEstimee != null ? `${Number(materiel.valeurEstimee).toLocaleString('fr-FR')} Ar` : 'Non renseignee'}</div></div>
              {materiel.currentDueAt && <div><strong>Retour prevu</strong><div>{new Date(materiel.currentDueAt).toLocaleDateString('fr-FR')}</div></div>}
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
              {canEdit && materiel.etat !== 'en_reparation' && materiel.statut !== 'archive' && <button className="btn-secondary" onClick={() => setAction('maintenance')}>Mettre en reparation</button>}
              {canEdit && materiel.statut !== 'perdu' && materiel.statut !== 'archive' && <button className="btn-secondary" onClick={() => setAction('perte')}>Marquer comme perdu</button>}
              {canArchive && materiel.statut !== 'archive' && <button className="btn-secondary" onClick={handleArchive}>Archiver</button>}
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: C.t3, textTransform: 'uppercase', marginBottom: 8 }}>Historique</div>
              {movements.length === 0 ? (
                <div style={{ color: C.t2, fontSize: 'var(--font-sm)' }}>Aucun mouvement pour le moment.</div>
              ) : (
                <div>
                  {movements.map(item => <MovementRow key={item.id} movement={item} C={C} />)}
                </div>
              )}
            </div>
          </div>

          <div className="dialog-footer materiel-detail-footer">
            <div className="materiel-detail-footer-main">
              <button className="btn-secondary materiel-footer-btn" onClick={onClose}>Fermer</button>
              {canEdit && (
                <button
                  className="materiel-primary-btn"
                  onClick={onEdit}
                >
                  Modifier
                </button>
              )}
            </div>
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
