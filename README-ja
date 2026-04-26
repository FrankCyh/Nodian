[English](README.md) | [中文](README-zh.md) | 日本語

# Nodian

YAML frontmatter の双方向リレーションを自動同期する [Obsidian](https://obsidian.md) プラグイン。（旧名: YAML Bidirectional Relation）

あるファイルのフィールドに wikilink を追加すると、対象ファイルの対応フィールドに逆参照リンクを自動で書き込みます。リンクを削除すると逆参照も自動で除去されます。

## 使用例

```
Person.md                          Mail.md
─────────                          ─────────
tags: [Person]                     tags: [Mail]
Mail: [[hello@example]]     →     Person: [[Alice]]        ← 自動生成
```

## 機能

- **自動同期** — リンクの追加・削除で、もう片方も即座に更新
- **リレーションペア** — どのフィールド同士がペアかを設定（例: `Mail ↔ Person`、`Artist ↔ Songs`）
- **表示名** — 設定で有効にすると、逆参照リンクに `title` フィールドを表示名として使用（オプトイン）
- **Tag 必須マッチング** — 各ペアには Tag が必須。フィールド名 + Tag の両方が一致した場合のみ同期
- **自動検出** — 新しいリレーションフィールドを検出すると、ペア設定のポップアップを表示
- **新規ファイル対応** — wikilink からファイルを作成すると、Tag と逆参照を自動追加
- **一括同期コマンド** — Command Palette からすべてのリレーションを手動同期

---

## インストール

### BRAT（推奨）

1. Community Plugins から [BRAT](https://github.com/TfTHacker/obsidian42-brat) をインストール
2. BRAT → Add Beta Plugin → `AkiSantin/Nodian`

### 手動インストール

`main.js`、`manifest.json`、`styles.css` を以下にコピー:

```
<vault>/.obsidian/plugins/nodian/
```

Obsidian を再起動 → Settings → Community Plugins → Nodian を有効化。

---

## はじめに

### ステップ 1: 最初のペアを設定

任意の `.md` ファイルを開き、YAML フィールドに wikilink を追加:

```yaml
---
tags: [Person]
Mail: "[[hello@example]]"
---
```

別のファイルに切り替えると、ポップアップが表示されます:

> **新しいリレーションフィールドを検出**
> 「Alice」に wikilink を含む「Mail」フィールドがあります。
> 「Mail」が別のファイルにリンクする場合、そのファイルのどのフィールドに逆参照を書き込みますか？

対応するフィールド名（例: `Person`）を選択または入力し、**Save** を押します。

### ステップ 2: 確認

`hello@example.md` を開くと:

```yaml
---
Person: "[[Alice]]"
---
```

以後、任意のファイルの `Mail` フィールドは対象ファイルの `Person` フィールドと自動同期します。

### ステップ 3: 一括同期（初回のみ）

既存のリレーションデータがある場合、一度だけ一括同期を実行:

Command Palette（`Cmd+P`）→ **Sync all bidirectional relations**

すべてのファイルをスキャンし、不足している逆参照を補完します。

---

## 使い方

### リンクの追加

ペア設定済みのフィールドに wikilink を追加すると、対象ファイルに逆参照が自動で作成されます。

```yaml
# Artist.md で入力:
Songs: "[[Blue Sky]]"

# Blue Sky.md に自動生成:
Artist: "[[Artist Name]]"
```

### リンクの削除

フィールドから wikilink を削除して保存すると、対象ファイルの逆参照も自動で削除されます。

### 複数リンク

1 つのフィールドに複数の wikilink を記述できます:

```yaml
Songs:
  - "[[Blue Sky]]"
  - "[[Red Moon]]"
  - "[[Green Field]]"
```

各対象ファイルにそれぞれ逆参照が作成されます。1 つを削除しても他には影響しません。

### 自己リレーション

フィールドを自分自身とペアにできます:

```
Related ↔ Related
```

A.md に `Related: [[B]]` を追加すると、B.md に `Related: [[A]]` が追加されます。

### 表示名

デフォルトでは、逆参照リンクはファイル名のみを使用します: `[[my-artist-id]]`。

設定で **Use title as display name** を有効にすると、`[[my-artist-id|Some Artist Name]]`（ソースファイルの `title` フロントマターフィールドの値）として表示されます。`title` フィールドのみが使用され、`aliases` は参照されません。

この設定を変更しても、既存の逆参照リンクは自動更新されません。変更後、Command Palette から **Sync all bidirectional relations** を実行してすべてのリンクを更新してください。

### 新規ファイル作成

まだ存在しないファイルへのリンクを記述した場合:

```yaml
Mail: "[[new-contact]]"
```

`new-contact.md` が作成されると（例: Obsidian でリンクをクリック）、プラグインは:
1. 適切な Tag を新規ファイルに追加
2. 逆参照リンクを自動書き込み

---

## Tags

すべてのリレーションペアには **Tag A** と **Tag B** があり、Field A と Field B に対応します。Tag は**必須**です。

### Tag の仕組み

プラグインは以下の**両方**の条件を満たす場合のみ同期します:

1. ソースファイルにペアのフィールド名と一致するフィールドがある
2. ソースファイルの Tag がそのペアの対応する Tag と一致する

これにより誤った同期を防ぎます。例えば `Release` ファイルと `Song` ファイルの両方に `Artist` フィールドがある場合、Tag により各ペアが正しいファイルタイプにのみ適用されます。

### Tag の自動割り当て

- 設定モーダルからペアを作成すると、ソースファイルの既存 Tag に基づいて Tag が自動割り当てされます。
- wikilink から新規ファイルが作成されると、ペア定義に基づいて適切な Tag が自動追加されます。

---

## 設定

Settings → Nodian を開きます。

### リレーションペア

フィールドペアの追加・編集・削除。各ペアは双方向にリンクされる 2 つのフィールド名を定義します。

| 設定 | デフォルト | 説明 |
|------|-----------|------|
| Auto sync | ON | 編集時に逆参照を自動同期 |
| Use title as display name | OFF | 逆参照リンクに `title` フィールドを表示名として使用。変更後は Full Sync を実行してください。 |
| Debug mode | OFF | 開発者コンソールに詳細ログを出力 |

---

## ペア例

各ペアには設定画面でフィールドと共に Tag A と Tag B も設定されます。以下の表はフィールドペアのみを示しています。

音楽 Vault:

| Field A | ↔ | Field B |
|---------|---|---------|
| Artist | ↔ | Release |
| Artist | ↔ | Tracks |
| Composer | ↔ | Works |
| Label | ↔ | Releases |
| Related | ↔ | Related |

企業 / CRM Vault:

| Field A | ↔ | Field B |
|---------|---|---------|
| Mail | ↔ | Person |
| Mail | ↔ | Domain |
| Mail | ↔ | Account |
| Service | ↔ | Account |

---

## 注意事項

- **初回使用前に Vault をバックアップしてください。** このプラグインは YAML frontmatter を直接編集します。ペアで定義されたフィールドのみを変更しますが、複雑なカスタム YAML がある場合、予期しないフォーマット変更が発生する可能性があります。
- **ファイルの削除**では、そのファイルへの逆参照リンクは自動削除されません。未解決リンクとして残ります（データ消失防止のための仕様）。
- **ファイルの名前変更**は Obsidian 内蔵のリンク更新機能が処理します。プラグインは追加処理不要です。
- **重複ペア**（例: `A ↔ B` と `B ↔ A` の両方）は冗長です。1 つのペアで双方向をカバーします。
- **同名ファイル** — 異なるフォルダに同名のファイルがあると、同期先が誤る可能性があります。一意のファイル名か aliases を使用してください。

---

## トラブルシューティング

### 設定済みのペアなのにポップアップが繰り返し表示される

1. Settings → Nodian → ペアが存在するか確認
2. 重複ペア（例: `Artist ↔ Release` と `Release ↔ Artist` の両方）を削除
3. Obsidian を再起動

### 逆参照リンクが表示されない

1. 設定で Auto sync が ON になっているか確認
2. 一括同期を実行: `Cmd+P` → `Sync all bidirectional relations`
3. 対象ファイルが Vault 内に存在するか確認

### YAML に問題が発生した場合

設定で Debug mode を ON にし、問題を再現してから開発者コンソール（`Cmd+Option+I`）で `[YBR]` ログを確認してください。
