'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GithubAuthProvider,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { auth } from './client'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from './client'
import { UserRole, Wallet } from '@/types/user'
import { FIRESTORE_COLLECTIONS } from './collections'

// 認証コンテキストの型定義
type AuthContextType = {
  user: User | null
  userRoles: UserRole[]
  currentMode: UserRole | null
  loading: boolean
  signInWithGithub: () => Promise<void>
  signOut: () => Promise<void>
  switchMode: (mode: UserRole) => Promise<{ success: boolean; requiresWallet?: boolean }>
  updateUserRoles: (roles: UserRole[], defaultMode: UserRole) => Promise<void>
  checkWalletConnection: () => Promise<boolean>
}

// 認証コンテキストの作成
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// 認証プロバイダーコンポーネント
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [currentMode, setCurrentMode] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  // GitHub認証
  const signInWithGithub = async () => {
    try {
      const provider = new GithubAuthProvider()
      provider.addScope('read:user')
      const result = await signInWithPopup(auth, provider)

      // ユーザー情報をFirestoreに保存
      const user = result.user
      const userRef = doc(db, FIRESTORE_COLLECTIONS.USERS, user.uid)

      // 既存のユーザーデータを取得
      const userDoc = await getDoc(userRef)

      // ユーザーデータを更新または作成
      await setDoc(
        userRef,
        {
          uid: user.uid,
          email: user.email,
          githubId: result.user.providerData[0].uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          lastLogin: new Date(),
        },
        { merge: true }
      )
    } catch (error) {
      console.error('GitHub認証エラー:', error)
    }
  }

  // サインアウト
  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
      setUserRoles([])
      setCurrentMode(null)
    } catch (error) {
      console.error('サインアウトエラー:', error)
    }
  }

  // ウォレット連携状態をチェック
  const checkWalletConnection = async (): Promise<boolean> => {
    if (!user) return false

    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/xaman/wallets', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) return false

      const wallets = (await response.json()) as Wallet[]
      return (
        wallets && wallets.length > 0 && wallets.some((wallet: any) => wallet.status === 'linked')
      )
    } catch (error) {
      console.error('ウォレット連携状態の確認に失敗:', error)
      return false
    }
  }

  // モード切り替え
  const switchMode = async (
    mode: UserRole
  ): Promise<{ success: boolean; requiresWallet?: boolean }> => {
    if (!userRoles.includes(mode)) {
      return { success: false }
    }

    // maintainerモードへの切り替え時にウォレット連携をチェック
    if (mode === 'maintainer') {
      const hasWallet = await checkWalletConnection()
      if (!hasWallet) {
        return { success: false, requiresWallet: true }
      }
    }

    setCurrentMode(mode)
    localStorage.setItem('currentMode', mode)
    return { success: true }
  }

  // ユーザーロール更新
  const updateUserRoles = async (roles: UserRole[], defaultMode: UserRole) => {
    if (!user) return

    try {
      const userRef = doc(db, FIRESTORE_COLLECTIONS.USERS, user.uid)
      await setDoc(
        userRef,
        {
          roles,
          defaultMode,
        },
        { merge: true }
      )
      setUserRoles(roles)
      setCurrentMode(defaultMode)
      localStorage.setItem('currentMode', defaultMode)
    } catch (error) {
      console.error('ユーザーロール更新エラー:', error)
    }
  }

  // ユーザーデータの読み込み
  const loadUserData = async (user: User) => {
    try {
      const userRef = doc(db, FIRESTORE_COLLECTIONS.USERS, user.uid)
      const userDoc = await getDoc(userRef)

      if (userDoc.exists()) {
        const userData = userDoc.data()
        const roles = userData.roles || []
        const defaultMode = userData.defaultMode || null

        setUserRoles(roles)

        // ローカルストレージから現在のモードを復元、なければデフォルトモードを使用
        const savedMode = localStorage.getItem('currentMode') as UserRole
        if (savedMode && roles.includes(savedMode)) {
          setCurrentMode(savedMode)
        } else if (defaultMode && roles.includes(defaultMode)) {
          setCurrentMode(defaultMode)
        } else {
          setCurrentMode(null)
        }
      } else {
        // 新規ユーザーの場合、ロールを空にする
        setUserRoles([])
        setCurrentMode(null)
      }
    } catch (error) {
      console.error('ユーザーデータ読み込みエラー:', error)
      // エラーの場合は空のロールを設定
      setUserRoles([])
      setCurrentMode(null)
    }
  }

  // 認証状態の監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      setUser(user)

      if (user) {
        await loadUserData(user)
      } else {
        setUserRoles([])
        setCurrentMode(null)
        localStorage.removeItem('currentMode')
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        userRoles,
        currentMode,
        loading,
        signInWithGithub,
        signOut,
        switchMode,
        updateUserRoles,
        checkWalletConnection,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// 認証コンテキストを使用するためのフック
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
