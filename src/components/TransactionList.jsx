import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
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

  function exportToExcel() {
    if (!searched.length) return
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
            style={{paddingLeft:'38px', paddingRight: search ? '38px' : '12px'}}
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
              className="text-12 font-600 rounded-10 border-none bg-secondary"
              style={{ padding:'8px 14px', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? 'var(--text-muted)' : 'var(--text-primary)', fontFamily:'inherit' }}
            >
              ← Précédent
            </button>
            <div className="text-12 text-secondary font-600" style={{padding:'0 8px'}}>
              {page} / {totalPages}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-12 font-600 rounded-10 border-none bg-secondary"
              style={{ padding:'8px 14px', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? 'var(--text-muted)' : 'var(--text-primary)', fontFamily:'inherit' }}
            >
              Suivant →
            </button>
          </div>
        )}
      </div>

      {selected && (
        <div style={{position:'fixed', inset:0, background:'rgba(26,16,64,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'1rem'}}>
          <div style={{background:'var(--card-bg)', borderRadius:'20px', padding:'1.5rem', width:'100%', maxWidth:'400px', maxHeight:'90vh', overflowY:'auto'}}>

            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem'}}>
              <h3 style={{fontSize:'16px', fontWeight:'700', color:'var(--text-primary)'}}>Modifier la transaction</h3>
              <button onClick={closeEdit} style={{background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', display:'flex', alignItems:'center'}}><X size={18} /></button>
            </div>

            {selected.createdBy && (
              <div style={{display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', background:'var(--surface-alt)', borderRadius:'12px', marginBottom:'14px'}}>
                {selected.createdBy.photoURL ? (
                  <img
                    src={selected.createdBy.photoURL}
                    alt=""
                    style={{width:'32px', height:'32px', borderRadius:'50%', objectFit:'cover', border:'2px solid #5eead4'}}
                  />
                ) : (
                  <div style={{width:'32px', height:'32px', borderRadius:'50%', background:'#2d1f6e', color:'#5eead4', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', fontSize:'13px'}}>
                    {(selected.createdBy.nom || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:'10px', color:'var(--text-secondary)', fontWeight:'600', marginBottom:'2px'}}>AJOUTÉ PAR</div>
                  <div style={{fontSize:'13px', fontWeight:'700', color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    {selected.createdBy.nom}
                  </div>
                  {selected.createdBy.email && selected.createdBy.email !== selected.createdBy.nom && (
                    <div style={{fontSize:'10px', color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                      {selected.createdBy.email}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', background:'var(--input-bg)', borderRadius:'12px', padding:'3px', marginBottom:'14px'}}>
              <button onClick={() => handleChangeType('entree')} style={{padding:'9px', border:'none', cursor:'pointer', fontWeight:'700', fontSize:'13px', borderRadius:'9px', fontFamily:'inherit', background: editType==='entree' ? 'var(--btn-primary-bg)' : 'transparent', color: editType==='entree' ? '#5eead4' : 'var(--text-secondary)'}}>
                + Entrée
              </button>
              <button onClick={() => handleChangeType('depense')} style={{padding:'9px', border:'none', cursor:'pointer', fontWeight:'700', fontSize:'13px', borderRadius:'9px', fontFamily:'inherit', background: editType==='depense' ? 'var(--btn-primary-bg)' : 'transparent', color: editType==='depense' ? '#fb9ea0' : 'var(--text-secondary)'}}>
                − Dépense
              </button>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px'}}>
              <div>
                <label style={{fontSize:'11px', color:'var(--text-secondary)', fontWeight:'600', display:'block', marginBottom:'4px'}}>Date</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{fontSize:'11px', color:'var(--text-secondary)', fontWeight:'600', display:'block', marginBottom:'4px'}}>Montant (Ar)</label>
                <input type="number" value={editMontant} onChange={e => setEditMontant(e.target.value)} min="0" style={inp} />
              </div>
            </div>

            <div style={{marginBottom: editMotif === 'Autre' ? '8px' : '10px'}}>
              <label style={{fontSize:'11px', color:'var(--text-secondary)', fontWeight:'600', display:'block', marginBottom:'4px'}}>Motif</label>
              <select value={editMotif} onChange={e => { setEditMotif(e.target.value); if (e.target.value !== 'Autre') setEditMotifCustom('') }} style={inp}>
                {DEFAULT_MOTIFS[editType].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>

            {editMotif === 'Autre' && (
              <div style={{marginBottom:'10px'}}>
                <label style={{fontSize:'11px', color:'var(--text-secondary)', fontWeight:'600', display:'block', marginBottom:'4px'}}>Précisez le motif</label>
                <input
                  type="text"
                  value={editMotifCustom}
                  onChange={e => setEditMotifCustom(e.target.value)}
                  placeholder="Ex: Achat matériel évangélisation..."
                  style={inp}
                  autoFocus
                />
              </div>
            )}

            <div style={{marginBottom:'1.25rem'}}>
              <label style={{fontSize:'11px', color:'var(--text-secondary)', fontWeight:'600', display:'block', marginBottom:'4px'}}>Note (optionnel)</label>
              <input type="text" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Détail..." style={inp} />
            </div>

            <button onClick={handleSave} disabled={saving} style={{width:'100%', padding:'12px', fontWeight:'700', fontSize:'14px', cursor:'pointer', background:'var(--btn-primary-bg)', color:'white', border:'none', borderRadius:'12px', fontFamily:'inherit', marginBottom:'10px', opacity: saving ? 0.7 : 1}}>
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>

            <button onClick={handleDelete} style={{width:'100%', padding:'12px', fontWeight:'700', fontSize:'14px', cursor:'pointer', background:'#fde8e8', color:'#be123c', border:'none', borderRadius:'12px', fontFamily:'inherit'}}>
              Supprimer la transaction
            </button>
          </div>
        </div>
      )}
    </>
  )
}
