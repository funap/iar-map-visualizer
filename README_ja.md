# IAR Map Visualizer

[English](README.md) | 日本語

**🚀 Web版 (Live Demo)**: [https://funap.github.io/iar-map-visualizer/](https://funap.github.io/iar-map-visualizer/)

IAR Embedded Workbench for ARM (EWARM) のリンカーマップファイル (.map) およびプロジェクトファイル (.ewp) を解析し、ROM (RO Code / RO Data) および RAM (RW Data) のメモリ使用量を視覚的に分析するためのWebツールです。

## 概要

組み込み開発において、マイコンのFlashメモリ容量に対する各モジュールやライブラリの占有率を直感的に把握できます。
ブラウザ上で全ての解析処理を行うため、ファイルが外部サーバーに送信されることはありません。

## 主な機能

- インタラクティブなTreeMap表示
  モジュールやライブラリごとのメモリ使用量を面積で可視化します。クリック操作で深掘り（ドリルダウン）や階層の移動が可能です。

- EWARMプロジェクトフォルダ単位の表示対応
  .map ファイルに加え .ewp ファイルを読み込むことで、EWARMの仮想プロジェクトフォルダ構造に合わせたグループ表示が可能です。

- グルーピングモードの切り替え
  ビルド出力単位（ライブラリ / モジュール）での表示と、IDE上のプロジェクトフォルダ構造での表示をワンクリックで切り替えられます。

- Flashメモリ使用率の確認
  ターゲットマイコンのFlash容量（KB / MB）を指定することで、許容量に対する使用率や残量をリアルタイムに確認できます。

- モジュール一覧テーブルと検索・ソート
  オブジェクトモジュールごとの RO Code、RO Data、RW Data を一覧表示します。各項目でのソートやキーワード検索に対応し、行をクリックするとTreeMap上で該当モジュールへズームします。

- 完全ローカル処理
  データ解析はすべてブラウザ内で完結するため、ローカル環境（index.htmlを直接開く構成）でも動作します。

## 使い方

1. [Web版](https://funap.github.io/iar-map-visualizer/) にアクセスするか、ローカルで `index.html` をブラウザで開きます。
2. ドラッグ＆ドロップエリアに EWARM の .map ファイルおよび .ewp ファイルを読み込ませます（複数ファイルの同時ドロップにも対応しています）。
3. 画面上のTreeMapで視覚的にメモリ占有率を確認します。「EWARM Folders」と「Library / Group」のボタンで表示単位を変更できます。
4. サイドバーでターゲットマイコンのFlash容量を設定すると、使用率メーターが更新されます。

## 動作環境

- Google Chrome, Microsoft Edge, Mozilla Firefox, Apple Safari などのモダンWebブラウザ

## ライセンス

MIT License
