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
import { UserRole } from '@/types/user'

// 認証コンテキストの型定義
type AuthContextType = {
  user: User | null
  userRoles: UserRole[]
  currentMode: UserRole | null
  loading: boolean
  signInWithGithub: () => Promise<void>
  signOut: () => Promise<void>
  switchMode: (mode: UserRole) => void
  updateUserRoles: (roles: UserRole[], defaultMode: UserRole) => Promise<void>
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
      const userRef = doc(db, 'users', user.uid)

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

  // モード切り替え
  const switchMode = (mode: UserRole) => {
    if (userRoles.includes(mode)) {
      setCurrentMode(mode)
      localStorage.setItem('currentMode', mode)
    }
  }

  // ユーザーロール更新
  const updateUserRoles = async (roles: UserRole[], defaultMode: UserRole) => {
    if (!user) return

    try {
      const userRef = doc(db, 'users', user.uid)
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
      const userRef = doc(db, 'users', user.uid)
      const userDoc = await getDoc(userRef)

      if (userDoc.exists()) {
        const userData = userDoc.data()
        const roles = userData.roles || ['donor'] // デフォルトは寄付者
        const defaultMode = userData.defaultMode || 'donor'

        setUserRoles(roles)

        // ローカルストレージから現在のモードを復元、なければデフォルトモードを使用
        const savedMode = localStorage.getItem('currentMode') as UserRole
        if (savedMode && roles.includes(savedMode)) {
          setCurrentMode(savedMode)
        } else {
          setCurrentMode(defaultMode)
        }
      } else {
        // 新規ユーザーの場合、デフォルトロールを設定
        const defaultRoles: UserRole[] = ['donor']
        const defaultMode: UserRole = 'donor'

        await setDoc(
          userRef,
          {
            roles: defaultRoles,
            defaultMode,
          },
          { merge: true }
        )

        setUserRoles(defaultRoles)
        setCurrentMode(defaultMode)
      }
    } catch (error) {
      console.error('ユーザーデータ読み込みエラー:', error)
      // エラーの場合はデフォルト値を設定
      setUserRoles(['donor'])
      setCurrentMode('donor')
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
