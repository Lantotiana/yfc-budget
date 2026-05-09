import { AlertTriangle, Box, MapPin, Package2, Trash2, UserRound } from 'lucide-react'
import { getDueReturnInfo, getEtatMeta, getStatutMeta } from './materielHelpers'

export default function MaterielCard({ materiel, C, onOpen, onDelete }) {
  const statut = getStatutMeta(materiel.statut, C)
  const etat = getEtatMeta(materiel.etat, C)
  const due = getDueReturnInfo(materiel.currentDueAt, materiel.statut, C)
  const responsables = Array.isArray(materiel.responsablesNoms) && materiel.responsablesNoms.length > 0
    ? materiel.responsablesNoms.join(', ')
    : materiel.responsableNom

  return (
    <div
      className="materiel-card"
      style={{ position: 'relative', background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 18, boxShadow: C.shadow, padding: 14, textAlign: 'left' }}
    >
      {onDelete && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.bord}`, background: 'transparent', cursor: 'pointer', color: C.coral, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Trash2 size={14} />
        </button>
      )}

      <div onClick={onOpen} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, background: materiel.photoUrl ? 'transparent' : C.surf2, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {materiel.photoUrl ? (
              <img src={materiel.photoUrl} alt={materiel.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Package2 size={22} color={C.teal} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingRight: onDelete ? 28 : 0 }}>
            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 800, color: C.t1, lineHeight: 1.3 }}>{materiel.nom}</div>
            <div style={{ fontSize: 'var(--font-xs)', color: C.t2, marginTop: 3 }}>{materiel.categorie || 'Autre'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              <span style={{ padding: '5px 9px', borderRadius: 999, background: statut.bg, color: statut.fg, fontSize: 'var(--font-xs)', fontWeight: 700 }}>{statut.label}</span>
              <span style={{ padding: '5px 9px', borderRadius: 999, background: etat.bg, color: etat.fg, fontSize: 'var(--font-xs)', fontWeight: 700 }}>{etat.label}</span>
              {due && (
                <span style={{ padding: '5px 9px', borderRadius: 999, background: due.bg, color: due.fg, fontSize: 'var(--font-xs)', fontWeight: 700 }}>
                  {due.label}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--font-xs)', color: C.t2 }}>
            <Box size={13} />
            <span>{materiel.type === 'consommable' ? `${materiel.quantite || 0} ${materiel.unite || 'pièce'}` : materiel.type === 'durable' ? 'Matériel durable' : 'Matériel'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--font-xs)', color: C.t2 }}>
            <MapPin size={13} />
            <span>{materiel.lieuActuel || 'Lieu non renseigné'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--font-xs)', color: C.t2 }}>
            <UserRound size={13} />
            <span>{responsables || 'Aucun responsable'}</span>
          </div>
          {materiel.type === 'consommable' && materiel.statut === 'stock_faible' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--font-xs)', color: C.coral }}>
              <AlertTriangle size={13} />
              <span>Stock faible</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
