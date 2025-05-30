// Firebase Admin SDK初期化ファイル
import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getFirestore, Firestore } from 'firebase-admin/firestore'
import { getAuth, Auth } from 'firebase-admin/auth'

let adminApp: App
let adminDb: Firestore
let adminAuth: Auth

/**
 * Firebase Admin SDKを初期化
 */
function initializeAdminApp(): App {
  if (!getApps().length) {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })
  }
  return getApps()[0]
}

/**
 * Admin SDK用Firestoreインスタンスを取得
 */
export function getAdminDb(): Firestore {
  if (!adminDb) {
    if (!adminApp) {
      adminApp = initializeAdminApp()
    }

    // Firestoreインスタンスを取得
    adminDb = getFirestore(adminApp)

    // エミュレータ環境の場合、環境変数で自動的に接続される
    if (process.env.NODE_ENV !== 'production' && process.env.FIRESTORE_EMULATOR_HOST) {
      console.log(`Admin SDK: Using Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`)
    }
  }
  return adminDb
}

/**
 * Admin SDK用Authインスタンスを取得
 */
export function getAdminAuth(): Auth {
  if (!adminAuth) {
    if (!adminApp) {
      adminApp = initializeAdminApp()
    }
    adminAuth = getAuth(adminApp)
  }
  return adminAuth
}

/**
 * Admin SDKアプリインスタンスを取得
 */
export function getAdminApp(): App {
  if (!adminApp) {
    adminApp = initializeAdminApp()
  }
  return adminApp
}
