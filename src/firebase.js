import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'     

const firebaseConfig = {
  apiKey: "AIzaSyCv109BcBb7JPtybDJbaLk9lln8kxdMh44",
  authDomain: "yfc-budget.firebaseapp.com",
  projectId: "yfc-budget",
  storageBucket: "yfc-budget.firebasestorage.app",
  messagingSenderId: "998337155628",
  appId: "1:998337155628:web:19c1a6f7fba9530827f789"
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)    