import { initializeApp } from 'firebase/app'
import { GithubAuthProvider, GoogleAuthProvider, getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getDatabase } from 'firebase/database'

const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

const firebaseConfig = {
  apiKey: validateEnv('VITE_FIREBASE_API_KEY'),
  authDomain: validateEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: validateEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: validateEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: validateEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: validateEnv('VITE_FIREBASE_APP_ID'),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)
const database = getDatabase(app, import.meta.env.VITE_FIREBASE_DATABASE_URL)

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

const githubProvider = new GithubAuthProvider()
githubProvider.setCustomParameters({ allow_signup: 'true' })

function validateEnv(key: (typeof requiredEnvVars)[number]) {
  const value = import.meta.env[key]

  if (!value) {
    throw new Error(`Missing Firebase env variable: ${key}`)
  }

  return value
}

export { app, auth, db, storage, database, googleProvider, githubProvider }
