import { getFunctions } from 'firebase/functions'
import { app } from './firebase'

export const cloudFunctions = getFunctions(app)
