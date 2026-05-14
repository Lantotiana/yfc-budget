import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { db } from '../../firebase'
import { createNotification } from '../../notifications'
import { canEditMateriel, canManageMateriels } from '../../utils/materielPermissions'
import MaterielCard from './MaterielCard'
import MaterielFormModal from './MaterielFormModal'
import MaterielDetailModal from './MaterielDetailModal'
import { computeStockStatus } from './materielHelpers'
import { useDesktopToolbar } from '../../context/DesktopToolbarContext'

function getDisplayName(member) {
  return member?.nomPrefere || member?.prenoms || member?.nom || ''
}

function buildSearchValue(item) {
  return [
    item.nom,
    item.section,
    item.categorie,
    item.marque,
    item.responsableNom,
    ...(Array.isArray(item.responsablesNoms) ? item.responsablesNoms : []),
    item.lieuActuel,
    item.notes,
  ].filter(Boolean).join(' ').toLowerCase()
}

export default function MaterielsTab({ user, userData, C, onAddReady }) {
  const { setToolbar } = useDesktopToolbar()
  const [materiels, setMateriels] = useState([])
  const [members, setMembers] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [sectionFilter, setSectionFilter] = useState('')

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

  const [evenements, setEvenements] = useState([])
  useEffect(() => {
    return onSnapshot(collection(db, 'evenements_agenda'), snap => {
      setEvenements(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  // materielId → prochain événement qui le réserve
  const eventReservationMap = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const map = {}
    const upcoming = evenements
      .filter(e => (e.dateFin || e.dateDebut) >= today)
      .sort((a, b) => (a.dateDebut < b.dateDebut ? -1 : 1))
    upcoming.forEach(e => {
      ;(e.materielsReserves || []).forEach(m => {
        if (!map[m.id]) map[m.id] = { nom: e.nom, dateDebut: e.dateDebut, dateFin: e.dateFin }
      })
    })
    return map
  }, [evenements])

  const currentMember = useMemo(() => {
    const email = (user?.email || '').trim().toLowerCase()
    return members.find(member => String(member.email || '').trim().toLowerCase() === email) || null
  }, [members, user?.email])

  const canManage = canManageMateriels(user, userData, currentMember)
  const canEdit = canEditMateriel(user, userData, currentMember)

  useEffect(() => {
    onAddReady?.(canManage ? () => { setEditing(null); setShowForm(true) } : null)
  }, [canManage, onAddReady])

  const desktopSearch = useMemo(() => (
    <div className="tx-search-wrapper">
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
  ), [search])

  useEffect(() => {
    setToolbar(prev => ({ ...prev, search: desktopSearch }))
    return () => setToolbar(prev => ({ ...prev, search: null }))
  }, [desktopSearch, setToolbar])

  const sections = useMemo(() => {
    return [...new Set(materiels.map(m => m.section).filter(Boolean))].sort()
  }, [materiels])

  const visibleMateriels = useMemo(() => {
    return materiels.filter(item => {
      if (statusFilter === 'overdue') {
        if (!(item.statut === 'emprunte' && item.currentDueAt && new Date(item.currentDueAt) < new Date(new Date().toDateString()))) return false
      } else if (statusFilter === 'alertes') {
        const isOverdue = item.statut === 'emprunte' && item.currentDueAt && new Date(item.currentDueAt) < new Date(new Date().toDateString())
        if (!isOverdue && item.statut !== 'en_reparation' && item.statut !== 'stock_faible' && item.statut !== 'kit_incomplet') return false
      } else if (statusFilter === 'kit') {
        if (item.typeMatériel !== 'kit') return false
      } else if (statusFilter === 'kit_incomplet') {
        if (item.statut !== 'kit_incomplet') return false
      } else if (statusFilter !== 'all' && item.statut !== statusFilter) return false
      if (sectionFilter && item.section !== sectionFilter) return false
      if (search.trim() && !buildSearchValue(item).includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [materiels, search, statusFilter, sectionFilter])

  const stats = useMemo(() => {
    const total = materiels.filter(item => item.statut !== 'archive').length
    const available = materiels.filter(item => item.statut === 'disponible').length
    const borrowed = materiels.filter(item => item.statut === 'emprunte' || item.statut === 'sorti').length
    const repairing = materiels.filter(item => item.statut === 'en_reparation').length
    const low = materiels.filter(item => item.statut === 'stock_faible').length
    const overdue = materiels.filter(item => item.statut === 'emprunte' && item.currentDueAt && new Date(item.currentDueAt) < new Date(new Date().toDateString())).length
    const kits = materiels.filter(item => item.typeMatériel === 'kit' && item.statut !== 'archive').length
    const kitIncomplet = materiels.filter(item => item.statut === 'kit_incomplet').length
    const alerts = repairing + low + overdue + kitIncomplet
    return { total, available, borrowed, repairing, low, overdue, kits, kitIncomplet, alerts }
  }, [materiels])

  const MAIN_CHIPS = [
    { label: 'Tous',        value: 'all',       count: stats.total,     color: C.teal   },
    { label: 'Disponibles', value: 'disponible', count: stats.available, color: C.teal   },
    { label: 'Empruntés',   value: 'emprunte',  count: stats.borrowed,  color: C.amber  },
    { label: 'Kits',        value: 'kit',       count: stats.kits,      color: C.violet },
    { label: 'Alertes',     value: 'alertes',   count: stats.alerts,    color: C.coral  },
  ]

  const ADVANCED_CHIPS = [
    { label: 'En réparation', value: 'en_reparation', count: stats.repairing,    color: C.violet },
    { label: 'Stock faible',  value: 'stock_faible',  count: stats.low,          color: C.coral  },
    { label: 'En retard',     value: 'overdue',       count: stats.overdue,      color: C.coral  },
    { label: 'Kit incomplet', value: 'kit_incomplet', count: stats.kitIncomplet, color: C.coral  },
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
      kitElements: extra.kitElements || null,
      missingItems: extra.missingItems || null,
      createdAt: new Date().toISOString(),
      createdAtServer: serverTimestamp(),
    })
  }

  async function handleDeleteMateriel() {
    if (!editing) return
    await deleteDoc(doc(db, 'materiels', editing.id))
    setShowForm(false)
    setEditing(null)
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

  function renderChip({ label, value, count, color }) {
    const active = statusFilter === value
    return (
      <button
        key={value}
        type="button"
        onClick={() => setStatusFilter(active && value !== 'all' ? 'all' : value)}
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 999, border: `1.5px solid ${active ? color : C.bord}`,
          background: active ? color : C.surf,
          color: active ? '#fff' : C.t1,
          fontWeight: 600, fontSize: 'var(--font-xs)',
          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        {label}
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 18, height: 18, borderRadius: 999, padding: '0 4px',
          background: active ? 'rgba(255,255,255,0.25)' : C.surf2,
          color: active ? '#fff' : C.t2,
          fontSize: 10, fontWeight: 800,
        }}>{count}</span>
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div className="tx-search-wrapper desktop-local-search" style={{ marginBottom: 8, flexShrink: 0 }}>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', flexShrink: 0, marginBottom: 10, paddingBottom: 2, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {MAIN_CHIPS.map(chip => renderChip(chip))}
        <button
          type="button"
          onClick={() => setShowAdvanced(v => !v)}
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 11px', borderRadius: 999,
            border: `1.5px solid ${showAdvanced || sectionFilter ? C.teal : C.bord}`,
            background: showAdvanced || sectionFilter ? C.tealD : 'none',
            color: showAdvanced || sectionFilter ? C.teal : C.t2,
            fontWeight: 600, fontSize: 'var(--font-xs)',
            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >
          + Filtres
          {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {showAdvanced && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, marginBottom: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ADVANCED_CHIPS.map(chip => renderChip(chip))}
          </div>
          {sections.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '.06em' }}>Section</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {sections.map(s => {
                  const active = sectionFilter === s
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSectionFilter(active ? '' : s)}
                      style={{
                        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px', borderRadius: 999,
                        border: `1.5px solid ${active ? C.teal : C.bord}`,
                        background: active ? C.teal : C.surf,
                        color: active ? '#fff' : C.t1,
                        fontWeight: 600, fontSize: 'var(--font-xs)',
                        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                      }}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 8, padding: '10px 14px', borderRadius: 12, background: C.coralD, color: C.coral, fontSize: 'var(--font-sm)', fontWeight: 600, flexShrink: 0 }}>
          {error}
        </div>
      )}

      <div className="materiel-cards-grid" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: 'max(5rem, env(safe-area-inset-bottom))' }}>
        {visibleMateriels.length === 0 ? (
          <div style={{ padding: '2rem 0', color: C.t2, textAlign: 'center', fontSize: 'var(--font-sm)', gridColumn: '1 / -1' }}>
            {materiels.length === 0 ? 'Aucun matériel enregistré pour le moment.' : 'Ce matériel est introuvable.'}
          </div>
        ) : visibleMateriels.map(item => (
          <MaterielCard key={item.id} materiel={item} C={C} onOpen={() => setSelected(item)} reservedForEvent={eventReservationMap[item.id] || null} />
        ))}
        {!canEdit && (
          <div style={{ gridColumn: '1 / -1', marginTop: 8, background: C.surf2, borderRadius: 14, padding: 14, fontSize: 'var(--font-xs)', color: C.t2 }}>
            Lecture seule : seuls les responsables autorisés peuvent gérer les matériels.
          </div>
        )}
      </div>

      <MaterielFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null) }}
        onSubmit={handleSaveMateriel}
        onDelete={editing ? handleDeleteMateriel : undefined}
        members={members}
        sections={sections}
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

    </div>
  )
}
