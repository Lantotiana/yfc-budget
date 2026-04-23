const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

export default function Stats({ transactions }) {
  const entrees = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.montant || 0), 0)
  const depenses = transactions.filter(t => t.type === 'depense').reduce((s, t) => s + Number(t.montant || 0), 0)
  const solde = entrees - depenses

  return (
    <div className="stats-grid">
      <div className="stat">
        <div className="stat-label">Entrées</div>
        <div className="stat-value green">{fmt(entrees)}</div>
      </div>
      <div className="stat">
        <div className="stat-label">Dépenses</div>
        <div className="stat-value red">{fmt(depenses)}</div>
      </div>
      <div className="stat">
        <div className="stat-label">Solde</div>
        <div className={`stat-value ${solde >= 0 ? 'green' : 'red'}`}>{fmt(Math.abs(solde))}{solde < 0 ? ' −' : ''}</div>
      </div>
    </div>
  )
}