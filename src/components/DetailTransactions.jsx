import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Chart, registerables } from 'chart.js'
import { useTheme } from '../context/ThemeContext'
import { toDisplayDate } from '../utils'

Chart.register(...registerables)

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

    return () => {
      if (chartInstance.current) chartInstance.current.destroy()
    }
  }, [type, transactions, dark])

  function exportExcel() {
    if (!filtered.length) return
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

  const inp = {
    width: '100%',
    padding: '10px 12px',
    border: 'none',
    borderRadius: '10px',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
    background: 'var(--input-bg)',
    color: 'var(--text-primary)'
  }

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-body)'}}>

      <div style={{background:'var(--hero-bg)', padding:'20px 16px 24px'}}>
        <div style={{display:'flex', alignItems:'center', gap:'12px', maxWidth:'680px', margin:'0 auto'}}>
          <button onClick={onBack} style={{background:'rgba(255,255,255,0.1)', border:'none', color:'white', borderRadius:'10px', padding:'8px 12px', cursor:'pointer', fontSize:'13px', fontFamily:'inherit'}}>
            ← Retour
          </button>
          <h1 style={{fontSize:'16px', fontWeight:'700', color:'white', flex:1}}>
            {isEntree ? 'Toutes les entrées' : 'Toutes les dépenses'}
          </h1>
          <button onClick={exportExcel} style={{background:'rgba(255,255,255,0.1)', border:'none', color:'white', borderRadius:'10px', padding:'8px 12px', cursor:'pointer', fontSize:'13px', fontFamily:'inherit'}}>
            Exporter
          </button>
        </div>

        <div style={{maxWidth:'680px', margin:'16px auto 0', background:'rgba(255,255,255,0.08)', borderRadius:'14px', padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div style={{fontSize:'11px', color:'rgba(255,255,255,0.5)', marginBottom:'4px'}}>
              Total ({filtered.length} transaction{filtered.length > 1 ? 's' : ''})
            </div>
            <div style={{fontSize:'22px', fontWeight:'700', color: isEntree ? '#5eead4' : '#fb9ea0'}}>
              {isEntree ? '+' : '−'}{fmt(total)}
            </div>
          </div>
          <div style={{width:'44px', height:'44px', borderRadius:'50%', background: isEntree ? 'rgba(94,234,212,0.2)' : 'rgba(251,158,160,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', fontWeight:'700', color: isEntree ? '#5eead4' : '#fb9ea0'}}>
            {isEntree ? '+' : '−'}
          </div>
        </div>
      </div>

      <div style={{maxWidth:'680px', margin:'0 auto', padding:'1rem'}}>

        <div style={{background:'var(--card-bg)', borderRadius:'16px', padding:'16px', marginBottom:'1rem'}}>
          <div style={{fontSize:'10px', fontWeight:'700', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'14px'}}>
            Évolution mensuelle
          </div>
          <div style={{height:'200px', position:'relative'}}>
            {moisLabels.length === 0
              ? <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--text-secondary)', fontSize:'13px'}}>Aucune donnée</div>
              : <canvas ref={chartRef} />
            }
          </div>
        </div>

        <div style={{background:'var(--card-bg)', borderRadius:'16px', padding:'14px 16px', marginBottom:'1rem'}}>
          <div style={{fontSize:'10px', fontWeight:'700', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'12px'}}>
            Filtrer par date
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
            <div>
              <label style={{fontSize:'11px', color:'var(--text-secondary)', fontWeight:'600', display:'block', marginBottom:'4px'}}>Du</label>
              <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{fontSize:'11px', color:'var(--text-secondary)', fontWeight:'600', display:'block', marginBottom:'4px'}}>Au</label>
              <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={inp} />
            </div>
          </div>
          {(dateDebut || dateFin) && (
            <button onClick={() => { setDateDebut(''); setDateFin('') }} style={{marginTop:'10px', padding:'6px 12px', background:'var(--btn-secondary-bg)', border:'none', borderRadius:'8px', fontSize:'12px', color:'var(--text-secondary)', cursor:'pointer', fontFamily:'inherit'}}>
              Réinitialiser
            </button>
          )}
        </div>

        <div style={{background:'var(--card-bg)', borderRadius:'16px', padding:'14px 16px'}}>
          <div style={{fontSize:'10px', fontWeight:'700', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'12px'}}>
            {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
          </div>

          {filtered.length === 0 && (
            <div style={{textAlign:'center', padding:'2rem', color:'var(--text-secondary)', fontSize:'13px'}}>
              Aucune transaction trouvée
            </div>
          )}

          {filtered.map(tx => (
            <div key={tx.id} onClick={() => onEdit(tx)} style={{display:'flex', alignItems:'center', gap:'10px', padding:'10px 0', borderBottom:'0.5px solid var(--border-input)', cursor:'pointer'}}>
              <div style={{width:'34px', height:'34px', borderRadius:'10px', background:colorLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:'700', color, flexShrink:0}}>
                {isEntree ? '+' : '−'}
              </div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:'13px', fontWeight:'600', color:'var(--text-primary)'}}>{tx.motif}</div>
                <div style={{fontSize:'11px', color:'var(--text-secondary)', marginTop:'2px'}}>
                  {toDisplayDate(tx.date)}{tx.note ? ' · ' + tx.note : ''}
                </div>
              </div>
              <div style={{fontSize:'14px', fontWeight:'700', color, flexShrink:0}}>
                {isEntree ? '+' : '−'}{fmt(tx.montant)}
              </div>
              <div style={{fontSize:'12px', color:'var(--text-muted)'}}>›</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
