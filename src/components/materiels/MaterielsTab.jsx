import { useEffect, useMemo, useRef, useState } from 'react'
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { Search, SlidersHorizontal } from 'lucide-react'
import { db } from '../../firebase'
import { createNotification } from '../../notifications'
import { canEditMateriel, canManageMateriels } from '../../utils/materielPermissions'
import MaterielCard from './MaterielCard'
import MaterielFormModal from './MaterielFormModal'
import MaterielDetailModal from './MaterielDetailModal'
import { computeStockStatus, MATERIEL_CATEGORIES } from './materielHelpers'

const QUICK_FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'disponible', label: 'Disponible' },
  { key: 'emprunte', label: 'Emprunté' },
  { key: 'reserve', label: 'Réservé' },
  { key: 'en_reparation', label: 'En réparation' },
  { key: 'endommage', label: 'Endommagé' },
  { key: 'stock_faible', label: 'Stock faible' },
  { key: 'archive', label: 'Archivé' },
]

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
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const filtersRef = useRef(null)

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

  useEffect(() => {
    if (!showFilters) return

    function onPointerDown(event) {
      if (filtersRef.current?.contains(event.target)) return
      setShowFilters(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [showFilters])

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
      if (statusFilter !== 'all' && item.statut !== statusFilter) return false
      if (categoryFilter !== 'all' && item.categorie !== categoryFilter) return false
      if (search.trim() && !buildSearchValue(item).includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [categoryFilter, materiels, search, statusFilter])

  const stats = useMemo(() => {
    const total = materiels.filter(item => item.statut !== 'archive').length
    const available = materiels.filter(item => item.statut === 'disponible').length
    const borrowed = materiels.filter(item => item.statut === 'emprunte').length
    const repairing = materiels.filter(item => item.statut === 'en_reparation').length
    const low = materiels.filter(item => item.statut === 'stock_faible').length
    const overdue = materiels.filter(item => item.statut === 'emprunte' && item.currentDueAt && new Date(item.currentDueAt) < new Date(new Date().toDateString())).length
    return { total, available, borrowed, repairing, low, overdue }
  }, [materiels])

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

  return (
    <div>
      <div className="materiel-stats-grid">
        {[
          ['Total matériels', stats.total, C.teal],
          ['Disponibles', stats.available, C.teal],
          ['Empruntés', stats.borrowed, C.amber],
          ['En réparation', stats.repairing, C.violet],
          ['Stock faible', stats.low, C.coral],
          ['Retours en retard', stats.overdue, C.coral],
        ].map(([label, value, color]) => (
          <div key={label} className="materiel-stat-card" style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16, padding: 14 }}>
            <div className="materiel-stat-label" style={{ fontSize: 'var(--font-xs)', color: C.t2 }}>{label}</div>
            <div className="materiel-stat-value" style={{ fontSize: 'var(--font-lg)', fontWeight: 800, color, marginTop: 6 }}>{value}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: '12px 14px', borderRadius: 14, background: C.coralD, color: C.coral, fontSize: 'var(--font-sm)', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        <div ref={filtersRef}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }}>
            <label className="task-search">
              <Search size={16} />
              <input
                type="search"
                placeholder="Rechercher un matériel..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </label>
            <button type="button" className="task-filter-summary" onClick={() => setShowFilters(prev => !prev)} style={{ width: 'auto', paddingInline: 12 }}>
              <SlidersHorizontal size={16} />
            </button>
          </div>

          {showFilters && (
            <div className="task-filters compact">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                {QUICK_FILTERS.map(filter => <option key={filter.key} value={filter.key}>{filter.label}</option>)}
              </select>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="all">Toutes les catégories</option>
                {MATERIEL_CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          )}
        </div>

      </div>

      <div className="materiel-cards-grid" style={{ marginTop: 16 }}>
        {visibleMateriels.length === 0 ? (
          <div style={{ padding: '2rem 0', color: C.t2, textAlign: 'center', fontSize: 'var(--font-sm)' }}>
            {materiels.length === 0 ? 'Aucun matériel enregistré pour le moment.' : 'Ce matériel est introuvable.'}
          </div>
        ) : visibleMateriels.map(item => (
          <MaterielCard key={item.id} materiel={item} C={C} onOpen={() => setSelected(item)} />
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

      {!canEdit && (
        <div style={{ marginTop: 16, background: C.surf2, borderRadius: 14, padding: 14, fontSize: 'var(--font-xs)', color: C.t2 }}>
          Lecture seule : seuls les responsables autorisés peuvent gérer les matériels.
        </div>
      )}
    </div>
  )
}
