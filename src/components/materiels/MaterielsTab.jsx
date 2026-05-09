import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { Search, X } from 'lucide-react'
import { db } from '../../firebase'
import { createNotification } from '../../notifications'
import { canEditMateriel, canManageMateriels } from '../../utils/materielPermissions'
import MaterielCard from './MaterielCard'
import MaterielFormModal from './MaterielFormModal'
import MaterielDetailModal from './MaterielDetailModal'
import { computeStockStatus } from './materielHelpers'

function getDisplayName(member) {
  return member?.nomPrefere || member?.prenoms || member?.nom || ''
}

function buildSearchValue(item) {
  return [
    item.nom,
    item.categorie,
    item.responsableNom,
    ...(Array.isArray(item.responsablesNoms) ? item.responsablesNoms : []),
    item.lieuActuel,
    item.notes,
  ].filter(Boolean).join(' ').toLowerCase()
}

export default function MaterielsTab({ user, userData, C, onAddReady }) {
  const [materiels, setMateriels] = useState([])
  const [members, setMembers] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'materiels'), orderBy('updatedAt', 'desc'))
    return onSnapshot(q, snap => {
      setMateriels(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'membres'), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  const currentMember = useMemo(() => {
    const email = (user?.email || '').trim().toLowerCase()
    return members.find(member => String(member.email || '').trim().toLowerCase() === email) || null
  }, [members, user?.email])

  const canManage = canManageMateriels(user, userData, currentMember)
  const canEdit = canEditMateriel(user, userData, currentMember)

  useEffect(() => {
    onAddReady?.(canManage ? () => { setEditing(null); setShowForm(true) } : null)
  }, [canManage, onAddReady])

  const visibleMateriels = useMemo(() => {
    return materiels.filter(item => {
      if (statusFilter === 'overdue') {
        if (!(item.statut === 'emprunte' && item.currentDueAt && new Date(item.currentDueAt) < new Date(new Date().toDateString()))) return false
      } else if (statusFilter !== 'all' && item.statut !== statusFilter) return false
if (search.trim() && !buildSearchValue(item).includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [materiels, search, statusFilter])

  const stats = useMemo(() => {
    const total = materiels.filter(item => item.statut !== 'archive').length
    const available = materiels.filter(item => item.statut === 'disponible').length
    const borrowed = materiels.filter(item => item.statut === 'emprunte').length
    const repairing = materiels.filter(item => item.statut === 'en_reparation').length
    const low = materiels.filter(item => item.statut === 'stock_faible').length
    const overdue = materiels.filter(item => item.statut === 'emprunte' && item.currentDueAt && new Date(item.currentDueAt) < new Date(new Date().toDateString())).length
    return { total, available, borrowed, repairing, low, overdue }
  }, [materiels])

  const STAT_CARDS = [
    { label: 'Total', value: stats.total, color: C.teal, filterKey: null },
    { label: 'Disponibles', value: stats.available, color: C.teal, filterKey: 'disponible' },
    { label: 'Empruntés', value: stats.borrowed, color: C.amber, filterKey: 'emprunte' },
    { label: 'En réparation', value: stats.repairing, color: C.violet, filterKey: 'en_reparation' },
    { label: 'Stock faible', value: stats.low, color: C.coral, filterKey: 'stock_faible' },
    { label: 'En retard', value: stats.overdue, color: C.coral, filterKey: 'overdue' },
  ]

  async function createMovement(type, materiel, extra = {}) {
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

  async function handleSaveMateriel(payload) {
    setSaving(true)
    setError('')
    try {
      const responsablesIds = Array.isArray(payload.responsablesIds)
        ? payload.responsablesIds
        : (payload.responsableId ? [payload.responsableId] : [])
      const responsablesNoms = responsablesIds
        .map(id => getDisplayName(members.find(item => item.id === id)))
        .filter(Boolean)
      const normalized = {
        ...payload,
        responsablesIds,
        responsablesNoms,
        responsableId: responsablesIds[0] || '',
        responsableNom: responsablesNoms.join(', '),
      }

      if (editing) {
        const next = {
          ...normalized,
          statut: computeStockStatus(normalized),
          updatedAt: serverTimestamp(),
        }
        await updateDoc(doc(db, 'materiels', editing.id), next)
        await createMovement('modification', editing, { commentaire: 'Fiche matériel modifiée' })
      } else {
        const docRef = await addDoc(collection(db, 'materiels'), {
          ...normalized,
          statut: computeStockStatus(normalized),
          createdBy: user.uid,
          createdByName: userData?.nom || user.email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          archivedAt: null,
          currentBorrower: '',
          currentDueAt: null,
          currentBorrowedAt: null,
          currentEventName: '',
        })
        await createMovement('creation', { id: docRef.id, nom: normalized.nom }, { commentaire: 'Création du matériel' })
        await createNotification({
          type: 'document',
          titre: 'Matériel ajouté',
          detail: normalized.nom,
          cible: normalized.nom,
          route: '/documents',
        })
      }
      setShowForm(false)
      setEditing(null)
    } catch (err) {
      setError(err?.message || "Impossible d'enregistrer ce matériel.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteMateriel() {
    if (!confirmDel) return
    try {
      await deleteDoc(doc(db, 'materiels', confirmDel.id))
    } catch (err) {
      setError(err?.message || 'Impossible de supprimer ce matériel.')
    }
    setConfirmDel(null)
  }

  return (
    <div>
      <div className="tx-search-wrapper" style={{ marginBottom: 12 }}>
        <div className="tx-search-icon"><Search size={14} /></div>
        <input
          className="tx-search-input"
          type="search"
          placeholder="Rechercher un matériel..."
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

      <div className="materiel-stats-grid">
        {STAT_CARDS.map(({ label, value, color, filterKey }) => {
          const active = filterKey !== null && statusFilter === filterKey
          const Tag = filterKey !== null ? 'button' : 'div'
          return (
            <Tag
              key={label}
              type={filterKey !== null ? 'button' : undefined}
              className="materiel-stat-card"
              onClick={filterKey !== null ? () => setStatusFilter(active ? 'all' : filterKey) : undefined}
              style={{
                background: active ? color + '18' : C.surf,
                border: `${active ? 2 : 1}px solid ${active ? color : C.bord}`,
                borderRadius: 16,
                padding: '10px 14px',
                textAlign: 'left',
                cursor: filterKey !== null ? 'pointer' : 'default',
                width: '100%',
              }}
            >
              <span style={{ fontSize: 'var(--font-xs)', color: active ? color : C.t2, fontWeight: 500 }}>{label}</span>
              <span style={{ fontSize: 'var(--font-sm)', fontWeight: 800, color, flexShrink: 0 }}>{value}</span>
            </Tag>
          )
        })}
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: '12px 14px', borderRadius: 14, background: C.coralD, color: C.coral, fontSize: 'var(--font-sm)', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div className="materiel-cards-grid" style={{ marginTop: 16 }}>
        {visibleMateriels.length === 0 ? (
          <div style={{ padding: '2rem 0', color: C.t2, textAlign: 'center', fontSize: 'var(--font-sm)' }}>
            {materiels.length === 0 ? 'Aucun matériel enregistré pour le moment.' : 'Ce matériel est introuvable.'}
          </div>
        ) : visibleMateriels.map(item => (
          <MaterielCard key={item.id} materiel={item} C={C} onOpen={() => setSelected(item)} onDelete={canManage ? () => setConfirmDel(item) : undefined} />
        ))}
      </div>

      <MaterielFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null) }}
        onSubmit={handleSaveMateriel}
        members={members}
        initialData={editing}
        C={C}
        saving={saving}
      />

      <MaterielDetailModal
        materiel={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        onRefresh={() => setSelected(prev => prev ? { ...prev } : prev)}
        onEdit={() => { setEditing(selected); setShowForm(true); setSelected(null) }}
        C={C}
        user={user}
        userData={userData}
        currentMember={currentMember}
      />

      {confirmDel && (
        <div className="modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title" style={{ marginBottom: 8 }}>Supprimer ce matériel ?</h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: 'var(--font-sm)', color: C.t2 }}>
              « {confirmDel.nom} » sera définitivement supprimé.
            </p>
            <div className="dialog-footer">
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, padding: 12, border: `1.5px solid ${C.bord2}`, borderRadius: 12, background: 'transparent', color: C.t2, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button onClick={handleDeleteMateriel} style={{ flex: 1, padding: 12, border: 'none', borderRadius: 12, background: C.coral, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {!canEdit && (
        <div style={{ marginTop: 16, background: C.surf2, borderRadius: 14, padding: 14, fontSize: 'var(--font-xs)', color: C.t2 }}>
          Lecture seule : seuls les responsables autorisés peuvent gérer les matériels.
        </div>
      )}
    </div>
  )
}
