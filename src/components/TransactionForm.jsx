import { useState, useEffect } from 'react'
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot
} from 'firebase/firestore'
import { db } from '../firebase'

export default function TransactionForm({ onAdd }) {
  const [type, setType] = useState('entree')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [montant, setMontant] = useState('')
  const [motif, setMotif] = useState('')
  const [note, setNote] = useState('')

  const [motifs, setMotifs] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [newMotif, setNewMotif] = useState('')

  /* 🔥 LOAD FROM FIREBASE */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'motifs'), (snap) => {
      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }))
      setMotifs(data)
    })

    return () => unsub()
  }, [])

  /* 🔥 FILTER PAR TYPE */
  const filteredMotifs = motifs.filter(m => m.type === type)

  /* 🔥 RESET motif quand on change type */
  useEffect(() => {
    setMotif('')
  }, [type])

  function handleSubmit(e) {
    e.preventDefault()
    if (!montant || !motif) return

    onAdd({
      type,
      date,
      montant: Number(montant),
      motif,
      note
    })

    setMontant('')
    setMotif('')
    setNote('')
  }

  /* 🔥 ADD MOTIF avec type */
  async function addMotif() {
    if (!newMotif.trim()) return

    await addDoc(collection(db, 'motifs'), {
      name: newMotif.trim(),
      type: type // 🔥 clé
    })

    setNewMotif('')
  }

  /* 🔥 DELETE */
  async function deleteMotif(m) {
    await deleteDoc(doc(db, 'motifs', m.id))
  }

  return (
    <>
      <div className="card">
        <div className="card-title">Nouvelle transaction</div>

        <div className="type-toggle">
          <button
            type="button"
            className={`type-btn ${type === 'entree' ? 'active-entree' : ''}`}
            onClick={() => setType('entree')}
          >
            + Entrée
          </button>

          <button
            type="button"
            className={`type-btn ${type === 'depense' ? 'active-depense' : ''}`}
            onClick={() => setType('depense')}
          >
            − Dépense
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Montant (Ar)</label>
              <input
                type="number"
                value={montant}
                onChange={e => setMontant(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Motif</label>

            <div className="motif-row">
              <select
                value={motif}
                onChange={e => setMotif(e.target.value)}
              >
                <option value="">Choisir...</option>

                {filteredMotifs.map(m => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn-motif"
                onClick={() => setShowModal(true)}
              >
                + Motifs
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Note (optionnel)</label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Détail..."
            />
          </div>

          <button className="btn-primary">
            Enregistrer
          </button>
        </form>
      </div>

      {/* 🔥 MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>
              Motifs {type === 'entree' ? 'Entrée' : 'Dépense'}
            </h3>

            <div className="chip-list">
              {filteredMotifs.map(m => (
                <div key={m.id} className="chip">
                  <span
                    onClick={() => {
                      setMotif(m.name)
                      setShowModal(false)
                    }}
                  >
                    {m.name}
                  </span>

                  <button onClick={() => deleteMotif(m)}>
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="add-motif-row">
              <input
                value={newMotif}
                onChange={e => setNewMotif(e.target.value)}
                placeholder={`Nouveau motif ${type}`}
              />

              <button
                className="btn-secondary"
                onClick={addMotif}
              >
                Ajouter
              </button>
            </div>

            <button
              className="btn-primary"
              onClick={() => setShowModal(false)}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  )
}