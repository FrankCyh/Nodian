English | [中文](README-zh.md) | [日本語](README-ja.md)

# Nodian

An [Obsidian](https://obsidian.md) plugin that automatically syncs bidirectional relations in YAML frontmatter. (formerly YAML Bidirectional Relation)

When you add a wikilink to a field in one file, the plugin writes a backlink in the target file's corresponding field — and removes it when you delete the link.

## Example

```
Person.md                          Mail.md
─────────                          ─────────
tags: [Person]                     tags: [Mail]
Mail: [[hello@example]]     →     Person: [[Alice]]        ← auto-generated
```

## Features

- **Auto sync** — add or remove a link in one file, the other side updates instantly
- **Relation pairs** — define which fields are paired (e.g. `Mail ↔ Person`, `Artist ↔ Songs`)
- **Display names** — optionally use `title` field as display text in backlinks (opt-in via settings)
- **Tag-based matching** — each pair requires tags; sync only fires when both field and tag match
- **Auto-detect** — the plugin detects new relation fields and prompts you to set up pairs
- **New file support** — creating a file from a wikilink auto-adds tags and backlinks
- **Full sync command** — manually sync all relations via Command Palette

---

## Install

### With BRAT (recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Community Plugins
2. BRAT → Add Beta Plugin → `AkiSantin/Nodian`

### Manual

Copy `main.js`, `manifest.json`, and `styles.css` to:

```
<vault>/.obsidian/plugins/nodian/
```

Restart Obsidian → Settings → Community Plugins → Enable Nodian.

---

## Getting Started

### Step 1: Set up your first pair

Open any `.md` file and add a wikilink to a YAML field:

```yaml
---
tags: [Person]
Mail: "[[hello@example]]"
---
```

When you switch to another file, a popup will appear:

> **New relation field detected**
> "Alice" has a "Mail" field with wikilinks.
> When "Mail" links to another file, what field in THAT file should get the backlink?

Select or type the counterpart field name (e.g. `Person`) and press **Save**.

### Step 2: Verify

Open `hello@example.md` — you should see:

```yaml
---
Person: "[[Alice]]"
---
```

That's it. From now on, any file's `Mail` field will automatically sync with the target file's `Person` field.

### Step 3: Run full sync (first time only)

If your vault already has existing relations, run a one-time full sync:

Command Palette (`Cmd+P`) → **Sync all bidirectional relations**

This scans every file and backfills any missing backlinks.

---

## Usage Guide

### Adding a link

Add a wikilink to any paired field. The backlink appears in the target file automatically.

```yaml
# You type this in Artist.md:
Songs: "[[Blue Sky]]"

# Plugin auto-generates this in Blue Sky.md:
Artist: "[[Artist Name]]"
```

### Removing a link

Delete the wikilink from the field and save. The backlink in the target file is removed automatically.

### Multiple links

A field can hold multiple wikilinks:

```yaml
Songs:
  - "[[Blue Sky]]"
  - "[[Red Moon]]"
  - "[[Green Field]]"
```

Each target file gets its own backlink. Removing one link only affects that specific target.

### Self-relations

A field can be paired with itself:

```
Related ↔ Related
```

Adding `Related: [[B]]` in A.md will add `Related: [[A]]` in B.md.

### Display names

By default, backlinks use the plain filename only: `[[my-artist-id]]`.

To use the `title` field as display text, enable **Use title as display name** in Settings. When enabled, backlinks will appear as `[[my-artist-id|Some Artist Name]]` (using the value of the source file's `title` frontmatter field). Only the `title` field is used -- `aliases` are not checked.

Toggling this setting does not retroactively update existing backlinks. After changing it, run **Sync all bidirectional relations** from the Command Palette to update all backlinks across the vault.

### New file creation

If you link to a file that doesn't exist yet:

```yaml
Mail: "[[new-contact]]"
```

When `new-contact.md` is created (e.g. by clicking the link in Obsidian), the plugin will:
1. Add the appropriate tag to the new file
2. Write the backlink automatically

---

## Tags

Every relation pair has two tags — **Tag A** and **Tag B** — that correspond to Field A and Field B. Tags are **required**, not optional.

### How tags work

The plugin only syncs when **both** conditions are met:

1. The source file has a field that matches a pair's field name
2. The source file's tag matches that pair's corresponding tag

This prevents wrong-target sync. For example, if both `Release` files and `Song` files have an `Artist` field, the tag ensures each pair only fires for the correct file type — a `Release`-tagged file uses the `Artist ↔ Release` pair, while a `Song`-tagged file uses the `Artist ↔ Song` pair.

### Automatic tag assignment

- When you set up a pair through the settings modal, tags are assigned automatically based on the source file's existing tag.
- When a new file is created from a wikilink, the plugin auto-assigns the appropriate tag from the pair definition.

---

## Settings

Go to Settings → Nodian.

### Relation Pairs

Add, edit, or remove field pairs. Each pair defines two field names that are bidirectionally linked.

| Setting | Default | Description |
|---------|---------|-------------|
| Auto sync | ON | Sync backlinks automatically when editing |
| Use title as display name | OFF | Use the `title` field as display text in backlinks. Run Full Sync after changing. |
| Debug mode | OFF | Log detailed info to the developer console |

---

## Pair Examples

Each pair also has Tag A and Tag B configured alongside the fields in Settings. The tables below show the field pairings only — tags are assigned through the settings modal when you create each pair.

A music vault:

| Field A | ↔ | Field B |
|---------|---|---------|
| Artist | ↔ | Release |
| Artist | ↔ | Tracks |
| Composer | ↔ | Works |
| Label | ↔ | Releases |
| Related | ↔ | Related |

A company/CRM vault:

| Field A | ↔ | Field B |
|---------|---|---------|
| Mail | ↔ | Person |
| Mail | ↔ | Domain |
| Mail | ↔ | Account |
| Service | ↔ | Account |

---

## ⚠️ Important Notes

- **Back up your vault before first use.** This plugin modifies YAML frontmatter directly. While it only touches fields defined in your pairs, unexpected formatting changes are possible if you have complex custom YAML.
- **Deleting a file** does not remove backlinks pointing to it — those become unresolved links (by design, to prevent accidental data loss).
- **Renaming a file** is handled by Obsidian's built-in link updater — the plugin doesn't need to do anything extra.
- **Duplicate pairs** (e.g. `A ↔ B` and `B ↔ A`) are redundant — one pair covers both directions.
- **Duplicate basenames** — files with the same name in different folders may cause incorrect sync targets. Use unique filenames or aliases to avoid ambiguity.

---

## Troubleshooting

### The popup keeps asking me to set up a pair I already defined

1. Check Settings → Nodian → make sure the pair exists
2. Remove any duplicate pairs (e.g. both `Artist ↔ Release` and `Release ↔ Artist`)
3. Restart Obsidian

### Backlinks aren't appearing

1. Make sure auto sync is ON in settings
2. Try running full sync: `Cmd+P` → `Sync all bidirectional relations`
3. Check that the target file exists in the vault

### Something went wrong with my YAML

Turn on Debug mode in settings, reproduce the issue, then check the developer console (`Cmd+Option+I`) for `[YBR]` logs.
