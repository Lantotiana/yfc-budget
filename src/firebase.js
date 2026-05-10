import { initializeApp } from 'firebase/app'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCv109BcBb7JPtybDJbaLk9lln8kxdMh44",
  authDomain: "yfc-budget.firebaseapp.com",
  projectId: "yfc-budget",
  storageBucket: "yfc-budget.firebasestorage.app",
  messagingSenderId: "998337155628",
  appId: "1:998337155628:web:19c1a6f7fba9530827f789"
}

export const app = initializeApp(firebaseConfig)

// Persistence locale activée : les écritures survivent aux coupures réseau
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
})

