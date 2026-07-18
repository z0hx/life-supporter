# life-supporter

メモと単価計算で日常を支援するモバイル専用のローカルファーストPWA。
デザインは `design_handoff_life_supporter/` のハンドオフ(案1c「やわらか実用」+ 3a/3c)に基づく。

## 開発

```sh
npm install
npm run dev      # 開発サーバー
npm run build    # 型チェック + 本番ビルド(Service Worker 生成込み)
npm run preview  # ビルド結果の確認(PWA/オフラインの検証はこちらで)
npm run icons    # public/ のプレースホルダーアイコンを再生成
```

## 構成

- Vite + React + TypeScript、追加ライブラリは idb / @fontsource/zen-maru-gothic / vite-plugin-pwa のみ
- `src/lib/db.ts` — IndexedDB(idb)。メモ・比較履歴・カテゴリ・メタ情報を保存
- `src/lib/viewSettings.ts` — 表示設定(ViewSettings)のみ localStorage
- `src/store.tsx` — アプリ状態。起動時に `navigator.storage.persist()` と完了済みメモの自動アーカイブを実行
- `src/screens/` — ホーム / メモ一覧(3a 常設コントロールバー) / メモ追加・編集モーダル(3c) / 単価計算 / 履歴 / 設定
- ルーティングはハッシュベース(`#/memos` など)

## PWA

- vite-plugin-pwa(generateSW)で全アセット(フォント含む)をプリキャッシュし、完全オフラインで動作
- manifest: name "life-supporter"、display standalone、theme-color `#FAF6F0`、192/512px アイコン(プレースホルダー)

## デプロイ(GitHub Pages)

`main` ブランチへの push で `.github/workflows/deploy.yml` がビルドと GitHub Pages へのデプロイを行う。

初回のみ、リポジトリの Settings → Pages で「Source: GitHub Actions」を選択する。
公開URLは `https://<user>.github.io/life-supporter/`。リポジトリ名を変える場合は
`vite.config.ts` の `base` を合わせて変更する。

## データのバックアップ

設定画面からエクスポート(JSON、Web Share API 対応環境では共有シート、非対応時はダウンロード)。
インポートは置き換え / マージを選択でき、スキーマバージョンを検証する。
最終エクスポートから90日経過(または未エクスポートでデータあり)で設定画面にリマインドを表示する。
