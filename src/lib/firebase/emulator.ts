// Firebaseエミュレーター接続ヘルパー
import { connectFirestoreEmulator } from 'firebase/firestore'
import { connectAuthEmulator } from 'firebase/auth'
import { db, auth } from './client'

// エミュレーター接続状態を追跡
let emulatorsConnected = false

/**
 * Firebaseエミュレーターに接続する関数
 * テスト環境や開発環境で使用する
 */
export const connectToEmulators = () => {
  // 既に接続済みの場合は何もしない
  if (emulatorsConnected) {
    console.log('Firebase emulators already connected')
    return
  }

  try {
    // Firestoreエミュレーターに接続（デフォルトポート: 8080）
    connectFirestoreEmulator(db, 'localhost', 8080)
    console.log('Connected to Firestore emulator at localhost:8080')

    // Authエミュレーターに接続（ポート: 9099）
    connectAuthEmulator(auth, 'http://localhost:9099')
    console.log('Connected to Auth emulator at localhost:9099')

    emulatorsConnected = true
    console.log('All Firebase emulators connected successfully')
  } catch (error) {
    // 既に接続済みエラーの場合は成功とみなす
    if (error instanceof Error && error.message.includes('already been called')) {
      console.log('Emulators were already connected, marking as successful')
      emulatorsConnected = true
      return
    }

    // エラーが発生してもアプリケーションを停止させない
    console.warn('Continuing without emulators...')
  }
}

/**
 * エミュレータ接続状態を取得する関数
 */
export const isEmulatorConnected = () => {
  return emulatorsConnected
}
