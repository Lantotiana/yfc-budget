import * as XLSX from 'xlsx'

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

export default function TransactionList({ transactions, months, filterMonth, filterType, onFilterMonth, onFilterType, onDelete, allTransactions }) {

  function exportExcel() {
    if (!allTransactions.length) { alert('Aucune transaction à exporter.'); return }
    const rows = [...allTransactions].sort((a,b) => a.date?.localeCompare(b.date))
    const data = rows.map(t => ({
      Date: t.date,
      Type: t.type === 'entree' ? 'Entrée' : 'Dépense',
      Motif: t.motif,
      'Montant (Ar)': Number(t.montant),
      Note: t.note || ''
    }))
    const entrees = rows.filter(t=>t.type==='entree').reduce((s,t)=>s+Number(t.montant||0),0)
    const depenses = rows.filter(t=>t.type==='depense').reduce((s,t)=>s+Number(t.montant||0),0)
    data.push(
      {},
      { Motif: 'TOTAL ENTRÉES', 'Montant (Ar)': entrees },
      { Motif: 'TOTAL DÉPENSES', 'Montant (Ar)': depenses },
      { Motif: 'SOLDE', 'Montant (Ar)': entrees - depenses }
    )
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Budget')
    const moisLabel = filterMonth
      ? (() => { const [y,m] = filterMonth.split('-'); return MONTHS[parseInt(m)-1]+'-'+y })()
      : 'complet'
    XLSX.writeFile(wb, `YFC-budget-${moisLabel}.xlsx`)
  }

  async function handleDelete(t) {
    if (window.confirm('Supprimer cette transaction ?')) {
      await onDelete(t)
    }
  }

  return (
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
        <button className="btn-export" onClick={exportExcel}>Exporter Excel</button>
      </div>

      {transactions.length === 0
        ? <div className="empty">Aucune transaction trouvée</div>
        : transactions.map((t, i) => {
            const rawDate = t.date ? String(t.date).slice(0, 10) : ''
            const d = rawDate ? new Date(rawDate + 'T12:00:00') : null
            const dateStr = d && !isNaN(d)
              ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
              : rawDate
            return (
              <div className="tx-item" key={i}>
                <div className={`tx-icon ${t.type}`}>{t.type === 'entree' ? '+' : '−'}</div>
                <div className="tx-info">
                  <div className="tx-motif">{t.motif}</div>
                  <div className="tx-date">{dateStr}{t.note ? ' · ' + t.note : ''}</div>
                </div>
                <div className={`tx-amount ${t.type}`}>{t.type === 'entree' ? '+' : '−'}{fmt(t.montant)}</div>
                <button className="btn-del" onClick={() => handleDelete(t)}>✕</button>
              </div>
            )
          })
      }
    </div>
  )
}