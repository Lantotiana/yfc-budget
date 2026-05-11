import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Portal from '../Portal'
import { MATERIEL_UNITES } from './materielHelpers'

export default function KitChecklistModal({ kit, mode, lastSortieElements, onClose, onConfirm, C, saving }) {
  const today = new Date().toISOString().slice(0, 10)

  const [meta, setMeta] = useState(
    mode === 'sortie'
      ? { personneResponsable: '', dateRetourPrevue: '', commentaire: '' }
      : { dateRetourReelle: today, lieuActuel: kit.lieuActuel || '', commentaire: '' }
  )

  const sourceElements = mode === 'sortie'
    ? (kit.kitElements || [])
    : (lastSortieElements || kit.kitElements || [])

  const [items, setItems] = useState(
    mode === 'sortie'
      ? sourceElements.map(el => ({ ...el, checked: false, quantiteReelle: el.quantitePrevue }))
      : sourceElements.map(el => ({ ...el, quantiteRetour: String(el.quantiteReelle ?? el.quantitePrevue ?? 1) }))
  )

  function updateItem(id, patch) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  const missingItems = mode === 'retour'
    ? items.filter(item => Number(item.quantiteRetour || 0) < Number(item.quantiteReelle ?? item.quantitePrevue ?? 0))
    : []

  const allChecked = items.every(item => item.checked)
  const canConfirm = mode === 'sortie'
    ? (allChecked && meta.personneResponsable.trim() && meta.dateRetourPrevue)
    : true

  return (
    <Portal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
          <div className="dialog-title" style={{ marginBottom: 2 }}>
            {mode === 'sortie' ? 'Sortie du kit' : 'Retour du kit'}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginBottom: 16 }}>{kit.nom}</div>

          <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
            {mode === 'sortie' ? (
              <>
                <div>
                  <label className="form-label">Personne responsable *</label>
                  <input
                    className="form-input"
                    value={meta.personneResponsable}
                    onChange={e => setMeta(prev => ({ ...prev, personneResponsable: e.target.value }))}
                    placeholder="Nom de la personne"
                  />
                </div>
                <div>
                  <label className="form-label">Date de retour prévue *</label>
                  <input
                    className="form-input"
                    type="date"
                    value={meta.dateRetourPrevue}
                    onChange={e => setMeta(prev => ({ ...prev, dateRetourPrevue: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Commentaire</label>
                  <input
                    className="form-input"
                    value={meta.commentaire}
                    onChange={e => setMeta(prev => ({ ...prev, commentaire: e.target.value }))}
                    placeholder="Motif, événement…"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="form-label">Date de retour réelle</label>
                  <input
                    className="form-input"
                    type="date"
                    value={meta.dateRetourReelle}
                    onChange={e => setMeta(prev => ({ ...prev, dateRetourReelle: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Lieu de rangement</label>
                  <input
                    className="form-input"
                    value={meta.lieuActuel}
                    onChange={e => setMeta(prev => ({ ...prev, lieuActuel: e.target.value }))}
                    placeholder="Local YFC…"
                  />
                </div>
              </>
            )}
          </div>

          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            {mode === 'sortie' ? 'Vérification des éléments' : 'Quantités retournées'}
          </div>

          <div style={{ display: 'grid', gap: 7, maxHeight: 260, overflowY: 'auto' }}>
            {items.length === 0 && (
              <div style={{ fontSize: 'var(--font-sm)', color: C.t2, textAlign: 'center', padding: '1rem 0' }}>
                Aucun élément défini pour ce kit.
              </div>
            )}
            {items.map(item => (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 12,
                  background: mode === 'sortie' && item.checked ? C.tealD : C.surf2,
                  border: `1px solid ${C.bord}`,
                  cursor: mode === 'sortie' ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                }}
                onClick={mode === 'sortie' ? () => updateItem(item.id, { checked: !item.checked }) : undefined}
              >
                {mode === 'sortie' && (
                  <span style={{
                    width: 20, height: 20, borderRadius: 6,
                    border: `2px solid ${item.checked ? C.teal : C.bord}`,
                    background: item.checked ? C.teal : 'transparent',
                    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {item.checked && (
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                        <path d="M2.5 7L5.5 10L11.5 4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                )}
                <span style={{ flex: 1, fontSize: 'var(--font-sm)', fontWeight: 600, color: C.t1 }}>{item.nom}</span>
                {mode === 'sortie' ? (
                  <span style={{ fontSize: 'var(--font-xs)', color: C.t2, flexShrink: 0 }}>
                    {item.quantitePrevue} {item.unite || 'pièce'}
                  </span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                    <input
                      type="number"
                      min="0"
                      value={item.quantiteRetour}
                      onChange={e => updateItem(item.id, { quantiteRetour: e.target.value })}
                      style={{
                        width: 52, fontSize: 'var(--font-sm)', padding: '4px 6px', borderRadius: 8,
                        border: `1px solid ${Number(item.quantiteRetour || 0) < Number(item.quantiteReelle ?? item.quantitePrevue ?? 0) ? C.coral : C.bord}`,
                        background: C.surf, color: C.t1, textAlign: 'center', fontFamily: 'inherit',
                      }}
                    />
                    <span style={{ fontSize: 'var(--font-xs)', color: C.t2, flexShrink: 0 }}>
                      / {item.quantiteReelle ?? item.quantitePrevue} {item.unite || 'pièce'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {missingItems.length > 0 && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 12, background: C.coralD, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <AlertTriangle size={14} color={C.coral} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 'var(--font-xs)', color: C.coral, lineHeight: 1.55 }}>
                <strong>Kit incomplet · </strong>
                {missingItems.map((item, i) => {
                  const retour = Number(item.quantiteRetour || 0)
                  const attendu = Number(item.quantiteReelle ?? item.quantitePrevue ?? 0)
                  const manque = attendu - retour
                  return `${manque > 1 ? `${manque}× ` : ''}${item.nom}${i < missingItems.length - 1 ? ', ' : ''}`
                }).join('')}
                {' '}manquant{missingItems.length > 1 ? 's' : ''}.
              </div>
            </div>
          )}

          {mode === 'sortie' && !allChecked && items.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 'var(--font-xs)', color: C.t2, textAlign: 'center' }}>
              Cochez tous les éléments pour confirmer la sortie.
            </div>
          )}

          <div className="dialog-footer" style={{ marginTop: 16 }}>
            <button className="btn-secondary materiel-footer-btn" onClick={onClose}>Annuler</button>
            <button
              className="materiel-primary-btn"
              disabled={saving || !canConfirm}
              onClick={() => onConfirm(items, missingItems, meta)}
            >
              {saving ? 'Enregistrement...' : mode === 'sortie' ? 'Confirmer la sortie' : 'Confirmer le retour'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
