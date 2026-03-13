# Route 53 Hosted Zone セットアップ結果

**作成日:** 2026-03-04
**ステータス:** ✅ 作成完了 / ⏸️ お名前.com設定待ち

---

## 作成された Hosted Zone

**ドメイン:** `platform.prance.jp`
**Hosted Zone ID:** `Z072442027JY82JZ14ZI5`
**リージョン:** グローバル（Route 53）

---

## ネームサーバー（4つ）

お名前.comで設定する必要があるNSレコード：

```
ns-786.awsdns-34.net
ns-1297.awsdns-34.org
ns-65.awsdns-08.com
ns-1593.awsdns-07.co.uk
```

---

## お名前.com DNS設定

### 設定内容

| ホスト名   | TYPE | TTL  | VALUE                     |
| ---------- | ---- | ---- | ------------------------- |
| `platform` | NS   | 3600 | `ns-786.awsdns-34.net`    |
| `platform` | NS   | 3600 | `ns-1297.awsdns-34.org`   |
| `platform` | NS   | 3600 | `ns-65.awsdns-08.com`     |
| `platform` | NS   | 3600 | `ns-1593.awsdns-07.co.uk` |

### 設定手順

1. お名前.com Navi ログイン: https://www.onamae.com/navi/
2. DNS設定 → DNSレコード設定
3. 対象ドメイン: `prance.jp`
4. 上記4つのNSレコードを追加
5. 保存・確定

---

## DNS伝播確認コマンド

```bash
# NSレコードの確認
dig NS platform.prance.jp +short

# 期待される結果（4行）:
# ns-786.awsdns-34.net.
# ns-1297.awsdns-34.org.
# ns-65.awsdns-08.com.
# ns-1593.awsdns-07.co.uk.
```

**所要時間:** 5-30分（通常5-10分）

---

## 次のステップ

### DNS伝播確認後

1. ✅ NSレコード伝播確認（`dig`コマンド）
2. ⏸️ CDK synth 実行（Hosted Zone認識確認）
3. ⏸️ CDK deploy 実行（全スタックデプロイ）

---

## トラブルシューティング

### NSレコードが表示されない

**原因:** DNS伝播がまだ完了していない

**対処:**

- 5-10分待ってから再度確認
- お名前.comの設定を再確認
- DNSキャッシュをクリア

### CDK synthエラー

**エラー:** `Found zones: [] for dns:platform.prance.jp`

**原因:** DNS伝播が完了していない、またはお名前.comでNSレコードが設定されていない

**対処:**

- NSレコード伝播を確認（`dig`コマンド）
- お名前.comの設定を再確認

---

**最終更新:** 2026-03-04
**次回更新:** DNS伝播確認後
