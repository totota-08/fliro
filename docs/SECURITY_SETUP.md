# Firebaseセキュリティ設定ガイド

このドキュメントでは、Fliroアプリケーションにおける二段階認証（MFA）とApp Checkの設定方法について説明します。

## 目次

1. [App Check（アプリチェック）](#app-check)
2. [二段階認証（MFA）](#二段階認証mfa)
3. [セキュリティルール](#セキュリティルール)

---

## App Check

App Checkは、Firebaseサービスへのアクセスを認証されたアプリケーションのみに制限する機能です。

### App Checkとは

Firebase App Checkは、以下の脅威からアプリを保護します：

- **不正アクセス**: 認証されていないクライアントからのリクエストをブロック
- **APIの乱用**: Firebaseリソースの不正な使用を防止
- **DoS攻撃**: リソースの過剰な消費を防止

### セットアップ手順

#### 1. Firebase コンソールでApp Checkを有効化

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクトを選択
3. 左メニューから「App Check」を選択
4. 「使用を開始」をクリック

#### 2. reCAPTCHA v3 サイトキーの取得

1. [Google reCAPTCHA](https://www.google.com/recaptcha/admin) にアクセス
2. 新しいサイトを登録：
   - **ラベル**: Fliro (任意の名前)
   - **reCAPTCHAタイプ**: reCAPTCHA v3
   - **ドメイン**:
     - 本番: `your-production-domain.com`
     - ステージング: `your-staging-domain.com`
     - ローカル: `localhost`
3. 「送信」をクリックしてサイトキーとシークレットキーを取得

#### 3. Firebase Console でreCAPTCHAを設定

1. Firebase Console の「App Check」ページに戻る
2. Webアプリの横にある「登録」をクリック
3. 「reCAPTCHA v3」を選択
4. 取得したreCAPTCHAサイトキーを入力
5. 「保存」をクリック

#### 4. 環境変数を設定

プロジェクトのルートに `.env` ファイルを作成し、以下を追加：

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_DATABASE_URL=your-database-url

# App Check - reCAPTCHA v3 Site Key
VITE_APP_CHECK_KEY=your-recaptcha-v3-site-key
```

**注意**: `.env` ファイルは `.gitignore` に含まれているため、コミットされません。

#### 5. Firebaseサービスで強制モードを有効化

App Checkの設定が完了したら、Firebase Consoleで各サービスの強制モードを有効にします：

1. **Cloud Firestore**:
   - App Check → Firestore → 「強制」を有効化

2. **Cloud Storage**:
   - App Check → Storage → 「強制」を有効化

3. **Cloud Functions**（使用している場合）:
   - App Check → Functions → 「強制」を有効化

### デバッグモード（開発環境）

開発環境でApp Checkをバイパスする場合：

1. Firebase Console → App Check → アプリの右側の「...」→「デバッグトークンを追加」
2. ブラウザのコンソールに表示されるデバッグトークンをコピー
3. Firebase Consoleにデバッグトークンを登録

**注意**: デバッグトークンは開発環境でのみ使用し、本番環境では絶対に使用しないでください。

### トラブルシューティング

#### App Checkエラーが発生する場合

```
Firebase App Check token is invalid or expired
```

**解決方法**:

1. reCAPTCHAサイトキーが正しいことを確認
2. `.env` ファイルの `VITE_APP_CHECK_KEY` が設定されていることを確認
3. Firebase Consoleでドメインが登録されていることを確認
4. ブラウザのキャッシュをクリア

---

## 二段階認証（MFA）

Firebase Authenticationの多要素認証（MFA）機能を使用して、アカウントのセキュリティを強化します。

### MFAとは

二段階認証（Multi-Factor Authentication）は、ログイン時に以下の2つの要素を要求します：

1. **パスワード** (知っているもの)
2. **認証コード** (持っているもの - スマートフォンの認証アプリ)

### サポートされている認証方法

現在、以下の認証方法をサポートしています：

#### TOTP (Time-based One-Time Password)

- Google Authenticator
- Authy
- Microsoft Authenticator
- その他のTOTP対応アプリ

### Firebase Console でMFAを有効化

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクトを選択
3. 左メニューから「Authentication」→「Settings」を選択
4. 「Multi-factor authentication」タブを開く
5. 「Enable」をクリック
6. 「TOTP」を有効化

### ユーザーのMFA設定手順

ユーザーは以下の手順でMFAを設定できます：

1. アカウント設定ページにアクセス
2. 「セキュリティ」セクションの「二段階認証を設定」ボタンをクリック
3. 表示されたQRコードを認証アプリでスキャン、またはシークレットキーを手動入力
4. 認証アプリに表示された6桁のコードを入力
5. 「設定を完了」をクリック

### MFAの解除

ユーザーは以下の手順でMFAを解除できます：

1. アカウント設定ページにアクセス
2. 「セキュリティ」セクションの登録済み認証方法の横にある「解除」ボタンをクリック
3. 確認ダイアログで「OK」をクリック

### 実装詳細

#### authService.ts

MFA関連の主要な関数：

- `getMFAEnrollmentStatus()`: MFAの登録状態を取得
- `startMFAEnrollment()`: MFA登録セッションを開始
- `generateTOTPSecret()`: TOTP秘密鍵を生成
- `enrollTOTP()`: TOTPを使用してMFAを登録
- `unenrollMFA()`: MFAの登録を解除
- `verifyMFACode()`: ログイン時のMFA検証

#### AccountSettingsPage.vue

アカウント設定ページにMFA設定UIを実装：

- MFA登録状態の表示
- MFA設定モーダル
- 登録済み認証方法の管理
- MFA解除機能

### セキュリティ上の注意

1. **秘密鍵の管理**:
   - TOTP秘密鍵は一度だけ表示されます
   - ユーザーに必ず保存するよう促してください

2. **バックアップコード**:
   - 現在の実装ではバックアップコードは未実装
   - 将来のリリースで追加予定

3. **アカウントロックアウト**:
   - MFAコードを複数回間違えた場合、一時的にロックアウトされる可能性があります
   - Firebase Authenticationの設定で調整可能

---

## セキュリティルール

### Firestore Security Rules

App CheckとMFAと連携するセキュリティルールの例：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // App Check検証を要求
    function isAppCheckVerified() {
      return request.app.appCheckToken != null;
    }

    // 認証済みユーザーかつApp Check検証済み
    function isAuthenticated() {
      return request.auth != null && isAppCheckVerified();
    }

    // プロフィールへのアクセス
    match /profiles/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && request.auth.uid == userId;
    }

    // プロジェクトへのアクセス
    match /projects/{projectId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && isProjectMember(projectId);
    }
  }
}
```

### Storage Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // App Check検証を要求
    function isAppCheckVerified() {
      return request.app.appCheckToken != null;
    }

    // アバター画像
    match /avatars/{userId}/{fileName} {
      allow read: if request.auth != null && isAppCheckVerified();
      allow write: if request.auth != null
                   && isAppCheckVerified()
                   && request.auth.uid == userId;
    }
  }
}
```

---

## テスト

### App Checkのテスト

1. `.env` ファイルに正しいreCAPTCHAサイトキーが設定されていることを確認
2. アプリケーションを起動: `npm run dev`
3. ブラウザの開発者ツールを開き、Consoleタブを確認
4. App Checkトークンが正常に取得されていることを確認

### MFAのテスト

1. テストユーザーでログイン
2. アカウント設定ページにアクセス
3. 二段階認証を設定
4. ログアウト後、再度ログインしてMFA検証が要求されることを確認

---

## まとめ

このガイドに従って、FliroアプリケーションにApp CheckとMFAを実装することで、以下のセキュリティ強化が実現されます：

- **App Check**: 不正なクライアントからのアクセスをブロック
- **MFA**: パスワード漏洩時のアカウント乗っ取りを防止
- **セキュリティルール**: データへのアクセス制御を強化

定期的にセキュリティ設定を見直し、最新のベストプラクティスに従うことをお勧めします。
