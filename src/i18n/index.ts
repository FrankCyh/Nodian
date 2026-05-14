import { getLanguage } from "obsidian";
import en from "./en";
import zhTW from "./zh-TW";
import ja from "./ja";

const locales: Record<string, Record<string, string>> = {
	en,
	"zh-TW": zhTW,
	ja,
};

function getLocale(): string {
	const language = getLanguage().toLowerCase();
	if (language === "zh-tw") return "zh-TW";
	if (language.startsWith("ja")) return "ja";
	return "en";
}

/**
 * Translate a key with optional placeholder arguments.
 * Placeholders use {0}, {1}, {2}, etc.
 */
export function t(key: string, ...args: string[]): string {
	const locale = getLocale();
	const dict = locales[locale] || locales["en"];
	let str = dict[key] || locales["en"][key] || key;
	args.forEach((arg, i) => {
		str = str.replace(`{${i}}`, arg);
	});
	return str;
}
