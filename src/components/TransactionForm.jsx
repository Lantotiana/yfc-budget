import { useState, useEffect } from 'react'
import { collection, addDoc, deleteDoc, doc, onSnapshot, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { auth } from '../auth'

export default function TransactionForm({ onAdd }) {
  const [type, setType] = useState('entree')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [montant, setMontant] = useState('')
  const [motif, setMotif] = useState('')
  const [motifCustom, setMotifCustom] = useState('')
  const [note, setNote] = useState('')
  const [motifs, setMotifs] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [newMotif, setNewMotif] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'motifs'), snap => {
      setMotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  const filteredMotifs = motifs.filter(m => m.type === type)

  useEffect(() => {
    setMotif('')
    setMotifCustom('')
  }, [type])

  async function handleSubmit(e) {
    e.preventDefault()
    const motifFinal = motif === 'Autre' ? motifCustom.trim() : motif
    if (!montant || !motifFinal) {
      alert('Veuillez remplir le montant et le motif.')
      return
    }

    const user = auth.currentUser
    let createdBy = null
    if (user) {
      let nom = user.displayName || user.email
      let photoURL = user.photoURL || null
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists()) {
          const data = userDoc.data()
          nom = data.nom || data.displayName || data.prenom || nom
          photoURL = data.photoURL || photoURL
        }
      } catch (err) {
        console.warn('Impossible de charger le profil utilisateur', err)
      }
      createdBy = {
        uid: user.uid,
        nom,
        email: user.email,
        photoURL
      }
    }

    onAdd({
      type,
      date,
      montant: Number(montant),
      motif: motifFinal,
      note,
      createdBy,
      createdAt: new Date().toISOString()
    })
    setMontant('')
    setMotif('')
    setMotifCustom('')
    setNote('')
  }

  async function addMotif() {
    if (!newMotif.trim()) return
    await addDoc(collection(db, 'motifs'), { name: newMotif.trim(), type })
    setNewMotif('')
  }

  async function deleteMotif(m) {
    await deleteDoc(doc(db, 'motifs', m.id))
  }

  return (
    <>
      <div className="card">
        <div className="card-title">Nouvelle transaction</div>

        <div className="type-toggle">
          <button type="button" className={`type-btn ${type === 'entree' ? 'active-entree' : ''}`} onClick={() => setType('entree')}>
            + Entrée
          </button>
          <button type="button" className={`type-btn ${type === 'depense' ? 'active-depense' : ''}`} onClick={() => setType('depense')}>
            − Dépense
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Montant (Ar)</label>
              <input type="number" value={montant} onChange={e => setMontant(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="form-group">
            <label>Motif</label>
            <div className="motif-row">
              <select value={motif} onChange={e => { setMotif(e.target.value); setMotifCustom('') }}>
                <option value="">Choisir...</option>
                {filteredMotifs.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
                <option value="Autre">Autre</option>
              </select>
              <button type="button" className="btn-secondary" onClick={() => setShowModal(true)}>
                + Motifs
              </button>
            </div>
          </div>

          {motif === 'Autre' && (
            <div className="form-group">
              <label>Précisez le motif</label>
              <input
                type="text"
                value={motifCustom}
                onChange={e => setMotifCustom(e.target.value)}
                placeholder="Ex: Achat matériel évangélisation..."
                autoFocus
              />
            </div>
          )}

          <div className="form-group">
            <label>Note (optionnel)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Détail..." />
          </div>

          <button className="btn-primary">Enregistrer</button>
        </form>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem'}}>
              <h3 style={{fontSize:'16px', fontWeight:'700', color:'var(--text-primary)'}}>
                Motifs {type === 'entree' ? 'Entrée' : 'Dépense'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{background:'none', border:'none', cursor:'pointer', fontSize:'18px', color:'var(--text-secondary)'}}>✕</button>
            </div>

            <div style={{display:'flex', flexDirection:'column', gap:'6px', marginBottom:'1.25rem'}}>
              {filteredMotifs.length === 0 && (
                <div style={{fontSize:'13px', color:'var(--text-secondary)', padding:'8px 0'}}>Aucun motif — ajoutez-en ci-dessous</div>
              )}
              {filteredMotifs.map(m => (
                <div key={m.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'var(--surface-alt)', borderRadius:'10px'}}>
                  <span
                    style={{fontSize:'13px', fontWeight:'500', color:'var(--text-primary)', cursor:'pointer', flex:1}}
                    onClick={() => { setMotif(m.name); setMotifCustom(''); setShowModal(false) }}
                  >
                    {m.name}
                  </span>
                  <button
                    onClick={() => deleteMotif(m)}
                    style={{background:'#fde8e8', border:'none', color:'#be123c', borderRadius:'6px', padding:'4px 8px', cursor:'pointer', fontSize:'12px', fontWeight:'600', fontFamily:'inherit'}}
                  >
                    Supprimer
                  </button>
                </div>
              ))}
            </div>

            <div style={{display:'flex', gap:'8px', marginBottom:'1rem'}}>
              <input
                value={newMotif}
                onChange={e => setNewMotif(e.target.value)}
                placeholder={`Nouveau motif ${type === 'entree' ? 'entrée' : 'dépense'}...`}
                onKeyDown={e => e.key === 'Enter' && addMotif()}
                style={{flex:1, padding:'10px 12px', border:'none', borderRadius:'10px', fontSize:'13px', fontFamily:'inherit', outline:'none', background:'var(--input-bg)', color:'var(--text-primary)'}}
              />
              <button
                onClick={addMotif}
                style={{padding:'10px 14px', background:'var(--btn-primary-bg)', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontSize:'13px', fontWeight:'700', fontFamily:'inherit', whiteSpace:'nowrap'}}
              >
                Ajouter
              </button>
            </div>

            <button className="btn-primary" onClick={() => setShowModal(false)}>Fermer</button>
          </div>
        </div>
      )}
    </>
  )
}
