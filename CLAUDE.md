# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

life-supporter は、モバイル専用のローカルファースト PWA(メモ管理 + 単価計算)。Vite + React + TypeScript で構築。バックエンドやアカウントは存在せず、全データは端末上の IndexedDB に保存される。ランタイム依存は `idb`・`leaflet`(地図。動的 import され初期バンドルには入らない)・`@fontsource/zen-maru-gothic`・`react`/`react-dom`・`vite-plugin-pwa` のみ。この最小構成を保ち、十分な理由なくライブラリを追加しないこと。

## コマンド

```sh
npm run dev      # 開発サーバー
npm run build    # tsc -b(型チェック)+ 本番ビルド(Service Worker 生成込み)
npm run preview  # ビルド結果の配信 — PWA/オフライン動作の確認はこちらで
npm run icons    # public/ のプレースホルダーアイコンを scripts/make-icons.mjs で再生成
```

テストフレームワーク・テストスイートは未整備。`npm run build` が正当性チェックの役割を担う(`vite build` の前に `tsc -b` が走るため、型エラーがあればビルドが失敗する)。

## アーキテクチャ

- **ルーティング**: ハッシュベース(`#/memos`、`#/calc` など)。`src/App.tsx` 内の小さな `useHashRoute` フックと単一の `Router` の switch で処理。ルーターライブラリは使用していない。
- **メモの構造(v2 の要)**: メモはユーザーが定義した**テンプレート**から作られる。テンプレートは項目定義(`TemplateField[]`)だけを持ち、メモ作成時にその定義が**複製**されて `MemoField[]`(定義+値)になる。メモはテンプレートを参照せず自己完結するため、(a) メモ単位で項目を追加・削除・並べ替えでき、(b) メモから逆にテンプレートを作れ、(c) テンプレートを削除しても既存メモは壊れない。裏返しに、テンプレートを編集しても作成済みメモには波及しない — これは意図した挙動。
- **フィールドのレジストリ**: 項目の種別ごとの振る舞い(入力UI・設定UI・要約・検索文字列・空判定)は `src/fields/` の `FieldDef` に集約し、`FIELD_DEFS` から引く。画面側は `FieldInput` / `FieldConfigInput` を使うだけなので、**種別を増やすときの変更は「ファイル1つ + `FieldConfigMap`/`FieldValueMap` に各1行 + レジストリ1行」で完結する**。画面のコードは触らないこと。
- **状態管理**: `StoreProvider`(`src/store.tsx`)がアプリの全状態(memos・templates・labels・comparisons・goodNews・activityLogs・archiveDays・lastExportAt)を React state として保持し、IndexedDB を裏付けとする。各更新関数(`addMemo`・`updateMemo`・`toggleDone` など)は共通のパターンに従う: まず React state を楽観的に更新し、続けて `src/lib/db.ts` 経由で永続化する。各画面は `useStore()` を通じてこれを利用する。
- **`useStore` は `src/storeContext.ts` にある**(`store.tsx` から再エクスポート)。`store.tsx` が `src/fields/` を import し、`fields/comparison.tsx` が `useStore` を必要とするため、同じモジュールに置くと循環参照になり Provider より先に評価された側が null を掴む。`fields/` 配下からは必ず `../storeContext` から import すること。
- **永続化**: `src/lib/db.ts` は `idb` を使って IndexedDB をラップしている(DB 名 `life-supporter`、`DB_VERSION` は現在 4)。v4 でメモをテンプレート式に刷新した際、旧 `memos` と `categories` は破棄して作り直している(ユーザー合意のうえでの破壊的変更)。**以後は加算的に運用すること** — 既存インストールはインプレースでアップグレードされるため、きちんとした移行手段なしにストアやキーを削除・改名しないこと。`src/lib/viewSettings.ts` だけは例外で、軽量な表示状態(groupBy/sortBy/sortDir)に `localStorage` を使う(IndexedDB ではない)。
- **起動時の処理**(`src/store.tsx` の `StoreProvider` 内の effect): `navigator.storage.persist()` を呼び出す(iOS Safari の自動削除対策)。ラベル・テンプレートが未作成なら `DEFAULT_LABELS` と `buildDefaultTemplates()`(`src/lib/defaults.ts`)を投入する。`archiveDays`(既定30日、0で無効)より前に完了した(`done`)メモを自動アーカイブする。
- **バックアップ/復元**: `src/lib/backup.ts` が `BackupFile`・`SCHEMA_VERSION` と `validateBackup()` を定義する。`validateBackup()` は、新しいストアを持たない旧バックアップ(例: `goodNews` を含まない v1 バックアップ)を拒否せず空配列に正規化する — スキーマを拡張する際もこの挙動を維持すること。v3 以前のバックアップはメモの構造が異なるためメモのみ取り込まず(`warning` で件数を伝える)、単価計算・日次ログは復元する。エクスポートは可能な場合 Web Share API を使用し(`shareOrDownload`)、非対応時はファイルの直接ダウンロードにフォールバックする。設定画面では置き換え/マージのインポートを提供しており(`store.importReplace` / `store.importMerge`)、マージは `id` ベースの last-write-wins。
- **PWA**: `vite-plugin-pwa` の `generateSW` モード、`registerType: 'prompt'` — 更新は自動適用されない(入力中の操作を妨げないため)。`src/usePWAUpdate.ts` が1時間おきおよび可視性変化時に新しい Service Worker の有無をポーリングし、ユーザーがクリックして適用する更新バー(`App.tsx`)を表示する。
- **地図**: `src/components/MapView.tsx` だけが `leaflet` に依存し、`fields/location.tsx` から `lazy(() => import(...))` で読み込まれる。**この境界を崩さないこと**(初期バンドルに leaflet が入ると起動1秒以内の要件を割る)。タイルは OSM で、帰属表示は利用規約上必須。`vite.config.ts` の `runtimeCaching` が一度表示したタイルをキャッシュする(`maxEntries` の上限は必ず残すこと)が、**未訪問範囲の先読みは規約違反なので実装しない**。住所検索は Nominatim で、1秒1リクエスト・逐次入力禁止のため必ず明示操作から呼ぶ(`src/lib/geo.ts` が間隔を担保)。
- **画面構成**(`src/screens/`): ルートとほぼ1対1に対応する。Home(他セクションのプレビューを持つハブ)、MemoList(グルーピング/ソート操作+一覧)、MemoEditor(メモの追加・編集。項目の追加・削除・並べ替え、テンプレート化を含む全画面)、TemplatePicker(作成時のテンプレート選択シート)、Templates(テンプレート一覧+編集)、Calc(単価比較)、History(保存済み比較の一覧)、GoodNew / ActivityLog(自由記述の日次ログ。`src/types.ts` の `DailyLogEntry` 型を共有)、Settings(テンプレート/ラベル管理・アーカイブ設定・バックアップ/インポート/全削除)。
- **デザインの正**: `design_handoff_life_supporter/requirements-spec.dc.html` が仕様の正であり、`design-mocks.dc.html` がビジュアルの参照。採用スタイルはモック内の「ターン3」(3a/3b/3c)と「1c」のみで、それ以外のバリアントは不採用の検討過程なので参照しないこと。デザイントークン(色・角丸・余白・タイプスケール)は `design_handoff_life_supporter/README.md` にまとめられている。ただしメモ機能はテンプレート式に刷新済みで、仕様書のメモ章(カテゴリ+タグ・固定項目)より実装が新しい — メモまわりは実装を正とする。タップ領域44px以上の原則は新しいUIにも適用すること。

## デプロイ

`main` ブランチへの push で `.github/workflows/deploy.yml` が起動し、ビルドと GitHub Pages へのデプロイを行う。`vite.config.ts` では `build` コマンド実行時のみ(`dev` 時は除く)`base: '/life-supporter/'` を設定し、GitHub Pages のサブパスに合わせている — リポジトリ名を変更する場合はこの `base` も合わせて変更すること。
