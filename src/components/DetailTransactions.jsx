import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../context/ThemeContext'
import { toDisplayDate } from '../utils'
import { db } from '../firebase'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { X } from 'lucide-react'

const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

const DEFAULT_MOTIFS = {
  entree: ['Don membres', 'Quête vendredi', 'Don extérieur', 'Cotisation', 'Dons', 'Autre'],
  depense: ['Sortie prédication', 'Transport', 'Matériel', 'Impression', 'Restauration', 'Autre']
}

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

export default function DetailTransactions({ type, transactions, onBack }) {
  const { dark } = useTheme()
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const chartRef = useRef(null)
  const chartInstance = useRef(null)

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

  const isEntree = type === 'entree'
  const color = isEntree ? '#0f766e' : '#be123c'
  const colorLight = isEntree ? '#d4f4ee' : '#fde8e8'
  const colorChart = isEntree ? '#5eead4' : '#fb9ea0'

  const allOfType = transactions.filter(t => t.type === type)

  const filtered = allOfType
    .filter(t => {
      if (dateDebut && t.date < dateDebut) return false
      if (dateFin && t.date > dateFin) return false
      return true
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  const total = filtered.reduce((s, t) => s + Number(t.montant || 0), 0)

  const parMois = allOfType.reduce((acc, t) => {
    const mois = t.date?.slice(0, 7)
    if (!mois) return acc
    acc[mois] = (acc[mois] || 0) + Number(t.montant || 0)
    return acc
  }, {})

  const moisLabels = Object.keys(parMois).sort()
  const moisData = moisLabels.map(m => parMois[m])
  const moisDisplay = moisLabels.map(m => {
    const [y, mo] = m.split('-')
    return MONTHS[parseInt(mo) - 1] + ' ' + y.slice(2)
  })

  useEffect(() => {
    if (!chartRef.current) return
    let cancelled = false

    ;(async () => {
      const { Chart, registerables } = await import('chart.js')
      if (cancelled || !chartRef.current) return
      Chart.register(...registerables)
      if (chartInstance.current) chartInstance.current.destroy()

      chartInstance.current = new Chart(chartRef.current, {
        type: 'bar',
        data: {
          labels: moisDisplay,
          datasets: [{
            label: isEntree ? 'Entrées' : 'Dépenses',
            data: moisData,
            backgroundColor: colorChart + '80',
            borderColor: colorChart,
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => fmt(ctx.raw)
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 11 }, color: '#9b8fb5' }
            },
            y: {
              grid: { color: dark ? '#2a2460' : '#e8e4f4' },
              ticks: {
                font: { size: 11 },
                color: '#9b8fb5',
                callback: v => Number(v).toLocaleString('fr-FR')
              }
            }
          }
        }
      })
    })()

    return () => {
      cancelled = true
      if (chartInstance.current) chartInstance.current.destroy()
    }
  }, [type, transactions, dark])

  async function exportExcel() {
    if (!filtered.length) return
    const XLSX = await import('xlsx')
    const data = filtered.map(t => ({
      Date: toDisplayDate(t.date),
      Motif: t.motif,
      Montant: Number(t.montant),
      Note: t.note || ''
    }))
    data.push({}, { Motif: 'TOTAL', Montant: total })
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 15 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, isEntree ? 'Entrées' : 'Dépenses')
    XLSX.writeFile(wb, `YFC-${isEntree ? 'entrees' : 'depenses'}-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  return (
    <>
    <div className="page-container">

      <div style={{background:'var(--hero-bg)', padding:'18px 16px 2.5rem'}}>
        <div className="flex-center gap-12" style={{marginBottom:'16px'}}>
          <button onClick={onBack} className="rounded-10 text-13 text-white border-none cursor-pointer bg-white-10 flex-shrink-0" style={{padding:'8px 12px'}}>
            ← Retour
          </button>
          <h1 className="flex-1 text-16 font-700 text-white">
            {isEntree ? 'Toutes les entrées' : 'Toutes les dépenses'}
          </h1>
          <button onClick={exportExcel} className="rounded-10 text-13 text-white border-none cursor-pointer bg-white-10 flex-shrink-0" style={{padding:'8px 12px'}}>
            Exporter
          </button>
        </div>

        <div style={{background:'rgba(255,255,255,0.14)', borderRadius:'14px', padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div style={{fontSize:'11px', color:'rgba(255,255,255,0.55)', fontWeight:'600', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'4px'}}>
              Total ({filtered.length} transaction{filtered.length > 1 ? 's' : ''})
            </div>
            <div style={{fontSize:'22px', fontWeight:'700', color: isEntree ? '#4ADE80' : '#FC8FAE'}}>
              {isEntree ? '+' : '−'}{fmt(total)}
            </div>
          </div>
          <div style={{width:'42px', height:'42px', borderRadius:'50%', background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', fontWeight:'700', color:'#fff'}}>
            {isEntree ? '+' : '−'}
          </div>
        </div>
      </div>

      <div style={{paddingTop:'0.75rem', borderTopLeftRadius:'20px', borderTopRightRadius:'20px', marginTop:'-1.5rem', background:'var(--bg-body)', position:'relative', zIndex:1, display:'flex', flexDirection:'column', gap:'8px'}}>

        <div className="card">
          <div className="card-title">
            Évolution mensuelle
          </div>
          <div className="relative" style={{height:'200px'}}>
            {moisLabels.length === 0
              ? <div className="flex-center h-full text-13 text-secondary">Aucune donnée</div>
              : <canvas ref={chartRef} />
            }
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            Filtrer par date
          </div>
          <div className="form-row gap-10">
            <div>
              <label className="form-label">Du</label>
              <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">Au</label>
              <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} className="form-input" />
            </div>
          </div>
          {(dateDebut || dateFin) && (
            <button onClick={() => { setDateDebut(''); setDateFin('') }} className="btn-secondary text-12 mt-8" style={{padding:'6px 12px'}}>
              Réinitialiser
            </button>
          )}
        </div>

        <div className="card" style={{marginBottom:'16px'}}>
          <div className="card-title">
            {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
          </div>

          {filtered.length === 0 && (
            <div className="empty-state">
              Aucune transaction trouvée
            </div>
          )}

          {filtered.map((tx, i) => (
            <div key={tx.id} onClick={() => openEdit(tx)} className="flex-center gap-10 cursor-pointer" style={{borderBottom: i < filtered.length - 1 ? '0.5px solid var(--border-input)' : 'none', padding:'10px 0'}}>
              <div className="w-34-h-34 rounded-10 flex-center font-700 text-14 flex-shrink-0" style={{background:colorLight, color}}>
                {isEntree ? '+' : '−'}
              </div>
              <div className="flex-1-min">
                <div className="text-13 font-600 text-primary">{tx.motif}</div>
                <div className="text-11 text-secondary mt-2">
                  {toDisplayDate(tx.date)}{tx.note ? ' · ' + tx.note : ''}
                </div>
              </div>
              <div className="font-700 text-14 flex-shrink-0" style={{color}}>
                {isEntree ? '+' : '−'}{fmt(tx.montant)}
              </div>
              <div className="text-12 text-muted">›</div>
            </div>
          ))}
        </div>
      </div>
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
                <img src={selected.createdBy.photoURL} alt="" className="w-32-h-32 rounded-50 object-cover flex-shrink-0" style={{border:'2px solid #5eead4'}} />
              ) : (
                <div className="w-32-h-32 rounded-50 flex-center flex-shrink-0 font-700 text-13" style={{background:'#2d1f6e', color:'#5eead4'}}>
                  {(selected.createdBy.nom || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1-min">
                <div className="text-10 text-secondary font-600 mb-2" style={{textTransform:'uppercase', letterSpacing:'.05em'}}>Ajouté par</div>
                <div className="text-13 font-700 text-primary text-ellipsis">{selected.createdBy.nom}</div>
              </div>
            </div>
          )}

          <div className="type-toggle mb-14">
            <button onClick={() => handleChangeType('entree')} className="type-btn" style={{background: editType==='entree' ? 'var(--btn-primary-bg)' : 'transparent', color: editType==='entree' ? '#5eead4' : 'var(--text-secondary)'}}>+ Entrée</button>
            <button onClick={() => handleChangeType('depense')} className="type-btn" style={{background: editType==='depense' ? 'var(--btn-primary-bg)' : 'transparent', color: editType==='depense' ? '#fb9ea0' : 'var(--text-secondary)'}}>− Dépense</button>
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
              <input type="text" value={editMotifCustom} onChange={e => setEditMotifCustom(e.target.value)} placeholder="Ex: Achat matériel..." className="form-input" autoFocus />
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
