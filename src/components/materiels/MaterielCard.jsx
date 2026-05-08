import { AlertTriangle, Box, MapPin, Package2, UserRound } from 'lucide-react'
import { getDueReturnInfo, getEtatMeta, getStatutMeta } from './materielHelpers'

export default function MaterielCard({ materiel, C, onOpen }) {
  const statut = getStatutMeta(materiel.statut, C)
  const etat = getEtatMeta(materiel.etat, C)
  const due = getDueReturnInfo(materiel.currentDueAt, materiel.statut, C)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="materiel-card"
      style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 18, boxShadow: C.shadow, padding: 14, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, background: materiel.photoUrl ? 'transparent' : C.surf2, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {materiel.photoUrl ? (
            <img src={materiel.photoUrl} alt={materiel.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Package2 size={22} color={C.teal} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
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
          <span>{materiel.responsableNom || 'Aucun responsable'}</span>
        </div>
        {materiel.type === 'consommable' && materiel.statut === 'stock_faible' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--font-xs)', color: C.coral }}>
            <AlertTriangle size={13} />
            <span>Stock faible</span>
          </div>
        )}
      </div>
    </button>
  )
}
