import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Search, Trash2, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { toDisplayDate } from '../utils'

const C = '#2F80ED'
const EMPTY = { nom: '', prenoms: '', adresse: '', telephone: '', email: '', tailleTshirt: '' }
const TAILLES_TSHIRT = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export default function Membres({ user, userData }) {
  const navigate = useNavigate()
  const [membres, setMembres] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sheet, setSheet] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'membres'), orderBy('nom'))
    const unsub = onSnapshot(q, snap => {
      setMembres(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  function openAdd()  { setForm(EMPTY); setSheet('add') }
  function openEdit(m) {
    setForm({ nom: m.nom || '', prenoms: m.prenoms || '', adresse: m.adresse || '', telephone: m.telephone || '', email: m.email || '', tailleTshirt: m.tailleTshirt || '' })
    setSheet(m)
  }
  function closeSheet() { setSheet(null); setForm(EMPTY) }

  async function save() {
    if (!form.nom.trim()) return
    setSaving(true)
    try {
      if (sheet === 'add') {
        await addDoc(collection(db, 'membres'), {
          nom: form.nom.trim(), prenoms: form.prenoms.trim(), adresse: form.adresse.trim(),
          telephone: form.telephone.trim(), email: form.email.trim(), tailleTshirt: form.tailleTshirt,
          dateAjout: new Date().toISOString().slice(0, 10),
        })
      } else {
        await updateDoc(doc(db, 'membres', sheet.id), {
          nom: form.nom.trim(), prenoms: form.prenoms.trim(), adresse: form.adresse.trim(),
          telephone: form.telephone.trim(), email: form.email.trim(), tailleTshirt: form.tailleTshirt,
        })
      }
      closeSheet()
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  async function confirmDelete() {
    if (!confirmDel) return
    await deleteDoc(doc(db, 'membres', confirmDel.id))
    setConfirmDel(null)
  }

  function exportExcel() {
    const rows = membres.map(m => ({
      'Nom': m.nom || '',
      'Prénoms': m.prenoms || '',
      'Téléphone': m.telephone || '',
      'Email': m.email || '',
      'Adresse': m.adresse || '',
      'Taille T-shirt': m.tailleTshirt || '',
      "Date d'ajout": toDisplayDate(m.dateAjout),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Membres')
    XLSX.writeFile(wb, `membres_yfc_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const term = normalize(search)
  const filtered = membres.filter(m =>
    normalize(m.nom).includes(term) ||
    normalize(m.prenoms).includes(term) ||
    normalize(m.telephone).includes(term)
  )

  const isEditing = sheet && sheet !== 'add'

  return (
    <div className="page-container-locked">

      {/* Header */}
      <div className="page-header" style={{ background: C }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
          <button onClick={() => navigate('/')} className="page-back-btn">
            ‹
          </button>
          <div style={{ flex: 1 }}>
            <h1 className="page-title">Membres</h1>
            <p className="page-subtitle">
              {membres.length} membre{membres.length !== 1 ? 's' : ''}
            </p>
          </div>
          {membres.length > 0 && (
            <button onClick={exportExcel} className="page-export-btn">
              <Download size={15} /> Exporter
            </button>
          )}
        </div>

        <div className="search-wrapper">
          <span className="search-icon">
            <Search size={15} />
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un membre..."
            className="search-input input-header"
          />
        </div>
      </div>

      {/* Liste */}
      <div className="page-content" style={{ paddingBottom: '5rem' }}>
        {loading ? (
          <div className="empty-state">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            {search ? 'Aucun résultat' : 'Aucun membre enregistré'}
          </div>
        ) : filtered.map(m => (
          <div key={m.id} className="list-item" onClick={() => openEdit(m)}>
            <div className="list-item-avatar" style={{ background: `${C}18`, color: C }}>
              {(m.nom || '?')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                {m.nom} {m.prenoms}
              </div>
              {m.telephone && (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>{m.telephone}</div>
              )}
              {m.email && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
              )}
            </div>
            <button
              onClick={e => { e.stopPropagation(); setConfirmDel(m) }}
              style={{ background: 'var(--del-btn-bg)', border: 'none', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: '#D63B5E', display: 'flex', alignItems: 'center', flexShrink: 0 }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={openAdd}
        style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem',
          width: '54px', height: '54px', borderRadius: '50%',
          background: C, color: '#fff', border: 'none', fontSize: '24px',
          cursor: 'pointer', boxShadow: `0 6px 20px ${C}60`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
        }}
      >
        +
      </button>

      {/* Bottom sheet */}
      {sheet !== null && (
        <div className="bottom-sheet-overlay" onClick={closeSheet}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>

            <div className="bottom-sheet-handle" />
            <h2 className="dialog-title" style={{ marginBottom: '1.25rem' }}>
              {isEditing ? 'Modifier le membre' : 'Nouveau membre'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { key: 'nom',       label: 'Nom *',     placeholder: 'Nom de famille' },
                { key: 'prenoms',   label: 'Prénoms',   placeholder: 'Prénoms' },
                { key: 'telephone', label: 'Téléphone', placeholder: '034 xx xxx xx' },
                { key: 'email',     label: 'Email',     placeholder: 'nom@email.com', type: 'email' },
                { key: 'adresse',   label: 'Adresse',   placeholder: 'Quartier, ville...' },
              ].map(f => (
                <div key={f.key}>
                  <label className="form-label">{f.label}</label>
                  <input
                    type={f.type || 'text'}
                    value={form[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="form-input"
                  />
                </div>
              ))}

              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Taille T-shirt</label>
                <select value={form.tailleTshirt} onChange={e => setForm(prev => ({ ...prev, tailleTshirt: e.target.value }))} className="form-input" style={{ cursor: 'pointer' }}>
                  <option value="">Non spécifiée</option>
                  {TAILLES_TSHIRT.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
              <button onClick={closeSheet} style={{ flex: 1, padding: '13px', border: '1.5px solid var(--border-input)', borderRadius: '12px', background: 'transparent', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button onClick={save} disabled={saving || !form.nom.trim()} style={{ flex: 2, padding: '13px', border: 'none', borderRadius: '12px', background: C, color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', opacity: (saving || !form.nom.trim()) ? 0.6 : 1 }}>
                {saving ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression */}
      {confirmDel && (
        <div className="modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title" style={{ marginBottom: '8px' }}>Supprimer ce membre ?</h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {confirmDel.nom} {confirmDel.prenoms} sera définitivement supprimé.
            </p>
            <div className="dialog-footer">
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, padding: '12px', border: '1.5px solid var(--border-input)', borderRadius: '12px', background: 'transparent', color: 'var(--text-secondary)', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button onClick={confirmDelete} style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '12px', background: '#E8445A', color: '#fff', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
