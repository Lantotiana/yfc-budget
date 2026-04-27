import { useState, useEffect, useMemo } from 'react'
import { db } from '../firebase'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { Search, X } from 'lucide-react'
import { toDisplayDate } from '../utils'

const DEFAULT_MOTIFS = {
  entree: ['Don membres', 'Quête vendredi', 'Don extérieur', 'Cotisation', 'Dons', 'Autre'],
  depense: ['Sortie prédication', 'Transport', 'Matériel', 'Impression', 'Restauration', 'Autre']
}

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const PAGE_SIZE = 10

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

function fuzzyMatch(text, query) {
  const t = normalize(text)
  const q = normalize(query)
  if (!q) return true
  if (t.includes(q)) return true
  const words = q.split(/\s+/).filter(Boolean)
  return words.every(w => t.includes(w) || t.includes(w.slice(0, Math.max(3, w.length - 1))))
}

export default function TransactionList({
  transactions, months, filterMonth, filterType,
  onFilterMonth, onFilterType, onDelete
}) {
  const [selected, setSelected] = useState(null)
  const [editType, setEditType] = useState('entree')
  const [editDate, setEditDate] = useState('')
  const [editMontant, setEditMontant] = useState('')
  const [editMotif, setEditMotif] = useState('')
  const [editMotifCustom, setEditMotifCustom] = useState('')
  const [editNote, setEditNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const [hasInit, setHasInit] = useState(false)

  useEffect(() => {
    if (!hasInit && months.length > 0) {
      if (months.includes(currentMonth)) {
        onFilterMonth(currentMonth)
      }
      setHasInit(true)
    }
  }, [months, hasInit])

  useEffect(() => {
    setPage(1)
  }, [filterMonth, filterType, search])

  const searched = useMemo(() => {
    if (!search.trim()) return transactions
    return transactions.filter(tx =>
      fuzzyMatch(tx.motif, search) ||
      fuzzyMatch(tx.note, search) ||
      fuzzyMatch(tx.date, search) ||
      fuzzyMatch(tx.createdBy?.nom, search) ||
      fuzzyMatch(tx.createdBy?.email, search)
    )
  }, [transactions, search])

  const totalPages = Math.max(1, Math.ceil(searched.length / PAGE_SIZE))
  const paginated = searched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function openEdit(tx) {
    setSelected(tx)
    setEditType(tx.type)
    setEditDate(tx.date)
    setEditMontant(String(tx.montant))
    setEditNote(tx.note || '')
    if (DEFAULT_MOTIFS[tx.type].includes(tx.motif)) {
      setEditMotif(tx.motif)
      setEditMotifCustom('')
    } else {
      setEditMotif('Autre')
      setEditMotifCustom(tx.motif)
    }
  }

  function closeEdit() {
    setSelected(null)
    setEditMotifCustom('')
  }

  function handleChangeType(t) {
    setEditType(t)
    setEditMotif(DEFAULT_MOTIFS[t][0])
    setEditMotifCustom('')
  }

  async function handleSave() {
    const motifFinal = editMotif === 'Autre' ? editMotifCustom.trim() : editMotif
    if (!editDate || !editMontant || isNaN(editMontant) || Number(editMontant) <= 0) {
      alert('Veuillez remplir la date et le montant.')
      return
    }
    if (editMotif === 'Autre' && !motifFinal) {
      alert('Veuillez préciser le motif.')
      return
    }
    setSaving(true)
    await updateDoc(doc(db, 'transactions', selected.id), {
      type: editType,
      date: editDate,
      montant: Number(editMontant),
      motif: motifFinal,
      note: editNote
    })
    setSaving(false)
    closeEdit()
  }

  async function handleDelete() {
    if (window.confirm('Supprimer cette transaction ?')) {
      await deleteDoc(doc(db, 'transactions', selected.id))
      closeEdit()
    }
  }

  async function exportToExcel() {
    if (!searched.length) return
    const XLSX = await import('xlsx')
    const data = searched.map(t => ({
      Date: toDisplayDate(t.date),
      Type: t.type === 'entree' ? 'Entrée' : 'Dépense',
      Motif: t.motif,
      Montant: Number(t.montant),
      Note: t.note || '',
      'Ajouté par': t.createdBy?.nom || '—'
    }))
    const totalEntrees = searched.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.montant || 0), 0)
    const totalDepenses = searched.filter(t => t.type === 'depense').reduce((s, t) => s + Number(t.montant || 0), 0)
    data.push({}, { Motif: 'TOTAL ENTRÉES', Montant: totalEntrees }, { Motif: 'TOTAL DÉPENSES', Montant: totalDepenses }, { Motif: 'SOLDE', Montant: totalEntrees - totalDepenses })
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 15 }, { wch: 30 }, { wch: 20 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Historique')
    XLSX.writeFile(wb, `YFC-budget-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  return (
    <>
      <div className="card">
        <div className="card-title">Historique</div>

        <div className="tx-search-wrapper">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher (motif, note, date, utilisateur)..."
            className="tx-search-input"
            style={{paddingLeft: '38px', paddingRight: search ? '38px' : '12px'}}
          />
          <div className="tx-search-icon"><Search size={14} /></div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="tx-search-clear"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-row">
          <select value={filterMonth} onChange={e => onFilterMonth(e.target.value)}>
            <option value="">Tous les mois</option>
            {months.map(m => {
              const [y, mo] = m.split('-')
              return <option key={m} value={m}>{MONTHS[parseInt(mo)-1]} {y}</option>
            })}
          </select>
          <select value={filterType} onChange={e => onFilterType(e.target.value)}>
            <option value="">Tous</option>
            <option value="entree">Entrées</option>
            <option value="depense">Dépenses</option>
          </select>
          <button className="btn-export" onClick={exportToExcel}>Exporter Excel</button>
        </div>

        <div className="tx-count">
          {searched.length} transaction{searched.length > 1 ? 's' : ''}
          {searched.length > PAGE_SIZE && ` · Page ${page}/${totalPages}`}
        </div>

        {paginated.length === 0 && <div className="empty">Aucune transaction</div>}

        {paginated.map(tx => (
          <div key={tx.id} className="tx-item cursor-pointer" onClick={() => openEdit(tx)}>
            <div className={`tx-icon ${tx.type}`}>{tx.type === 'entree' ? '+' : '−'}</div>
            <div className="tx-info">
              <div className="tx-motif">{tx.motif}</div>
              <div className="tx-date">{toDisplayDate(tx.date)}{tx.note ? ' · ' + tx.note : ''}</div>
            {tx.createdBy && (
                <div className="tx-user">
                  {tx.createdBy.photoURL ? (
                    <img src={tx.createdBy.photoURL} alt="" className="tx-user-avatar" />
                  ) : (
                    <div className="tx-user-avatar-fallback">
                      {(tx.createdBy.nom || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span>{tx.createdBy.nom}</span>
                </div>
              )}
            </div>
            <div className={`tx-amount ${tx.type}`}>
              {tx.type === 'depense' ? '−' : '+'}{fmt(tx.montant)}
            </div>
          </div>
        ))}

        {searched.length > PAGE_SIZE && (
          <div className="flex-center gap-8" style={{marginTop:'14px', paddingTop:'14px', borderTop:'0.5px solid var(--border-input)'}}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-12 font-600 rounded-10 border-none bg-secondary cursor-pointer"
              style={{ padding:'8px 14px', color: page === 1 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: page === 1 ? 0.5 : 1 }}
            >
              ← Précédent
            </button>
            <div className="text-12 text-secondary font-600 px-12">
              {page} / {totalPages}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-12 font-600 rounded-10 border-none bg-secondary cursor-pointer"
              style={{ padding:'8px 14px', color: page === totalPages ? 'var(--text-muted)' : 'var(--text-primary)', opacity: page === totalPages ? 0.5 : 1 }}
            >
              Suivant →
            </button>
          </div>
        )}
      </div>

      {selected && (
        <div className="modal-overlay">
          <div className="modal">

            <div className="dialog-header">
              <h3 className="dialog-title">Modifier la transaction</h3>
              <button onClick={closeEdit} className="dialog-close-btn"><X size={18} /></button>
            </div>

            {selected.createdBy && (
              <div className="flex-center gap-10 p-12 rounded-12 mb-14" style={{background:'var(--surface-alt)'}}>
                {selected.createdBy.photoURL ? (
                  <img
                    src={selected.createdBy.photoURL}
                    alt=""
                    className="w-32-h-32 rounded-50 object-cover flex-shrink-0"
                    style={{border:'2px solid #5eead4'}}
                  />
                ) : (
                  <div className="w-32-h-32 rounded-50 flex-center flex-shrink-0 font-700 text-13" style={{background:'#2d1f6e', color:'#5eead4'}}>
                    {(selected.createdBy.nom || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1-min">
                  <div className="text-10 text-secondary font-600 mb-2" style={{textTransform:'uppercase', letterSpacing:'.05em'}}>Ajouté par</div>
                  <div className="text-13 font-700 text-primary text-ellipsis">
                    {selected.createdBy.nom}
                  </div>
                  {selected.createdBy.email && selected.createdBy.email !== selected.createdBy.nom && (
                    <div className="text-10 text-secondary text-ellipsis">
                      {selected.createdBy.email}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="type-toggle mb-14">
              <button onClick={() => handleChangeType('entree')} className="type-btn" style={{background: editType==='entree' ? 'var(--btn-primary-bg)' : 'transparent', color: editType==='entree' ? '#5eead4' : 'var(--text-secondary)'}}>
                + Entrée
              </button>
              <button onClick={() => handleChangeType('depense')} className="type-btn" style={{background: editType==='depense' ? 'var(--btn-primary-bg)' : 'transparent', color: editType==='depense' ? '#fb9ea0' : 'var(--text-secondary)'}}>
                − Dépense
              </button>
            </div>

            <div className="form-row gap-10 mb-10">
              <div>
                <label className="form-label">Date</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label">Montant (Ar)</label>
                <input type="number" value={editMontant} onChange={e => setEditMontant(e.target.value)} min="0" className="form-input" />
              </div>
            </div>

            <div className="mb-10">
              <label className="form-label">Motif</label>
              <select value={editMotif} onChange={e => { setEditMotif(e.target.value); if (e.target.value !== 'Autre') setEditMotifCustom('') }} className="form-input">
                {DEFAULT_MOTIFS[editType].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>

            {editMotif === 'Autre' && (
              <div className="mb-10">
                <label className="form-label">Précisez le motif</label>
                <input
                  type="text"
                  value={editMotifCustom}
                  onChange={e => setEditMotifCustom(e.target.value)}
                  placeholder="Ex: Achat matériel évangélisation..."
                  className="form-input"
                  autoFocus
                />
              </div>
            )}

            <div className="mb-16">
              <label className="form-label">Note (optionnel)</label>
              <input type="text" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Détail..." className="form-input" />
            </div>

            <button onClick={handleSave} disabled={saving} className="w-full rounded-12 font-700 text-14 cursor-pointer text-white border-none mb-8" style={{padding:'12px', background:'var(--btn-primary-bg)', opacity: saving ? 0.7 : 1}}>
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>

            <button onClick={handleDelete} className="btn-danger w-full" style={{padding:'12px', fontSize:'14px', fontWeight:'700'}}>
              Supprimer la transaction
            </button>
          </div>
        </div>
      )}
    </>
  )
}
