import { getStorage } from 'firebase/storage'
import { app } from './firebase'

// Storage est isolé pour éviter de le charger avec le bundle initial.
export const storage = getStorage(app)
