export const MATERIEL_CATEGORIES = ['Sonorisation', 'Média', 'Informatique', 'Mobilier', 'Décoration', 'Événementiel', 'Fournitures', 'Vêtements', 'Autre']
export const MATERIEL_UNITES = ['pièce', 'lot', 'paquet', 'boîte', 'unité']

export function getStatutMeta(statut, C) {
  const map = {
    disponible: { label: 'Disponible', bg: 'rgba(37, 99, 235, 0.12)', fg: '#2563eb' },
    emprunte: { label: 'Emprunté', bg: C.amberD, fg: C.amber },
    reserve: { label: 'Réservé', bg: C.violetD, fg: C.violet },
    en_reparation: { label: 'En réparation', bg: C.violetD, fg: C.violet },
    perdu: { label: 'Perdu', bg: C.coralD, fg: C.coral },
    stock_faible: { label: 'Stock faible', bg: C.coralD, fg: C.coral },
    archive: { label: 'Archivé', bg: C.surf2, fg: C.t2 },
  }
  return map[statut] || { label: statut || 'Inconnu', bg: C.surf2, fg: C.t2 }
}

export function getEtatMeta(etat, C) {
  const map = {
    bon: { label: 'Bon état', bg: C.tealD, fg: C.teal },
    a_verifier: { label: 'À vérifier', bg: C.amberD, fg: C.amber },
    endommage: { label: 'Endommagé', bg: C.coralD, fg: C.coral },
    perdu: { label: 'Perdu', bg: C.surf2, fg: C.t2 },
    en_reparation: { label: 'En réparation', bg: C.violetD, fg: C.violet },
  }
  return map[etat] || { label: etat || 'Inconnu', bg: C.surf2, fg: C.t2 }
}

export function computeStockStatus(materiel) {
  if (materiel.archivedAt) return 'archive'
  if (materiel.etat === 'perdu') return 'perdu'
  if (materiel.etat === 'en_reparation') return 'en_reparation'
  if (materiel.type === 'consommable' && materiel.seuilAlerte != null && Number(materiel.quantite || 0) <= Number(materiel.seuilAlerte || 0)) return 'stock_faible'
  return materiel.statut || 'disponible'
}

export function getDueReturnInfo(dueAt, statut, C) {
  if (statut !== 'emprunte' || !dueAt) return null
  const due = new Date(dueAt)
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diffDays = Math.floor((dueStart - start) / 86400000)
  if (diffDays < 0) return { label: 'Retour en retard', bg: C.coralD, fg: C.coral, late: true }
  if (diffDays === 0) return { label: "Retour aujourd'hui", bg: C.amberD, fg: C.amber, late: false }
  return { label: `Retour ${due.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`, bg: C.surf2, fg: C.t2, late: false }
}

export function formatMovementLabel(type) {
  const map = {
    creation: 'Création',
    modification: 'Modification',
    sortie: 'Sortie',
    retour: 'Retour',
    reservation: 'Réservation',
    annulation: 'Annulation',
    maintenance: 'Maintenance',
    perte: 'Perte',
    stock_ajout: 'Ajout de stock',
    stock_retrait: 'Retrait de stock',
    archivage: 'Archivage',
  }
  return map[type] || type
}
