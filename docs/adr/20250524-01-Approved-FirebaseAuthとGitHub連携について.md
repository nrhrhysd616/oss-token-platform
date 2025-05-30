# Firebase AuthとGitHub連携について

Firebase AuthenticationとGitHubの連携方式について、GitHub OAuthではなくGitHub Appsを採用する決定

## ステータス

- Approved-承認

## コンテキスト

今後の実装として必要な価格決定アルゴリズムにはGitHubのリポジトリ情報が色々必要になると想定される。単純なOAuth認証で認証認可だけを行うのではなく、GitHub APIを継続的に利用可能な状態にしておく必要がある。

価格決定アルゴリズムでは以下のような情報が必要になる可能性が高い：

- リポジトリの詳細情報（スター数、フォーク数、コントリビューター数など）
- コミット履歴やアクティビティ
- イシューやプルリクエストの状況
- リポジトリの言語構成やファイル構造

これらの情報を取得するためには、GitHub APIへの継続的なアクセス権限が必要である。

## 決定内容

Firebase AuthはGitHub OAuthではなくGitHub Appsにて連携を行う。

具体的な実装方針：

1. GitHub Appsを作成し、必要な権限を設定
2. FirestoreにGitHub AppsのInstallation IDを保持する仕組みを実装
3. GitHub API利用可能にする実装に変更
4. ユーザーがGitHub Appsをインストールした際のInstallation IDを取得・保存
5. 価格決定アルゴリズム実行時にInstallation IDを使用してGitHub APIにアクセス

## 影響

### 良い影響

- GitHub APIの豊富な機能を活用可能
- 価格決定アルゴリズムに必要な詳細なリポジトリ情報を取得可能
- レート制限がOAuthよりも緩い
- より細かい権限制御が可能
- 組織レベルでの管理が可能

### 悪い影響

- 実装複雑度の増加
- GitHub Apps設定の管理が必要
- ユーザーにとってOAuthよりも理解が困難
- Installation IDの管理が必要
- GitHub Apps作成・設定の初期コストが発生

## 参照

- [GitHub Apps公式ドキュメント](https://docs.github.com/en/apps)
- [Firebase Auth公式ドキュメント](https://firebase.google.com/docs/auth)
- [GitHub REST API公式ドキュメント](https://docs.github.com/en/rest)
