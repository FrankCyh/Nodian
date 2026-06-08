export interface RelationPair {
	fieldA: string;
	fieldB: string;
	patternA: string;
	patternB: string;
}

export interface PluginSettings {
	pairs: RelationPair[];
	autoSync: boolean;
	useDisplayName: boolean;
	debug: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	pairs: [],
	autoSync: true,
	useDisplayName: false,
	debug: false,
};

export function isValidRegexPattern(pattern: string): boolean {
	try {
		new RegExp(pattern);
		return true;
	} catch {
		return false;
	}
}

export function isCompletePair(pair: RelationPair): boolean {
	return (
		pair.fieldA.trim().length > 0 &&
		pair.fieldB.trim().length > 0 &&
		pair.patternA.trim().length > 0 &&
		pair.patternB.trim().length > 0 &&
		isValidRegexPattern(pair.patternA) &&
		isValidRegexPattern(pair.patternB)
	);
}

export interface ParsedWikilink {
	target: string;
	display: string | null;
}

export interface RelationChange {
	sourceFile: string;
	sourceFileName: string;
	fieldName: string;
	targetFieldName: string;
	added: string[];
	removed: string[];
	targetPattern?: string;
}
