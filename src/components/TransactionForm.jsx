import { useState } from 'react'

const DEFAULT_MOTIFS = {
  entree: ['Don membres', 'Quête vendredi', 'Don extérieur', 'Cotisation'],
  depense: ['Sortie prédication', 'Transport', 'Matériel', 'Impression', 'Restauration', 'Autre']
}

export default function TransactionForm({ onAdd }) {
  const [type, setType] = useState('entree')
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [montant, setMontant] = useState('')
  const [note, setNote] = useState('')
  const [motifs, setMotifs] = useState(DEFAULT_MOTIFS)
  const [motifSel, setMotifSel] = useState(DEFAULT_MOTIFS.entree[0])
  const [showModal, setShowModal] = useState(false)
  const [newMotif, setNewMotif] = useState('')

  function changeType(t) {
    setType(t)
    setMotifSel(motifs[t][0])
  }

  function handleSubmit() {
    if (!date || !montant || isNaN(montant) || Number(montant) <= 0) {
      alert('Veuillez remplir la date et le montant.')
      return
    }
    onAdd({ date, type, motif: motifSel, montant: Number(montant), note })
    setMontant('')
    setNote('')
  }

  function addMotif() {
    if (!newMotif.trim()) return
    const updated = { ...motifs, [type]: [...motifs[type], newMotif.trim()] }
    setMotifs(updated)
    setNewMotif('')
  }

  function removeMotif(t, i) {
    const updated = { ...motifs, [t]: motifs[t].filter((_, idx) => idx !== i) }
    setMotifs(updated)
  }

  return (
    <>
      <div className="card">
        <div className="card-title">Nouvelle transaction</div>
        <div className="type-toggle">
          <button className={`type-btn ${type === 'entree' ? 'active-entree' : ''}`} onClick={() => changeType('entree')}>+ Entrée</button>
          <button className={`type-btn ${type === 'depense' ? 'active-depense' : ''}`} onClick={() => changeType('depense')}>− Dépense</button>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Montant (Ar)</label>
            <input type="number" value={montant} onChange={e => setMontant(e.target.value)} placeholder="0" min="0" />
          </div>
        </div>
        <div className="form-group">
          <label>Motif</label>
          <div className="motif-row">
            <select value={motifSel} onChange={e => setMotifSel(e.target.value)}>
              {motifs[type].map(m => <option key={m}>{m}</option>)}
            </select>
            <button className="btn-secondary" onClick={() => setShowModal(true)}>+ Motifs</button>
          </div>
        </div>
        <div className="form-group">
          <label>Note (optionnel)</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Détail..." />
        </div>
        <button className="btn-primary" onClick={handleSubmit}>Enregistrer</button>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Gérer les motifs</h3>
            {['entree', 'depense'].map(t => (
              <div key={t}>
                <div style={{fontSize:'11px',color:'#999',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:'6px'}}>
                  {t === 'entree' ? 'Entrées' : 'Dépenses'}
                </div>
                <div className="chip-list">
                  {motifs[t].map((m, i) => (
                    <div className="chip" key={i}>
                      <span>{m}</span>
                      <button onClick={() => removeMotif(t, i)}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="add-motif-row">
              <input value={newMotif} onChange={e => setNewMotif(e.target.value)} placeholder={`Nouveau motif ${type === 'entree' ? 'entrée' : 'dépense'}...`} />
              <button className="btn-secondary" onClick={addMotif}>Ajouter</button>
            </div>
            <button className="btn-primary" onClick={() => setShowModal(false)}>Fermer</button>
          </div>
        </div>
      )}
    </>
  )
}