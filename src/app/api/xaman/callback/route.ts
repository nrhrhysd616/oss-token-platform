/**
 * Xaman統合コールバックAPI
 * ウォレット連携と寄付の両方を処理
 * 署名検証とwebhook形式に対応
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { WalletLinkService } from '@/services/WalletLinkService'
import { DonationService } from '@/services/DonationService'
import type { DonationRequest } from '@/types/donation'
import { verifyXamanWebhookRequest } from '@/lib/xaman'
import { XummTypes } from 'xumm-sdk'
import { FIRESTORE_COLLECTIONS } from '@/lib/firebase/collections'
import { convertTimestamps } from '@/lib/firebase/utils'

export async function POST(request: NextRequest) {
  try {
    // リクエストボディを取得
    const body = (await request.json()) as XummTypes.XummWebhookBody

    // 署名検証を実行
    const isSignatureValid = verifyXamanWebhookRequest(request, body)
    if (!isSignatureValid) {
      console.error('Webhook signature verification failed')
      return NextResponse.json({ error: 'Unauthorized: Invalid signature' }, { status: 401 })
    }

    const payloadUuid = body.payloadResponse.payload_uuidv4
    const signed = body.payloadResponse.signed
    const txid = body.payloadResponse.txid

    if (!payloadUuid) {
      return NextResponse.json({ error: 'Payload UUID is required' }, { status: 400 })
    }

    // ユーザートークンが含まれている場合は保存（将来のプッシュ通知用）
    if (body.userToken) {
      await saveUserToken(body.userToken, payloadUuid)
    }

    // まず寄付セッションを確認
    const donationResult = await handleDonationCallback(payloadUuid, signed, txid)
    if (donationResult) {
      return donationResult
    }

    // 最後にウォレット連携を確認
    const walletResult = await handleWalletLinkCallback(payloadUuid, signed)
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
    // 該当する寄付リクエストを検索
    const requestsQuery = await getAdminDb()
      .collection(FIRESTORE_COLLECTIONS.DONATION_REQUESTS)
      .where('xamanPayloadUuid', '==', payloadUuid)
      .limit(1)
      .get()

    if (requestsQuery.empty) {
      return null // 寄付リクエストではない
    }

    const requestDoc = requestsQuery.docs[0]
    // FirestoreのTimestamp型をDate型に変換
    const requestData = convertTimestamps({
      id: requestDoc.id,
      ...requestDoc.data(),
    }) as DonationRequest

    // リクエストが既に完了している場合はスキップ
    if (requestData.status === 'completed') {
      return NextResponse.json({ message: '既に処理済みです' })
    }

    // リクエストの期限確認
    if (DonationService.isDonationRequestExpired(requestData)) {
      await getAdminDb()
        .collection(FIRESTORE_COLLECTIONS.DONATION_REQUESTS)
        .doc(requestDoc.id)
        .update({
          status: 'failed',
          error: 'Request expired',
        })
      return NextResponse.json({ error: 'リクエストが期限切れです' }, { status: 410 })
    }

    // 署名されていない場合（キャンセルされた場合）
    if (!signed || !txid) {
      await getAdminDb()
        .collection(FIRESTORE_COLLECTIONS.DONATION_REQUESTS)
        .doc(requestDoc.id)
        .update({
          status: 'failed',
          error: 'Transaction not signed or cancelled',
        })
      return NextResponse.json({ message: 'トランザクションがキャンセルされました' })
    }

    // Xamanステータスを取得
    const xamanStatus = await DonationService.checkPayloadStatus(payloadUuid)

    // DonationServiceの統合機能を使用して寄付完了処理を実行
    const donationRecord = await DonationService.completeDonationRequest(requestDoc.id, xamanStatus)

    return NextResponse.json({
      message: '寄付が完了しました。トークン発行処理を開始しています。',
      donation: {
        id: donationRecord.id,
        requestId: donationRecord.requestId,
        projectId: donationRecord.projectId,
        amount: donationRecord.amount,
        txHash: donationRecord.txHash,
        createdAt: donationRecord.createdAt,
      },
    })
  } catch (error) {
    console.error('Donation callback error:', error)
    return NextResponse.json({ error: '寄付処理でエラーが発生しました' }, { status: 500 })
  }
}

/**
 * ウォレット連携コールバックの処理
 */
async function handleWalletLinkCallback(
  payloadUuid: string,
  signed: boolean
): Promise<NextResponse | null> {
  try {
    // ウォレット連携リクエストを取得
    const linkRequest = await WalletLinkService.getWalletLinkRequest(payloadUuid)
    if (!linkRequest) {
      return null // ウォレット連携でもない
    }

    if (signed) {
      // 署名が完了している場合、Xamanステータスを再取得して連携を完了
      const xamanStatus = await WalletLinkService.checkPayloadStatus(payloadUuid)
      if (xamanStatus.meta.signed && xamanStatus.response) {
        await WalletLinkService.completeWalletLink(payloadUuid, xamanStatus)
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
      .collection(FIRESTORE_COLLECTIONS.XAMAN_USER_TOKENS)
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
