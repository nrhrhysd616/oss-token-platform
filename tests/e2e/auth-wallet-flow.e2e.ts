import { test, expect } from '@playwright/test'

test.describe('認証とウォレット連携フロー', () => {
  test.beforeEach(async ({ page }) => {
    // ホームページにアクセス
    await page.goto('/')
  })

  test('未ログイン状態でのUI表示確認', async ({ page }) => {
    // ページタイトルの確認
    await expect(page).toHaveTitle(/OSSトークンプラットフォーム/)

    // メインタイトルの確認
    await expect(page.locator('h1')).toContainText('OSSトークンプラットフォーム')

    // 未ログイン状態でのステップ表示確認
    await expect(page.locator('span:has-text("GitHubログイン")')).toBeVisible()
    await expect(page.locator('span:has-text("ウォレット連携")')).toBeVisible()

    // GitHubログインボタンの確認（メインコンテンツ内の青いボタン）
    await expect(page.locator('main .bg-blue-500:has-text("GitHubでログイン")')).toBeVisible()

    // ステップ1がアクティブ、ステップ2が非アクティブであることを確認
    const step1 = page.locator('.w-8.h-8:has-text("1")')
    const step2 = page.locator('.w-8.h-8:has-text("2")')

    await expect(step1).toHaveClass(/bg-blue-500/)
    await expect(step2).toHaveClass(/bg-gray-600/)
  })

  test('GitHubログインボタンクリック', async ({ page }) => {
    // GitHubログインボタンをクリック（メインコンテンツ内の青いボタン）
    const loginButton = page.locator('main .bg-blue-500:has-text("GitHubでログイン")')
    await expect(loginButton).toBeVisible()

    // ボタンがクリック可能であることを確認
    await expect(loginButton).toBeEnabled()

    // 実際のクリックはFirebase Authのリダイレクトが発生するため、
    // ここではボタンの存在とクリック可能性のみを確認
    await loginButton.click()

    // Firebase Authのリダイレクトが開始されることを確認
    // （実際の認証フローはモックまたは別途設定が必要）
  })

  test('ログイン済み状態のモック（ローカルストレージ使用）', async ({ page }) => {
    // Firebase Authのモックデータをローカルストレージに設定
    await page.addInitScript(() => {
      // Firebase Authのモックユーザーデータ
      const mockUser = {
        uid: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: 'https://avatars.githubusercontent.com/u/123456?v=4',
      }

      // ローカルストレージにモックデータを設定
      localStorage.setItem('firebase:authUser:test-project:default', JSON.stringify(mockUser))
    })

    await page.goto('/')

    // ログイン済み状態でのUI確認
    // 注意: 実際のFirebase Authの実装によっては、追加のモック設定が必要
    await page.waitForTimeout(2000) // 認証状態の確認を待機

    // ウォレット連携ボタンが表示されることを期待
    // （実際の実装に応じて調整が必要）
  })

  test('ウォレット連携フローの基本UI', async ({ page }) => {
    // このテストは実際のログイン状態が必要なため、
    // 現在はUI要素の存在確認のみを行う

    // ページが正常に読み込まれることを確認（メインコンテンツ）
    await expect(page.locator('main.min-h-screen')).toBeVisible()

    // WalletLinkStepperコンポーネントが読み込まれることを確認
    await expect(page.locator('h2:has-text("ウォレット連携")')).toBeVisible()
  })

  test('レスポンシブデザインの確認', async ({ page }) => {
    // モバイルビューポートでのテスト
    await page.setViewportSize({ width: 375, height: 667 })

    // メインコンテンツが表示されることを確認
    await expect(page.locator('main.min-h-screen')).toBeVisible()
    await expect(page.locator('h1')).toBeVisible()

    // デスクトップビューポートでのテスト
    await page.setViewportSize({ width: 1280, height: 720 })

    // レイアウトが適切に表示されることを確認
    await expect(page.locator('main.min-h-screen')).toBeVisible()
    await expect(page.locator('.max-w-4xl')).toBeVisible()
  })

  test('エラーハンドリングの確認', async ({ page }) => {
    // ネットワークエラーのシミュレーション
    await page.route('**/api/**', route => {
      route.abort('failed')
    })

    await page.goto('/')

    // ページが基本的なUIを表示することを確認
    await expect(page.locator('h1')).toBeVisible()

    // エラー状態でもクラッシュしないことを確認
    await expect(page.locator('main.min-h-screen')).toBeVisible()
  })
})

test.describe('ウォレット連携詳細フロー', () => {
  test('QRモーダルの表示確認（モック）', async ({ page }) => {
    await page.goto('/')

    // 将来的にログイン状態をモックして、
    // ウォレット連携ボタンのクリック → QRモーダル表示をテスト

    // 現在は基本的なページ構造の確認のみ
    await expect(page.locator('main.min-h-screen')).toBeVisible()
  })

  test('ウォレット連携完了状態の確認（モック）', async ({ page }) => {
    await page.goto('/')

    // 将来的にウォレット連携完了状態をモックして、
    // 完了画面の表示をテスト

    // 現在は基本的なページ構造の確認のみ
    await expect(page.locator('main.min-h-screen')).toBeVisible()
  })
})
