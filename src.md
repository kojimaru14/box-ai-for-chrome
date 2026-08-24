結論から言うと、「`src`（または `app`, `public`）などの専用ディレクトリを作成し、拡張機能本体（Unpacked 用のパッケージ）をルートから分離して開発する構造」が完全にデファクトスタンダード（標準的）です。

質問者様が感じていらっしゃる違和感は非常に正しく、ソースコードのルートに `manifest.json` や各種設定ファイルを平置きしてしまうと、ビルド成果物、テストコード、CI/CD用設定ファイルなどが混ざり合い、管理が速やかに破綻します。

以下に、開発時のディレクトリ構成パターンと、それぞれのメリットについてまとめました。

---

### 推奨されるリポジトリ構成パターン

開発規模やビルドツール（Vite, Webpack, Biome, ESLint など）の使用有無に応じた 2 つの推奨構成です。

#### 1. ビルドツールを使う場合（モダン開発の推奨）

TypeScript や React、モジュールバンドラを使用する一般的な開発構成です。

```text
my-chrome-extension/
├── .github/              # CI/CDワークフロー（拡張機能には含めない）
├── .gitignore
├── package.json
├── README.md
├── tsconfig.json
├── vite.config.ts
├── src/                  # 開発用のソースコード
│   ├── background/
│   ├── content/
│   ├── popup/
│   └── manifest.ts       # 型定義付きで管理（ビルド時に json 化）
└── dist/                 # ★ Chromeに「Unpacked」として読み込ませるフォルダ
    ├── manifest.json
    ├── popup.html
    └── ...

```

* **Chrome 読み込み先:** `dist/` ディレクトリ
* **メリット:** 最終的な拡張機能に必要なファイルだけが `dist/` に生成されるため、サイズ圧縮やセキュリティ（無駄なコメントやテスト用コードの除外）の面で最適です。

---

#### 2. ビルドツールを使わない場合（プレーンな JS/HTML のみ）

トランスパイルを行わず、そのままのコードで開発する場合でも、以下のようにルートから分離します。

```text
my-chrome-extension/
├── .github/
├── .gitignore
├── package.json          # linter や test 用の依存関係
├── README.md
├── tests/                # テストコード（拡張機能には含めない）
└── extension/            # ★ Chromeに「Unpacked」として読み込ませるフォルダ
    ├── manifest.json
    ├── background.js
    ├── popup/
    └── icons/

```

* **Chrome 読み込み先:** `extension/` （または `src/`, `public/`）ディレクトリ
* **メリット:** `chrome://extensions` で「パッケージ化されていない拡張機能を読み込む（Load unpacked）」を選択する際、`extension/` フォルダを指定するだけで済みます。ルートにある `README.md` や `tests/` などの非同梱ファイルが拡張機能に含まれません。

---

### 分離する具体的なメリット

1. **不要ファイルの混入防止とパッケージサイズの削減**
.git、README、package.json、テストコード、ドキュメント用画像などが zip 化やストア提出用パッケージから自動的に排除されます。
2. **Web Store 審査対策**
ストア提出時（`dist` や `extension` 内を zip 化して提出）に無駄なファイルが含まれないため、拡張機能の容量制限に引っかかるリスクが減り、審査（セキュリティチェック）も通りやすくなります。
3. **設定ファイル・ツールの分離**
ESLint、Prettier、Jest、GitHub Actions などの設定ファイルをルートに集約できるため、拡張機能本体のディレクトリが常にスッキリ保たれます。

---

### まとめ

開発専用フォルダ（`src/`）とビルド成果物フォルダ（`dist/`）を設けるか、少なくとも `extension/` のような専用ディレクトリを切ってその中に `manifest.json` を配置する構成に移行することを強くお勧めします。