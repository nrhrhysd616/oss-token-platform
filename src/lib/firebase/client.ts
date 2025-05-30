// Firebaseクライアント初期化ファイル
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth' // 追加
import { firebaseConfig } from './config'

// Firebaseの初期化（クライアント側）
// 既に初期化されている場合は既存のインスタンスを使用
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

// Firestoreインスタンスの取得
export const db = getFirestore(firebaseApp)

// Firebase Authインスタンスの取得（追加）
export const auth = getAuth(firebaseApp)

// 開発環境の場合のみエミュレータに接続
if (process.env.NODE_ENV !== 'production') {
  import('./emulator').then(({ connectToEmulators }) => {
    connectToEmulators()
  })
}
