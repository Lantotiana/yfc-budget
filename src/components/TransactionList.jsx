import * as XLSX from 'xlsx'

export default function TransactionList({
  transactions,
  months,
  filterMonth,
  filterType,
  onFilterMonth,
  onFilterType,
  onDelete
}) {

  function fmt(n) {
    return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
  }

  // 🔥 EXPORT PRO
  function exportToExcel() {
    if (!transactions.length) return

    const data = transactions.map(t => ({
      Date: t.date,
      Type: t.type === 'entree' ? 'Entrée' : 'Dépense',
      Motif: t.motif,
      Montant: Number(t.montant),
      Note: t.note || ''
    }))

    // 🔥 calculs
    const totalEntrees = transactions
      .filter(t => t.type === 'entree')
      .reduce((s, t) => s + Number(t.montant || 0), 0)

    const totalDepenses = transactions
      .filter(t => t.type === 'depense')
      .reduce((s, t) => s + Number(t.montant || 0), 0)

    const solde = totalEntrees - totalDepenses

    // 🔥 ajouter résumé
    data.push({})
    data.push({
      Date: '',
      Type: '',
      Motif: 'TOTAL ENTRÉES',
      Montant: totalEntrees,
      Note: ''
    })
    data.push({
      Date: '',
      Type: '',
      Motif: 'TOTAL DÉPENSES',
      Montant: totalDepenses,
      Note: ''
    })
    data.push({
      Date: '',
      Type: '',
      Motif: 'SOLDE',
      Montant: solde,
      Note: ''
    })

    const ws = XLSX.utils.json_to_sheet(data)

    // 🔥 largeur colonnes
    ws['!cols'] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 22 },
      { wch: 15 },
      { wch: 30 }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Historique')

    const date = new Date().toISOString().slice(0,10)

    XLSX.writeFile(wb, `historique_${date}.xlsx`)
  }

  return (
    <div className="card">
      <div className="card-title">Historique</div>

      <div className="filter-row">
        <select
          value={filterMonth}
          onChange={(e) => onFilterMonth(e.target.value)}
        >
          <option value="">Tous les mois</option>
          {months.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={(e) => onFilterType(e.target.value)}
        >
          <option value="">Tous</option>
          <option value="entree">Entrées</option>
          <option value="depense">Dépenses</option>
        </select>

        <button
          className="btn-export"
          onClick={exportToExcel}
        >
          Exporter Excel
        </button>
      </div>

      {transactions.length === 0 && (
        <div className="empty">Aucune transaction</div>
      )}

      {transactions.map(tx => (
        <div key={tx.id} className="tx-item">

          <div className={`tx-icon ${tx.type}`}>
            {tx.type === 'entree' ? '+' : '−'}
          </div>

          <div className="tx-info">
            <div className="tx-motif">{tx.motif}</div>
            <div className="tx-date">{tx.date}</div>
          </div>

          <div className={`tx-amount ${tx.type}`}>
            {tx.type === 'depense' ? '−' : '+'}
            {fmt(tx.montant)}
          </div>

          <button
            className="btn-del"
            onClick={() => onDelete(tx)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}