import { useState } from 'react'
import * as XLSX from 'xlsx'
import { db } from '../firebase'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'

const DEFAULT_MOTIFS = {
  entree: ['Don membres', 'Quête vendredi', 'Don extérieur', 'Cotisation', 'Dons', 'Autre'],
  depense: ['Sortie prédication', 'Transport', 'Matériel', 'Impression', 'Restauration', 'Autre']
}

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
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
    if (!transactions.length) return
    const data = transactions.map(t => ({
      Date: t.date,
      Type: t.type === 'entree' ? 'Entrée' : 'Dépense',
      Motif: t.motif,
      Montant: Number(t.montant),
      Note: t.note || ''
    }))
    const totalEntrees = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.montant || 0), 0)
    const totalDepenses = transactions.filter(t => t.type === 'depense').reduce((s, t) => s + Number(t.montant || 0), 0)
    data.push({}, { Motif: 'TOTAL ENTRÉES', Montant: totalEntrees }, { Motif: 'TOTAL DÉPENSES', Montant: totalDepenses }, { Motif: 'SOLDE', Montant: totalEntrees - totalDepenses })
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 15 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Historique')
    XLSX.writeFile(wb, `YFC-budget-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const inp = {
    width: '100%',
    padding: '10px 12px',
    border: 'none',
    borderRadius: '10px',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
    background: '#e8e4f4',
    color: '#2d1f6e'
  }

  return (
    <>
      <div className="card">
        <div className="card-title">Historique</div>

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

        {transactions.length === 0 && <div className="empty">Aucune transaction</div>}

        {transactions.map(tx => (
          <div key={tx.id} className="tx-item" onClick={() => openEdit(tx)} style={{cursor:'pointer'}}>
            <div className={`tx-icon ${tx.type}`}>{tx.type === 'entree' ? '+' : '−'}</div>
            <div className="tx-info">
              <div className="tx-motif">{tx.motif}</div>
              <div className="tx-date">{tx.date}{tx.note ? ' · ' + tx.note : ''}</div>
            </div>
            <div className={`tx-amount ${tx.type}`}>
              {tx.type === 'depense' ? '−' : '+'}{fmt(tx.montant)}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div style={{position:'fixed', inset:0, background:'rgba(26,16,64,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'1rem'}}>
          <div style={{background:'white', borderRadius:'20px', padding:'1.5rem', width:'100%', maxWidth:'400px', maxHeight:'90vh', overflowY:'auto'}}>

            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem'}}>
              <h3 style={{fontSize:'16px', fontWeight:'700', color:'#2d1f6e'}}>Modifier la transaction</h3>
              <button onClick={closeEdit} style={{background:'none', border:'none', cursor:'pointer', fontSize:'18px', color:'#9b8fb5'}}>✕</button>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', background:'#e8e4f4', borderRadius:'12px', padding:'3px', marginBottom:'14px'}}>
              <button onClick={() => handleChangeType('entree')} style={{padding:'9px', border:'none', cursor:'pointer', fontWeight:'700', fontSize:'13px', borderRadius:'9px', fontFamily:'inherit', background: editType==='entree' ? '#2d1f6e' : 'transparent', color: editType==='entree' ? '#5eead4' : '#9b8fb5'}}>
                + Entrée
              </button>
              <button onClick={() => handleChangeType('depense')} style={{padding:'9px', border:'none', cursor:'pointer', fontWeight:'700', fontSize:'13px', borderRadius:'9px', fontFamily:'inherit', background: editType==='depense' ? '#2d1f6e' : 'transparent', color: editType==='depense' ? '#fb9ea0' : '#9b8fb5'}}>
                − Dépense
              </button>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px'}}>
              <div>
                <label style={{fontSize:'11px', color:'#9b8fb5', fontWeight:'600', display:'block', marginBottom:'4px'}}>Date</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{fontSize:'11px', color:'#9b8fb5', fontWeight:'600', display:'block', marginBottom:'4px'}}>Montant (Ar)</label>
                <input type="number" value={editMontant} onChange={e => setEditMontant(e.target.value)} min="0" style={inp} />
              </div>
            </div>

            <div style={{marginBottom: editMotif === 'Autre' ? '8px' : '10px'}}>
              <label style={{fontSize:'11px', color:'#9b8fb5', fontWeight:'600', display:'block', marginBottom:'4px'}}>Motif</label>
              <select value={editMotif} onChange={e => { setEditMotif(e.target.value); if (e.target.value !== 'Autre') setEditMotifCustom('') }} style={inp}>
                {DEFAULT_MOTIFS[editType].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>

            {editMotif === 'Autre' && (
              <div style={{marginBottom:'10px'}}>
                <label style={{fontSize:'11px', color:'#9b8fb5', fontWeight:'600', display:'block', marginBottom:'4px'}}>Précisez le motif</label>
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
              <label style={{fontSize:'11px', color:'#9b8fb5', fontWeight:'600', display:'block', marginBottom:'4px'}}>Note (optionnel)</label>
              <input type="text" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Détail..." style={inp} />
            </div>

            <button onClick={handleSave} disabled={saving} style={{width:'100%', padding:'12px', fontWeight:'700', fontSize:'14px', cursor:'pointer', background:'#2d1f6e', color:'white', border:'none', borderRadius:'12px', fontFamily:'inherit', marginBottom:'10px', opacity: saving ? 0.7 : 1}}>
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