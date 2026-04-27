function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

export default function Stats({ transactions }) {
  const entrees = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.montant || 0), 0)
  const depenses = transactions.filter(t => t.type === 'depense').reduce((s, t) => s + Number(t.montant || 0), 0)
  const solde = entrees - depenses

  return (
    <>
      <div style={{background: '#2d1f6e', padding: '0 1rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
        <div className="rounded-12 p-12 bg-white-10">
          <div className="text-11 text-white-50 mb-2">Entrées</div>
          <div className="text-17 font-700" style={{color:'#5eead4'}}>{fmt(entrees)}</div>
        </div>
        <div className="rounded-12 p-12 bg-white-10">
          <div className="text-11 text-white-50 mb-2">Dépenses</div>
          <div className="text-17 font-700" style={{color:'#fb9ea0'}}>{fmt(depenses)}</div>
        </div>
      </div>

      <div style={{padding:'0 1rem', marginTop:'-1px'}}>
        <div className="flex-between rounded-16 p-16 mb-16 bg-card">
          <div>
            <div className="text-11 mb-2" style={{color:'#9b8fb5'}}>Solde du mois</div>
            <div className="text-22 font-700" style={{color: solde >= 0 ? '#0f766e' : '#be123c'}}>
              {solde < 0 ? '−' : ''}{fmt(Math.abs(solde))}
            </div>
          </div>
          <div className="w-36-h-36 rounded-50 flex-center font-700 text-18 flex-shrink-0" style={{background: solde >= 0 ? '#d4f4ee' : '#fde8e8', color: solde >= 0 ? '#0f766e' : '#be123c'}}>
            {solde >= 0 ? '+' : '−'}
          </div>
        </div>
      </div>
    </>
  )
}