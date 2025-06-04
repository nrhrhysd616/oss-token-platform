/**
 * Xaman統合コールバックAPI
 * ウォレット連携と寄付の両方を処理
 * 署名検証とwebhook形式に対応
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { WalletService } from '@/lib/xaman/WalletService'
import { DonationService } from '@/lib/xrpl/donation-service'
import type { DonationSession } from '@/types/donation'
import { TokenIssueService } from '@/lib/xrpl/token-issue-service'
import { getActiveIssuerWallet } from '@/lib/xrpl/config'
import { verifyXamanWebhookRequest } from '@/lib/xaman/signature-verification'
import { xamanCallbackSchema, type XamanCallback } from '@/validations/xaman'

export async function POST(request: NextRequest) {
  try {
    // リクエストボディを取得
    const body = await request.json()

    // 署名検証を実行
    const verificationResult = await verifyXamanWebhookRequest(request, body)
    if (!verificationResult.isValid) {
      console.error('Webhook signature verification failed:', verificationResult.error)
      return NextResponse.json({ error: 'Unauthorized: Invalid signature' }, { status: 401 })
    }

    // webhook形式の検証
    let webhookData: XamanCallback
    try {
      webhookData = xamanCallbackSchema.parse(body)
    } catch (webhookError) {
      console.error('Invalid webhook format:', webhookError)
      return NextResponse.json({ error: 'Invalid webhook format' }, { status: 400 })
    }

    const payloadUuid = webhookData.payloadResponse.payload_uuidv4
    const signed = webhookData.payloadResponse.signed
    const txid = webhookData.payloadResponse.txid

    if (!payloadUuid) {
      return NextResponse.json({ error: 'Payload UUID is required' }, { status: 400 })
    }

    // ユーザートークンが含まれている場合は保存（将来のプッシュ通知用）
    if (webhookData.userToken) {
      await saveUserToken(webhookData.userToken, payloadUuid)
    }

    // まず寄付セッションを確認
    const donationResult = await handleDonationCallback(payloadUuid, signed, txid)
    if (donationResult) {
      return donationResult
    }

    // 次にトラストライン設定を確認
    const trustlineResult = await handleTrustlineCallback(payloadUuid, signed, txid)
    if (trustlineResult) {
      return trustlineResult
    }

    // 最後にウォレット連携を確認
    const walletResult = await handleWalletLinkCallback(payloadUuid, signed, txid)
    if (walletResult) {
      return walletResult
    }

    // どれも見つからない場合
    return NextResponse.json({ error: 'Payload not found in any system' }, { status: 404 })
  } catch (error) {
    console.error('Failed to process Xaman callback:', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * 寄付コールバックの処理
 */
async function handleDonationCallback(
  payloadUuid: string,
  signed: boolean,
  txid: string | undefined
): Promise<NextResponse | null> {
  try {
    // 該当する寄付セッションを検索
    const sessionsQuery = await getAdminDb()
      .collection('donationSessions')
      .where('xamanPayloadId', '==', payloadUuid)
      .limit(1)
      .get()

    if (sessionsQuery.empty) {
      return null // 寄付セッションではない
    }

    const sessionDoc = sessionsQuery.docs[0]
    const sessionData = sessionDoc.data() as DonationSession

    // セッションが既に完了している場合はスキップ
    if (sessionData.status === 'completed') {
      return NextResponse.json({ message: '既に処理済みです' })
    }

    const donationService = new DonationService()

    // セッションの期限確認
    if (donationService.isSessionExpired(sessionData)) {
      await getAdminDb().collection('donationSessions').doc(sessionDoc.id).update({
        status: 'failed',
        error: 'Session expired',
      })
      return NextResponse.json({ error: 'セッションが期限切れです' }, { status: 410 })
    }

    // 署名されていない場合（キャンセルされた場合）
    if (!signed || !txid) {
      await getAdminDb().collection('donationSessions').doc(sessionDoc.id).update({
        status: 'failed',
        error: 'Transaction not signed or cancelled',
      })
      return NextResponse.json({ message: 'トランザクションがキャンセルされました' })
    }

    // プロジェクト情報を動的に取得
    const projectDoc = await getAdminDb().collection('projects').doc(sessionData.projectId).get()
    if (!projectDoc.exists) {
      await getAdminDb().collection('donationSessions').doc(sessionDoc.id).update({
        status: 'failed',
        error: 'Project not found',
      })
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }
    const projectData = projectDoc.data()!

    // トランザクションの検証
    const isValid = await donationService.verifyDonationTransaction(txid, sessionData)

    if (!isValid) {
      await getAdminDb().collection('donationSessions').doc(sessionDoc.id).update({
        status: 'failed',
        error: 'Transaction verification failed',
        txHash: txid,
      })
      return NextResponse.json({ error: 'トランザクションの検証に失敗しました' }, { status: 400 })
    }

    // 寄付記録をFirestoreに保存
    const donationRecord = {
      id: `donation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: sessionDoc.id,
      projectId: sessionData.projectId,
      donorAddress: sessionData.donorAddress,
      donorUid: sessionData.donorUid || null,
      amount: sessionData.amount,
      txHash: txid,
      destinationTag: sessionData.destinationTag,
      verificationHash: sessionData.verificationHash,
      tokenIssued: false,
      createdAt: new Date(),
    }

    await getAdminDb().collection('donations').doc(donationRecord.id).set(donationRecord)

    // セッションステータスを更新
    await getAdminDb().collection('donationSessions').doc(sessionDoc.id).update({
      status: 'completed',
      txHash: txid,
      completedAt: new Date(),
    })

    // トークン発行処理
    try {
      const tokenIssueService = new TokenIssueService()
      const issuerWallet = getActiveIssuerWallet()

      // 寄付者のトラストライン確認
      const hasTrustLine = await donationService.checkTrustLine(
        sessionData.donorAddress,
        projectData.tokenCode,
        issuerWallet.address
      )

      if (!hasTrustLine) {
        // トラストラインが設定されていない場合は後で処理
        await getAdminDb().collection('donations').doc(donationRecord.id).update({
          tokenIssueStatus: 'pending_trustline',
          tokenIssueError: 'Trustline not set by donor',
        })

        return NextResponse.json({
          message: '寄付が完了しました。トークンを受け取るにはトラストラインを設定してください。',
          donation: donationRecord,
          requiresTrustLine: true,
        })
      }

      // トークン発行量の計算（簡単な例：1XRP = 100トークン）
      const tokenAmount = sessionData.amount * 100

      // トークン発行（新しいTokenIssueServiceの仕様に対応）
      const issueResult = await tokenIssueService.issueTokenToRecipient({
        projectId: sessionData.projectId,
        amount: tokenAmount,
        recipientAddress: sessionData.donorAddress,
        memo: `Donation reward for project ${projectData.name}`,
      })

      if (issueResult.success) {
        // トークン発行成功
        await getAdminDb().collection('donations').doc(donationRecord.id).update({
          tokenIssued: true,
          tokenAmount,
          tokenTxHash: issueResult.txHash,
          tokenIssuedAt: new Date(),
        })

        // プロジェクト統計の更新
        await updateProjectStats(sessionData.projectId, sessionData.amount, tokenAmount)

        return NextResponse.json({
          message: '寄付が完了し、トークンが発行されました',
          donation: {
            ...donationRecord,
            tokenIssued: true,
            tokenAmount,
            tokenTxHash: issueResult.txHash,
          },
        })
      } else {
        // トークン発行失敗
        await getAdminDb().collection('donations').doc(donationRecord.id).update({
          tokenIssueStatus: 'failed',
          tokenIssueError: issueResult.error,
        })

        return NextResponse.json({
          message: '寄付は完了しましたが、トークン発行に失敗しました',
          donation: donationRecord,
          tokenIssueError: issueResult.error,
        })
      }
    } catch (tokenError) {
      console.error('Token issue error:', tokenError)

      await getAdminDb()
        .collection('donations')
        .doc(donationRecord.id)
        .update({
          tokenIssueStatus: 'failed',
          tokenIssueError: tokenError instanceof Error ? tokenError.message : 'Unknown error',
        })

      return NextResponse.json({
        message: '寄付は完了しましたが、トークン発行でエラーが発生しました',
        donation: donationRecord,
      })
    }
  } catch (error) {
    console.error('Donation callback error:', error)
    return NextResponse.json({ error: '寄付処理でエラーが発生しました' }, { status: 500 })
  }
}

/**
 * トラストラインコールバックの処理
 */
async function handleTrustlineCallback(
  payloadUuid: string,
  signed: boolean,
  txid: string | undefined
): Promise<NextResponse | null> {
  try {
    // 該当するトラストライン設定リクエストを検索
    const requestsQuery = await getAdminDb()
      .collection('trustlineRequests')
      .where('xamanPayloadId', '==', payloadUuid)
      .limit(1)
      .get()

    if (requestsQuery.empty) {
      return null // トラストライン設定ではない
    }

    const requestDoc = requestsQuery.docs[0]
    const requestData = requestDoc.data()

    // リクエストが既に完了している場合はスキップ
    if (requestData.status === 'completed') {
      return NextResponse.json({ message: '既に処理済みです' })
    }

    // リクエストの期限確認
    if (new Date() > requestData.expiresAt.toDate()) {
      await getAdminDb().collection('trustlineRequests').doc(requestDoc.id).update({
        status: 'failed',
        error: 'Request expired',
      })
      return NextResponse.json({ error: 'リクエストが期限切れです' }, { status: 410 })
    }

    // 署名されていない場合（キャンセルされた場合）
    if (!signed || !txid) {
      await getAdminDb().collection('trustlineRequests').doc(requestDoc.id).update({
        status: 'failed',
        error: 'Transaction not signed or cancelled',
      })
      return NextResponse.json({ message: 'トラストライン設定がキャンセルされました' })
    }

    // トラストライン設定完了の記録
    await getAdminDb().collection('trustlineRequests').doc(requestDoc.id).update({
      status: 'completed',
      txHash: txid,
      completedAt: new Date(),
    })

    // トラストライン設定の確認
    const donationService = new DonationService()
    const hasTrustLine = await donationService.checkTrustLine(
      requestData.donorAddress,
      requestData.tokenCode,
      requestData.issuerAddress
    )

    if (hasTrustLine) {
      return NextResponse.json({
        message: 'トラストラインが正常に設定されました',
        trustline: {
          projectId: requestData.projectId,
          projectName: requestData.projectName,
          tokenCode: requestData.tokenCode,
          donorAddress: requestData.donorAddress,
          txHash: txid,
        },
      })
    } else {
      return NextResponse.json({
        message: 'トランザクションは完了しましたが、トラストラインの確認に失敗しました',
        warning: 'しばらく待ってから再度確認してください',
      })
    }
  } catch (error) {
    console.error('Trustline callback error:', error)
    return NextResponse.json({ error: 'トラストライン処理でエラーが発生しました' }, { status: 500 })
  }
}

/**
 * ウォレット連携コールバックの処理
 */
async function handleWalletLinkCallback(
  payloadUuid: string,
  signed: boolean,
  txid: string | undefined
): Promise<NextResponse | null> {
  try {
    // ウォレットサービスを初期化
    const walletService = new WalletService()

    // ウォレット連携リクエストを取得
    const linkRequest = await walletService.getWalletLinkRequest(payloadUuid)
    if (!linkRequest) {
      return null // ウォレット連携でもない
    }

    if (signed) {
      // 署名が完了している場合、Xamanステータスを再取得して連携を完了
      const xamanStatus = await walletService.checkPayloadStatus(payloadUuid)
      if (xamanStatus.meta.signed && xamanStatus.response) {
        await walletService.completeWalletLink(payloadUuid, xamanStatus)
        return NextResponse.json({
          success: true,
          message: 'Wallet link completed successfully',
        })
      }
    }

    // 署名が完了していない場合やエラーの場合
    return NextResponse.json({
      success: true,
      message: 'Wallet callback received',
    })
  } catch (error) {
    console.error('Wallet link callback error:', error)
    return NextResponse.json({ error: 'ウォレット連携処理でエラーが発生しました' }, { status: 500 })
  }
}

/**
 * ユーザートークンの保存（将来のプッシュ通知用）
 */
async function saveUserToken(
  userToken: {
    user_token: string
    token_issued: number
    token_expiration: number
  },
  payloadUuid: string
): Promise<void> {
  try {
    await getAdminDb()
      .collection('xamanUserTokens')
      .doc(userToken.user_token)
      .set({
        token: userToken.user_token,
        issuedAt: new Date(userToken.token_issued * 1000),
        expiresAt: new Date(userToken.token_expiration * 1000),
        payloadUuid,
        createdAt: new Date(),
      })

    console.log('User token saved for future push notifications:', userToken.user_token)
  } catch (error) {
    console.error('Failed to save user token:', error)
    // ユーザートークンの保存失敗はコールバック処理全体を失敗させない
  }
}

/**
 * プロジェクト統計の更新
 */
async function updateProjectStats(
  projectId: string,
  donationAmount: number,
  tokenAmount: number
): Promise<void> {
  try {
    const projectRef = getAdminDb().collection('projects').doc(projectId)
    const statsRef = getAdminDb().collection('projectStats').doc(projectId)

    // トランザクション内で統計を更新
    await getAdminDb().runTransaction(async transaction => {
      const statsDoc = await transaction.get(statsRef)

      if (statsDoc.exists) {
        const currentStats = statsDoc.data()!
        transaction.update(statsRef, {
          totalDonations: (currentStats.totalDonations || 0) + donationAmount,
          donorCount: (currentStats.donorCount || 0) + 1,
          totalTokensIssued: (currentStats.totalTokensIssued || 0) + tokenAmount,
          lastDonationAt: new Date(),
          updatedAt: new Date(),
        })
      } else {
        transaction.set(statsRef, {
          projectId,
          totalDonations: donationAmount,
          donorCount: 1,
          totalTokensIssued: tokenAmount,
          lastDonationAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
    })
  } catch (error) {
    console.error('Failed to update project stats:', error)
    // 統計更新の失敗は寄付処理全体を失敗させない
  }
}
