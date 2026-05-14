export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function getFrontmatterTags(frontmatter: unknown): string[] {
	if (!isRecord(frontmatter)) return [];

	const raw = frontmatter.tags;
	if (typeof raw === "string") return [raw];
	if (Array.isArray(raw)) {
		return raw.filter((tag): tag is string => typeof tag === "string");
	}
	return [];
}

export function getFrontmatterKeys(frontmatter: unknown): string[] {
	return isRecord(frontmatter) ? Object.keys(frontmatter) : [];
}

export function getFrontmatterValue(frontmatter: unknown, key: string): unknown {
	return isRecord(frontmatter) ? frontmatter[key] : undefined;
}

export function getFrontmatterString(frontmatter: unknown, key: string): string | null {
	const value = getFrontmatterValue(frontmatter, key);
	return typeof value === "string" && value.length > 0 ? value : null;
}
