# Tailwind CSS Setup for Docker on Mac

## 問題

Docker on Mac環境でTailwind CSSのファイルスキャンがSystem Error -35（Resource deadlock）で失敗します。

## 解決策

**Mac側（Docker外）でTailwind CSSをビルド**し、Docker内では生成済みCSSを読み込みます。

---

## セットアップ手順

### 1. Mac側でTailwindビルドスクリプトを実行

**新しいターミナルウィンドウを開き**（Dockerではなく、通常のMac Terminal）：

```bash
# プロジェクトディレクトリに移動
cd /Users/[your-username]/path/to/prance-communication-platform/apps/web

# Tailwindビルドスクリプトを実行（watch mode）
bash scripts/build-tailwind-host.sh --watch
```

**期待される出力:**
```
🎨 Tailwind CSS Build (Host Mac)
================================
Input:  .../app/globals.css
Output: .../styles/tailwind.output.css

👀 Watch mode enabled (Press Ctrl+C to stop)

Rebuilding...
Done in 234ms.
```

### 2. Docker内で開発サーバーを起動

別のターミナル（Docker内）で：

```bash
pnpm run dev
```

**期待される結果:**
- ✅ HTTP 200 OK
- ✅ 完全なTailwind CSSが適用される
- ✅ ファイル変更時に自動リビルド（Mac側のwatcherが検知）

---

## ファイル構成

```
apps/web/
├── app/
│   ├── globals.css              # ソースファイル（@tailwindディレクティブ含む）
│   └── layout.tsx               # → styles/tailwind.output.css をimport
├── styles/
│   └── tailwind.output.css      # Mac側で生成（.gitignore）
├── scripts/
│   └── build-tailwind-host.sh   # Mac側で実行するスクリプト
└── DOCKER_TAILWIND_SETUP.md     # このファイル
```

---

## トラブルシューティング

### Q1: Mac側のスクリプトが見つからない

```bash
# リポジトリのルートから実行している場合
cd apps/web
bash scripts/build-tailwind-host.sh --watch
```

### Q2: `npx: command not found`

```bash
# Node.jsとnpmをMac側にインストール
brew install node

# または、pnpmを使用
pnpm exec tailwindcss -i ./app/globals.css -o ./styles/tailwind.output.css --watch
```

### Q3: スタイルが反映されない

```bash
# 1. Mac側のwatcherが動いているか確認
# 2. styles/tailwind.output.css が生成されているか確認
ls -lh styles/tailwind.output.css

# 3. Docker内の開発サーバーを再起動
pnpm run dev
```

### Q4: watch modeを停止したい

Mac側のターミナルで **Ctrl+C** を押す

---

## 本番ビルド時の注意

本番環境では、CI/CDパイプラインでTailwindを自動ビルドします。この方法は**開発環境のみ**で使用します。

---

## 関連ドキュメント

- [KNOWN_ISSUES.md](../../docs/07-development/KNOWN_ISSUES.md) - Issue #6
- [Memory: feedback_tailwind_system_error.md](../../memory/feedback_tailwind_system_error.md)
