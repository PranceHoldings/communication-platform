export default function HomePage() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[450px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Prance Communication Platform
          </h1>
          <p className="text-lg text-muted-foreground">
            AI アバターコミュニケーションプラットフォーム
          </p>
          <p className="text-sm text-muted-foreground">
            バージョン: 0.1.0-alpha
          </p>
        </div>

        <div className="grid gap-4">
          <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            <h2 className="text-xl font-semibold mb-2">🚀 開発環境セットアップ完了</h2>
            <p className="text-sm text-muted-foreground">
              Next.js 15 の初期化が完了しました。
            </p>
          </div>

          <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            <h3 className="font-semibold mb-2">次のステップ：</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>AWS Amplify 認証統合</li>
              <li>基本コンポーネントライブラリ構築</li>
              <li>ダッシュボードレイアウト</li>
              <li>多言語対応（i18n）設定</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
