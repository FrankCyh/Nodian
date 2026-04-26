[English](README.md) | 中文 | [日本語](README-ja.md)

# Nodian

自動同步 YAML frontmatter 中雙向關聯的 [Obsidian](https://obsidian.md) 外掛（前身為 YAML Bidirectional Relation）。

在一個檔案的欄位加入 wikilink，外掛會自動在目標檔案的對應欄位寫入反向連結 — 刪除連結時也會自動移除。

## 範例

```
Person.md                          Mail.md
─────────                          ─────────
tags: [Person]                     tags: [Mail]
Mail: [[hello@example]]     →     Person: [[Alice]]        ← 自動產生
```

## 功能

- **自動同步** — 新增或移除連結，另一邊即時更新
- **欄位配對** — 自訂哪些欄位互相配對（例如 `Mail ↔ Person`、`Artist ↔ Songs`）
- **顯示名稱** — 可選擇使用 `title` 欄位作為反向連結的顯示文字（需在設定中開啟）
- **Tag 強制配對** — 每組配對都需要 tag，欄位 + tag 都符合時才觸發同步
- **自動偵測** — 偵測到新的關聯欄位時，跳出彈窗讓你設定配對
- **新檔案支援** — 從 wikilink 建立新檔案時，自動加上 tag 和反向連結
- **全量同步指令** — 透過 Command Palette 手動同步所有關聯

---

## 安裝

### 使用 BRAT（推薦）

1. 從 Community Plugins 安裝 [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. BRAT → Add Beta Plugin → `AkiSantin/Nodian`

### 手動安裝

將 `main.js`、`manifest.json`、`styles.css` 複製到：

```
<vault>/.obsidian/plugins/nodian/
```

重啟 Obsidian → Settings → Community Plugins → 啟用 Nodian。

---

## 開始使用

### 步驟一：設定第一組配對

打開任一 `.md` 檔，在 YAML 欄位加入 wikilink：

```yaml
---
tags: [Person]
Mail: "[[hello@example]]"
---
```

切換到其他檔案時會彈出提示：

> **偵測到新的關聯欄位**
> 「Alice」有一個包含 wikilink 的「Mail」欄位。
> 當「Mail」連結到另一個檔案時，目標檔案的哪個欄位應該接收反向連結？

選擇或輸入對應欄位名稱（例如 `Person`），按下 **Save**。

### 步驟二：確認

打開 `hello@example.md`，你應該會看到：

```yaml
---
Person: "[[Alice]]"
---
```

完成。從現在起，任何檔案的 `Mail` 欄位都會自動與目標檔案的 `Person` 欄位同步。

### 步驟三：全量同步（僅首次需要）

如果你的 vault 已經有既有的關聯資料，執行一次全量同步：

Command Palette（`Cmd+P`）→ **Sync all bidirectional relations**

這會掃描所有檔案，補上缺少的反向連結。

---

## 使用說明

### 新增連結

在任何已配對的欄位加入 wikilink，反向連結會自動出現在目標檔案。

```yaml
# 你在 Artist.md 輸入：
Songs: "[[Blue Sky]]"

# 外掛自動在 Blue Sky.md 產生：
Artist: "[[Artist Name]]"
```

### 移除連結

刪除欄位中的 wikilink 並儲存，目標檔案的反向連結會自動移除。

### 多個連結

一個欄位可以包含多個 wikilink：

```yaml
Songs:
  - "[[Blue Sky]]"
  - "[[Red Moon]]"
  - "[[Green Field]]"
```

每個目標檔案各自取得反向連結，移除其中一個不影響其他。

### 同名配對（Self-Relation）

欄位可以跟自己配對：

```
Related ↔ Related
```

在 A.md 加入 `Related: [[B]]`，B.md 就會出現 `Related: [[A]]`。

### 顯示名稱

預設情況下，反向連結只使用 `[[檔名]]`，不加顯示名稱。

若要使用檔案的 `title` 欄位作為顯示文字，前往 Settings → Nodian → 開啟 **Use title as display name**。開啟後，反向連結會寫入為 `[[檔名|title]]`。

```yaml
# 來源檔案（my-artist-id.md）：
title: "某個歌手名稱"
```

指向此檔案的反向連結會顯示為 `[[my-artist-id|某個歌手名稱]]`。

此設定不會自動修改既有的反向連結。變更 toggle 後，執行 Full Sync（`Cmd+P` → **Sync all bidirectional relations**）可一次更新所有反向連結的顯示名稱。

### 新檔案建立

如果你連結到一個尚不存在的檔案：

```yaml
Mail: "[[new-contact]]"
```

當 `new-contact.md` 被建立時（例如在 Obsidian 中點擊連結），外掛會：
1. 自動加上對應的 tag
2. 自動寫入反向連結

---

## Tags 與配對

### Tag 是必要條件

每組配對都有 **Tag A** 和 **Tag B** — tag 是配對定義的一部分，不是選用項目。

外掛只在**欄位名稱符合配對 AND 來源檔案的 tag 符合該配對的對應 tag** 時才會同步。這避免了錯誤配對 — 例如 `Artist` 欄位不會意外同步到 `Release` 而非 `Songs`。

### 範例

`Mail` 欄位出現在三組配對中，靠 tag 區分：

| 配對 | Tag A | Tag B | 意義 |
|------|-------|-------|------|
| Mail ↔ Person | Mail | Person | 信箱屬於某人 |
| Mail ↔ Domain | Mail | Domain | 信箱屬於某網域 |
| Mail ↔ Account | Mail | Account | 信箱屬於某帳號 |

當一個標記為 `Person` 的檔案有 `Mail` 欄位時，外掛因為 tag 匹配而選擇 `Mail ↔ Person` 配對，不會誤用其他配對。

### Tag 如何指定

- 透過彈窗設定配對時，tag 會**自動指定**
- 從 wikilink 建立的新檔案會**自動取得 tag**

---

## 設定

前往 Settings → Nodian。

### 欄位配對

新增、編輯或刪除配對。每組配對定義兩個雙向連結的欄位名稱。

| 設定 | 預設 | 說明 |
|------|------|------|
| Auto sync | ON | 編輯時自動同步反向連結 |
| Use title as display name | OFF | 反向連結使用 `title` 欄位作為顯示名稱。變更後請執行 Full Sync。 |
| Debug mode | OFF | 在開發者 console 輸出詳細日誌 |

---

## 配對範例

音樂 vault：

| 欄位 A | ↔ | 欄位 B |
|--------|---|--------|
| Artist | ↔ | Release |
| Artist | ↔ | Tracks |
| Composer | ↔ | Works |
| Label | ↔ | Releases |
| Related | ↔ | Related |

公司 / CRM vault：

| 欄位 A | ↔ | 欄位 B |
|--------|---|--------|
| Mail | ↔ | Person |
| Mail | ↔ | Domain |
| Mail | ↔ | Account |
| Service | ↔ | Account |

---

## ⚠️ 注意事項

- **首次使用前請備份 vault。** 此外掛會直接修改 YAML frontmatter。雖然只會動到配對中定義的欄位，但如果你有複雜的自訂 YAML 內容，可能會出現非預期的格式變動。
- **刪除檔案**不會自動清除指向它的反向連結 — 那些連結會變成未解析連結（這是刻意設計，避免誤刪導致資料遺失）。
- **重新命名檔案**由 Obsidian 內建的連結更新功能處理，外掛不需要額外處理。
- **重複配對**（例如同時有 `A ↔ B` 和 `B ↔ A`）是多餘的 — 一組配對已涵蓋雙向。
- **同名檔案**：不同資料夾有同名檔案（相同 basename）時，可能造成同步目標錯誤。建議使用不同檔名搭配 `aliases` 來區分。

---

## 疑難排解

### 彈窗一直重複詢問已經設定過的配對

1. 到 Settings → Nodian → 確認配對存在
2. 移除重複的配對（例如同時有 `Artist ↔ Release` 和 `Release ↔ Artist`）
3. 重啟 Obsidian

### 反向連結沒有出現

1. 確認設定中 Auto sync 是開啟的
2. 嘗試全量同步：`Cmd+P` → `Sync all bidirectional relations`
3. 確認目標檔案存在於 vault 中

### YAML 出了問題

在設定中開啟 Debug mode，重現問題，然後打開開發者 console（`Cmd+Option+I`）查看 `[Nodian]` 開頭的日誌。
