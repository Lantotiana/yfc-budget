import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../context/ThemeContext'
import { toDisplayDate } from '../utils'
import { db } from '../firebase'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { X } from 'lucide-react'
import { createNotification } from '../notifications'

const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

const DEFAULT_MOTIFS = {
  entree: ['Don membres', 'Quête vendredi', 'Don extérieur', 'Cotisation', 'Dons', 'Autre'],
  depense: ['Sortie prédication', 'Transport', 'Matériel', 'Impression', 'Restauration', 'Autre']
}

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

export default function DetailTransactions({ type, transactions, onBack }) {
  const { C, dark } = useTheme()
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
    await createNotification({
      type: 'budget',
      titre: 'Transaction modifiée',
      detail: `${motifFinal} - ${fmt(editMontant)}`,
      cible: motifFinal,
      route: '/budget',
    })
    setSaving(false)
    closeEdit()
  }

  async function handleDelete() {
    if (window.confirm('Supprimer cette transaction ?')) {
      await deleteDoc(doc(db, 'transactions', selected.id))
      await createNotification({
        type: 'budget',
        titre: 'Transaction supprimée',
        detail: `${selected.motif} - ${fmt(selected.montant)}`,
        cible: selected.motif,
        route: '/budget',
      })
      closeEdit()
    }
  }

  const isEntree = type === 'entree'
  const color = isEntree ? C.teal : C.coral
  const colorLight = isEntree ? C.tealD : C.coralD
  const colorChart = isEntree ? C.teal : C.coral

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
    <div className="sin" style={{ minHeight: '100vh', background: C.bg }}>

      {/* Header */}
      <div className="f1" style={{ padding: '20px 20px 0', paddingTop: 'max(20px, env(safe-area-inset-top))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ padding: '7px 12px', borderRadius: 10, border: `1px solid ${C.bord}`, background: C.surf, color: C.t2, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Retour
          </button>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.t1 }}>
            {isEntree ? 'Entrées' : 'Dépenses'}
          </div>
        </div>
        <button onClick={exportExcel} style={{ padding: '7px 12px', borderRadius: 10, border: `1px solid ${C.bord}`, background: C.surf, color: C.t2, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Exporter
        </button>
      </div>

      {/* Total tile */}
      <div className="f2" style={{ padding: '0 20px 16px' }}>
        <div style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 18, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: C.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
              Total · {filtered.length} transaction{filtered.length > 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color }}>
              {isEntree ? '+' : '−'}{fmt(total)}
            </div>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: colorLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color }}>
            {isEntree ? '+' : '−'}
          </div>
        </div>
      </div>

      <div className="scroll-bottom-safe" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px', paddingBottom: '2rem' }}>

        {/* Graphique */}
        <div style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 18, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>Évolution mensuelle</div>
          <div style={{ position: 'relative', height: 200 }}>
            {moisLabels.length === 0
              ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 13, color: C.t2 }}>Aucune donnée</div>
              : <canvas ref={chartRef} />
            }
          </div>
        </div>

        {/* Filtre date */}
        <div style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 18, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>Filtrer par date</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
            <button onClick={() => { setDateDebut(''); setDateFin('') }} style={{ marginTop: 10, padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.bord2}`, background: 'transparent', color: C.t2, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              Réinitialiser
            </button>
          )}
        </div>

        {/* Liste */}
        <div style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 18, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>
            {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: C.t2, padding: '1rem', fontSize: 13 }}>Aucune transaction trouvée</div>
          )}

          {filtered.map((tx, i) => (
            <div key={tx.id} onClick={() => openEdit(tx)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderBottom: i < filtered.length - 1 ? `1px solid ${C.bord}` : 'none', padding: '11px 0' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: colorLight, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                {isEntree ? '+' : '−'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{tx.motif}</div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
                  {toDisplayDate(tx.date)}{tx.note ? ' · ' + tx.note : ''}
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, flexShrink: 0, color }}>
                {isEntree ? '+' : '−'}{fmt(tx.montant)}
              </div>
              <div style={{ fontSize: 12, color: C.t3 }}>›</div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, marginBottom: 14, background: C.surf2 }}>
              {selected.createdBy.photoURL ? (
                <img src={selected.createdBy.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${C.teal}` }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, background: C.tealD, color: C.teal }}>
                  {(selected.createdBy.nom || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: C.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Ajouté par</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.createdBy.nom}</div>
              </div>
            </div>
          )}

          <div className="type-toggle mb-14">
            <button onClick={() => handleChangeType('entree')} className="type-btn" style={{ background: editType==='entree' ? C.tealD : 'transparent', color: editType==='entree' ? C.teal : C.t2 }}>+ Entrée</button>
            <button onClick={() => handleChangeType('depense')} className="type-btn" style={{ background: editType==='depense' ? C.coralD : 'transparent', color: editType==='depense' ? C.coral : C.t2 }}>− Dépense</button>
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

          <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', background: C.amber, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1, marginBottom: 8 }}>
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
          <button onClick={handleDelete} style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', background: C.coralD, color: C.coral, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            Supprimer la transaction
          </button>
        </div>
      </div>
    )}
  </>
  )
}
