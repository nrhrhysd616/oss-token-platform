# ADR-20250604-01: XamanWebSocket待機処理について

## ステータス

Approved

## 日付

2025-06-04

## 文脈

現在のXamanペイロード処理では、フロントエンドがポーリングで署名状況を確認している。これにより以下の問題が発生している：

1. **リアルタイム性の欠如**: ポーリング間隔により署名完了の検知に遅延が発生
2. **サーバー負荷**: 不要なAPIリクエストが継続的に発生
3. **ユーザー体験の悪化**: 署名状況の更新が遅く、ユーザーが待機状態を把握しにくい

## 決定

XamanのWebSocket機能を活用して、リアルタイムでペイロード状況を監視する仕組みを実装する。

### 実装方針

#### バックエンド

1. **ペイロード作成API拡張**

   - `/api/xaman/create`のレスポンスに`websocket_status`フィールドを追加
   - Xamanから返却される`websocket_status`をそのままフロントエンドに転送

2. **WebSocket接続管理**
   - フロントエンドからのWebSocket接続要求を処理
   - Xamanとの接続を中継する仕組みを実装

#### フロントエンド

1. **WebSocket接続処理**

   - ペイロード作成後、`websocket_status`を使用してWebSocket接続を確立
   - 接続状態の管理とエラーハンドリング

2. **リアルタイム状態更新**

   - WebSocketイベントを受信してUIの状態を即座に更新
   - ポーリング処理を完全に廃止

3. **トランザクション検証強化**
   - SignInは疑似トランザクションのため簡易処理
   - 通常のXRPLトランザクションでは以下を実装：
     - 署名の検証
     - Ledgerでのconfirm確認
     - 署名者の確認

### 技術仕様

#### WebSocketイベント

```typescript
type XamanWebSocketEvent = {
  type: 'signed' | 'rejected' | 'expired' | 'opened'
  payload_uuidv4: string
  signed?: boolean
  txid?: string
  account?: string
}
```

#### 状態管理

```typescript
type PayloadState = {
  status: 'pending' | 'signed' | 'rejected' | 'expired'
  websocketConnected: boolean
  transactionHash?: string
  signerAccount?: string
}
```

## 結果

### 期待される効果

1. **ユーザー体験の向上**: 署名状況がリアルタイムで反映される
2. **サーバー負荷軽減**: ポーリングによる不要なAPIリクエストが削減される
3. **信頼性向上**: WebSocketによる確実なイベント通知

### 実装タスク

- タスク2-9: Xaman WebSocket待機処理実装
  - ペイロード作成リクエスト後にwebsocket_statusもフロントに返却
  - フロントはwebsocket_statusを利用してWebSocket接続
  - ポーリングではなくWebsocketでイベントを受け取ってstate更新
  - 通常のXRPLトランザクションは署名・ledgerのconfirm・署名者の確認を実装

## 参考資料

- [Xaman WebSocket Documentation](https://docs.xaman.app/api/websocket)
- [Issue #49: Xamanのペイロード待機としてフロントでのWebsocket待機処理を実装するべき](https://github.com/nrhrhysd616/oss-token-platform/issues/49)
