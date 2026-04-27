import { ParsedWikilink } from "./types";

export function parseWikilink(raw: string): ParsedWikilink | null {
	const match = raw.match(/^\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]$/);
	if (!match) return null;
	return {
		target: match[1].trim(),
		display: match[2]?.trim() ?? null,
	};
}

export function buildWikilink(target: string, display?: string | null): string {
	if (display && display !== target) {
		return `[[${target}|${display}]]`;
	}
	return `[[${target}]]`;
}

/**
 * Extract link targets from a frontmatter field value.
 * Handles: string, string[], nested arrays (from YAML misparse of [[X]]), null/undefined.
 */
export function extractTargets(fieldValue: unknown): string[] {
	if (fieldValue == null) return [];

	if (typeof fieldValue === "string") {
		const parsed = parseWikilink(fieldValue);
		return parsed ? [parsed.target] : [];
	}

	if (Array.isArray(fieldValue)) {
		const targets: string[] = [];
		for (const item of fieldValue) {
			if (typeof item === "string") {
				const parsed = parseWikilink(item);
				if (parsed) targets.push(parsed.target);
			} else if (Array.isArray(item)) {
				// Handle YAML misparse: [[X]] becomes [["X"]] in some parsers
				for (const sub of item) {
					if (typeof sub === "string") {
						targets.push(sub);
					}
				}
			}
		}
		return targets;
	}

	return [];
}

/**
 * Check if any link in the raw values points to the given target file name.
 */
export function hasLinkTo(rawLinks: string[], targetFileName: string): boolean {
	return rawLinks.some((link) => {
		const parsed = parseWikilink(link);
		return parsed && parsed.target === targetFileName;
	});
}

/**
 * Update the display name for a specific target in a list of raw wikilink strings.
 * Returns a new array with updated display names.
 */
export function updateDisplayInLinks(
	rawLinks: string[],
	targetFileName: string,
	newDisplay: string | null
): string[] {
	return rawLinks.map((link) => {
		const parsed = parseWikilink(link);
		if (parsed && parsed.target === targetFileName) {
			return buildWikilink(targetFileName, newDisplay);
		}
		return link;
	});
}

/**
 * Extract raw wikilink strings from a frontmatter field value.
 * Unlike extractTargets, this preserves the full [[X|Y]] format.
 */
export function extractRawLinks(fieldValue: unknown): string[] {
	if (fieldValue == null) return [];

	if (typeof fieldValue === "string") {
		const parsed = parseWikilink(fieldValue);
		return parsed ? [fieldValue] : [];
	}

	if (Array.isArray(fieldValue)) {
		const links: string[] = [];
		for (const item of fieldValue) {
			if (typeof item === "string") {
				const parsed = parseWikilink(item);
				if (parsed) links.push(item);
			}
		}
		return links;
	}

	return [];
}
