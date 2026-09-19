import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore/lite'

// A Firebase *web* config is not a secret: it ships to every visitor's browser anyway.
// What protects the data is firestore.rules (anyone may submit, only admins may read).
const firebaseConfig = {
  apiKey: 'AIzaSyBESD_f8oXj6RDJmrcEUb5tPw9-7b-ncDI',
  authDomain: 'pantomime-baseline.firebaseapp.com',
  projectId: 'pantomime-baseline',
  storageBucket: 'pantomime-baseline.firebasestorage.app',
  messagingSenderId: '421834862931',
  appId: '1:421834862931:web:e61f5a067255f89634b1a6',
}

// `npm run dev:local` sets VITE_LOCAL_MODE=true: answers stay in this browser and nothing reaches Firebase.
export const isFirebaseConfigured = import.meta.env.VITE_LOCAL_MODE !== 'true'

// Auth is only needed on the results page, so it is set up there (keeps it out of the participant bundle).
export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null
export const db = app ? getFirestore(app) : null
