import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../context/ThemeContext'
import { toDisplayDate } from '../utils'

const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

export default function DetailTransactions({ type, transactions, onBack, onEdit }) {
  const { dark } = useTheme()
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const chartRef = useRef(null)
  const chartInstance = useRef(null)

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
    <div className="page-container">

      <div style={{background:'var(--hero-bg)', padding:'20px 16px 24px'}}>
        <div className="flex-center gap-12" style={{maxWidth:'680px', margin:'0 auto'}}>
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

        <div className="flex-between rounded-14 p-14 m-auto mt-16" style={{maxWidth:'680px', background:'rgba(255,255,255,0.08)'}}>
          <div>
            <div className="text-11 text-white-50 mb-2">
              Total ({filtered.length} transaction{filtered.length > 1 ? 's' : ''})
            </div>
            <div className="text-22 font-700" style={{color: isEntree ? '#5eead4' : '#fb9ea0'}}>
              {isEntree ? '+' : '−'}{fmt(total)}
            </div>
          </div>
          <div className="w-44-h-44 rounded-50 flex-center font-700 text-20" style={{background: isEntree ? 'rgba(94,234,212,0.2)' : 'rgba(251,158,160,0.2)', color: isEntree ? '#5eead4' : '#fb9ea0', flexShrink: 0}}>
            {isEntree ? '+' : '−'}
          </div>
        </div>
      </div>

      <div className="m-auto" style={{maxWidth:'680px', padding:'1rem'}}>

        <div className="card mb-16">
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

        <div className="card mb-16">
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

        <div className="card">
          <div className="card-title">
            {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
          </div>

          {filtered.length === 0 && (
            <div className="empty-state">
              Aucune transaction trouvée
            </div>
          )}

          {filtered.map(tx => (
            <div key={tx.id} onClick={() => onEdit(tx)} className="flex-center gap-10 p-12 border-b border-light cursor-pointer" style={{borderBottom:'0.5px solid var(--border-input)', paddingTop:'10px', paddingBottom:'10px'}}>
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
  )
}
