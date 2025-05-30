// Firebaseエミュレータ接続テスト用ファイル
import { getAdminDb } from './admin'
import { db } from './client'
import { collection, addDoc, getDocs } from 'firebase/firestore'

/**
 * クライアント側Firestoreエミュレータのテスト
 */
export async function testClientFirestore() {
  try {
    console.log('Testing client-side Firestore emulator...')

    // テストデータを追加
    const testCollection = collection(db, 'test')
    const docRef = await addDoc(testCollection, {
      message: 'Hello from client emulator!',
      timestamp: new Date(),
    })

    console.log('Client: Document written with ID:', docRef.id)

    // データを読み取り
    const querySnapshot = await getDocs(testCollection)
    console.log('Client: Documents in test collection:', querySnapshot.size)

    return true
  } catch (error) {
    console.error('Client Firestore test failed:', error)
    return false
  }
}

/**
 * Admin SDK Firestoreエミュレータのテスト
 */
export async function testAdminFirestore() {
  try {
    console.log('Testing admin-side Firestore emulator...')

    const adminDb = getAdminDb()

    // テストデータを追加
    const docRef = await adminDb.collection('admin-test').add({
      message: 'Hello from admin emulator!',
      timestamp: new Date(),
    })

    console.log('Admin: Document written with ID:', docRef.id)

    // データを読み取り
    const snapshot = await adminDb.collection('admin-test').get()
    console.log('Admin: Documents in admin-test collection:', snapshot.size)

    return true
  } catch (error) {
    console.error('Admin Firestore test failed:', error)
    return false
  }
}

/**
 * 両方のFirestoreエミュレータをテスト
 */
export async function testBothFirestoreEmulators() {
  console.log('=== Firebase Emulator Test ===')

  const clientResult = await testClientFirestore()
  const adminResult = await testAdminFirestore()

  if (clientResult && adminResult) {
    console.log('✅ All Firestore emulator tests passed!')
    return true
  } else {
    console.log('❌ Some Firestore emulator tests failed')
    console.log(`Client test: ${clientResult ? '✅' : '❌'}`)
    console.log(`Admin test: ${adminResult ? '✅' : '❌'}`)
    return false
  }
}
