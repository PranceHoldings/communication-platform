# Domain Migration Scripts Archive (2024)

このディレクトリには、ドメイン移行（prance.co.jp → prance.jp）で使用されたスクリプトが保存されています。

## 概要

- **実行日:** 2024年頃（コミット: e2b529e）
- **移行内容:** prance.co.jp → prance.jp
- **スクリプト数:** 5個

## ファイル一覧

### 00-backup.sh
- **用途:** 移行前にすべての設定ファイルをバックアップ
- **対象:** Infrastructure config, .env files, ドキュメント

### 01-update-config.sh
- **用途:** config.tsとその他の設定ファイルを新しいドメインに更新

### 02-update-docs.sh
- **用途:** ドキュメント内のドメイン参照を一括更新

### 03-update-env.sh
- **用途:** 環境変数ファイル（.env.local等）のドメインを更新

### 99-rollback.sh
- **用途:** 移行失敗時のロールバック（バックアップから復元）

## 注意事項

⚠️ **これらのスクリプトは過去の一時的な移行用です。**

- すでに実行済み（ドメイン移行完了）
- 再実行は不要
- 参照・履歴確認用のみ

✅ **現在のドメイン設定は `.env.local` と `infrastructure/lib/config.ts` を参照してください。**

---

**アーカイブ日:** 2026-04-05  
**移行完了コミット:** e2b529e
