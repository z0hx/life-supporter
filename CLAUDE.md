# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

life-supporter は、モバイル専用のローカルファースト PWA(メモ管理 + 単価計算)。Vite + React + TypeScript で構築。バックエンドやアカウントは存在せず、全データは端末上の IndexedDB に保存される。ランタイム依存は `idb`・`@fontsource/zen-maru-gothic`・`react`/`react-dom`・`vite-plugin-pwa` のみ。この最小構成を保ち、十分な理由なくライブラリを追加しないこと。

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
- **状態管理**: `StoreProvider`(`src/store.tsx`)がアプリの全状態(memos・comparisons・categories・goodNews・activityLogs・archiveDays・lastExportAt)を React state として保持し、IndexedDB を裏付けとする。各更新関数(`addMemo`・`updateMemo`・`toggleDone` など)は共通のパターンに従う: まず React state を楽観的に更新し、続けて `src/lib/db.ts` 経由で永続化する。各画面は `useStore()` を通じてこれを利用する。
- **永続化**: `src/lib/db.ts` は `idb` を使って IndexedDB をラップしている(DB 名 `life-supporter`、`DB_VERSION` は現在 3)。`upgrade()` ハンドラは未作成のストアのみを作成する形になっているため、この加算的な性質を維持すること — 既存インストールはインプレースでアップグレードされるため、きちんとした移行手段なしにストアやキーを削除・改名しないこと。`src/lib/viewSettings.ts` だけは例外で、軽量な表示状態(groupBy/sortBy/sortDir)に `localStorage` を使う(IndexedDB ではない)。
- **起動時の処理**(`src/store.tsx` の `StoreProvider` 内の effect): `navigator.storage.persist()` を呼び出す(iOS Safari の自動削除対策)。カテゴリが未作成なら `DEFAULT_CATEGORIES` を投入する。`archiveDays`(既定30日、0で無効)より前に完了した(`done`)メモを自動アーカイブする。
- **バックアップ/復元**: `src/lib/backup.ts` が `BackupFile`・`SCHEMA_VERSION` と `validateBackup()` を定義する。`validateBackup()` は、新しいストアを持たない旧バックアップ(例: `goodNews` を含まない v1 バックアップ)を拒否せず空配列に正規化する — スキーマを拡張する際もこの挙動を維持すること。エクスポートは可能な場合 Web Share API を使用し(`shareOrDownload`)、非対応時はファイルの直接ダウンロードにフォールバックする。設定画面では置き換え/マージのインポートを提供しており(`store.importReplace` / `store.importMerge`)、マージは `id` ベースの last-write-wins。
- **PWA**: `vite-plugin-pwa` の `generateSW` モード、`registerType: 'prompt'` — 更新は自動適用されない(入力中の操作を妨げないため)。`src/usePWAUpdate.ts` が1時間おきおよび可視性変化時に新しい Service Worker の有無をポーリングし、ユーザーがクリックして適用する更新バー(`App.tsx`)を表示する。
- **画面構成**(`src/screens/`): ルートとほぼ1対1に対応する。Home(他セクションのプレビューを持つハブ)、MemoList(グルーピング/ソート操作+一覧)、MemoModal(メモの追加・編集)、Calc(単価比較)、History(保存済み比較の一覧)、GoodNew / ActivityLog(自由記述の日次ログ。`src/types.ts` の `DailyLogEntry` 型を共有)、Settings(カテゴリ管理・アーカイブ設定・バックアップ/インポート/全削除)。
- **デザインの正**: `design_handoff_life_supporter/requirements-spec.dc.html` が仕様の正であり、`design-mocks.dc.html` がビジュアルの参照。採用スタイルはモック内の「ターン3」(3a/3b/3c)と「1c」のみで、それ以外のバリアントは不採用の検討過程なので参照しないこと。デザイントークン(色・角丸・余白・タイプスケール)は `design_handoff_life_supporter/README.md` にまとめられている。

## デプロイ

`main` ブランチへの push で `.github/workflows/deploy.yml` が起動し、ビルドと GitHub Pages へのデプロイを行う。`vite.config.ts` では `build` コマンド実行時のみ(`dev` 時は除く)`base: '/life-supporter/'` を設定し、GitHub Pages のサブパスに合わせている — リポジトリ名を変更する場合はこの `base` も合わせて変更すること。
