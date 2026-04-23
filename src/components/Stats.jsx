function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

export default function Stats({ transactions }) {
  const entrees = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.montant || 0), 0)
  const depenses = transactions.filter(t => t.type === 'depense').reduce((s, t) => s + Number(t.montant || 0), 0)
  const solde = entrees - depenses

  return (
    <>
      <div style={{
        background: '#2d1f6e',
        padding: '0 1rem 1.25rem',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px'
      }}>
        <div style={{background:'rgba(255,255,255,0.1)', borderRadius:'12px', padding:'12px'}}>
          <div style={{fontSize:'11px', color:'rgba(255,255,255,0.5)', marginBottom:'4px'}}>Entrées</div>
          <div style={{fontSize:'17px', fontWeight:'700', color:'#5eead4'}}>{fmt(entrees)}</div>
        </div>
        <div style={{background:'rgba(255,255,255,0.1)', borderRadius:'12px', padding:'12px'}}>
          <div style={{fontSize:'11px', color:'rgba(255,255,255,0.5)', marginBottom:'4px'}}>Dépenses</div>
          <div style={{fontSize:'17px', fontWeight:'700', color:'#fb9ea0'}}>{fmt(depenses)}</div>
        </div>
      </div>

      <div style={{padding:'0 1rem', marginTop:'-1px'}}>
        <div style={{background:'white', borderRadius:'16px', padding:'14px 16px', marginBottom:'1rem', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div style={{fontSize:'11px', color:'#9b8fb5', marginBottom:'4px'}}>Solde du mois</div>
            <div style={{fontSize:'22px', fontWeight:'700', color: solde >= 0 ? '#0f766e' : '#be123c'}}>
              {solde < 0 ? '−' : ''}{fmt(Math.abs(solde))}
            </div>
          </div>
          <div style={{width:'36px', height:'36px', borderRadius:'50%', background: solde >= 0 ? '#d4f4ee' : '#fde8e8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', fontWeight:'700', color: solde >= 0 ? '#0f766e' : '#be123c'}}>
            {solde >= 0 ? '+' : '−'}
          </div>
        </div>
      </div>
    </>
  )
}