import { MetadataCache, TFile, Vault } from "obsidian";
import { RelationPair } from "./types";
import { RelationCache } from "./cache";
import { buildWikilink } from "./wikilink-utils";
import { readFieldWikilinks, updateFieldInContent } from "./yaml-utils";

/**
 * Resolve display name from frontmatter: title > aliases[0] > null.
 */
export function resolveDisplayName(
	frontmatter: Record<string, unknown> | undefined | null
): string | null {
	if (!frontmatter) return null;
	if (typeof frontmatter.title === "string" && frontmatter.title.length > 0) {
		return frontmatter.title;
	}
	return null;
}

/**
 * When a new file is created, propagate its display name to all existing
 * wikilinks that point to it (in watched fields only).
 */
export async function onFileCreated(
	file: TFile,
	vault: Vault,
	metadataCache: MetadataCache,
	cache: RelationCache,
	pairs: RelationPair[],
	syncing: Set<string>,
	debug: boolean
): Promise<void> {
	const fileName = file.basename;
	const fm = metadataCache.getFileCache(file)?.frontmatter;
	const displayName = resolveDisplayName(fm);

	cache.updateDisplayName(fileName, displayName);

	if (displayName) {
		await updateDisplayNamesInVault(
			fileName,
			null, // oldDisplay = null means only update bare [[filename]] links
			displayName,
			vault,
			cache,
			syncing,
			debug
		);
	}
}

/**
 * When a file's title or aliases change, update all wikilinks pointing to it.
 */
export async function onDisplayNameChanged(
	filePath: string,
	fileName: string,
	oldDisplay: string | null,
	newDisplay: string | null,
	vault: Vault,
	cache: RelationCache,
	syncing: Set<string>,
	debug: boolean
): Promise<void> {
	cache.updateDisplayName(fileName, newDisplay);

	await updateDisplayNamesInVault(
		fileName,
		oldDisplay,
		newDisplay,
		vault,
		cache,
		syncing,
		debug
	);
}

/**
 * Scan all files with links to targetFileName (in watched fields)
 * and update the display name portion of those wikilinks.
 *
 * Uses readFieldWikilinks + updateFieldInContent (line-by-line)
 * to avoid regex-based YAML corruption.
 */
async function updateDisplayNamesInVault(
	targetFileName: string,
	oldDisplay: string | null,
	newDisplay: string | null,
	vault: Vault,
	cache: RelationCache,
	syncing: Set<string>,
	debug: boolean
): Promise<void> {
	const linkingFiles = cache.findFilesLinkingTo(targetFileName);

	for (const { filePath, fieldName } of linkingFiles) {
		const file = vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) continue;

		syncing.add(filePath);
		try {
			await vault.process(file, (content) => {
				return updateDisplayInField(
					content,
					fieldName,
					targetFileName,
					oldDisplay,
					newDisplay
				);
			});
		} finally {
			window.setTimeout(() => syncing.delete(filePath), 500);
		}

		if (debug) {
			console.log(
				`[YBR] Updated display name for [[${targetFileName}]] in ${filePath}:${fieldName} → ${newDisplay}`
			);
		}
	}
}

/**
 * Update display name for a specific target in a field.
 * Reads existing links, updates the matching one, writes back
 * using the safe line-by-line updateFieldInContent.
 */
function updateDisplayInField(
	content: string,
	fieldName: string,
	targetFileName: string,
	oldDisplay: string | null,
	newDisplay: string | null
): string {
	const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!fmMatch) return content;

	const yamlPart = fmMatch[1];
	const existingLinks = readFieldWikilinks(yamlPart, fieldName);
	if (existingLinks.length === 0) return content;

	let changed = false;
	const updatedLinks = existingLinks.map((link) => {
		const match = link.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
		if (match && match[1] === targetFileName) {
			const currentDisplay = match[2] ?? null;
			// Only update if:
			// 1. No display name yet (bare [[filename]])
			// 2. Current display matches the old auto-set display name
			// Do NOT overwrite user-customized display names
			if (currentDisplay === null || currentDisplay === oldDisplay) {
				const newLink = buildWikilink(targetFileName, newDisplay);
				if (newLink !== link) changed = true;
				return newLink;
			}
		}
		return link;
	});

	if (!changed) return content;

	return updateFieldInContent(content, fieldName, updatedLinks);
}
