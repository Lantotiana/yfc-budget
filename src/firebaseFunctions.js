import { getFunctions } from 'firebase/functions'
import { app } from './firebase'

// Functions est isolé pour les appels IA/push/admin, hors chemin critique d'affichage.
export const cloudFunctions = getFunctions(app)
