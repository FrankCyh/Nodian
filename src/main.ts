import { Notice, Plugin, TFile } from "obsidian";
import { DEFAULT_SETTINGS, PluginSettings, RelationPair, isCompletePair } from "./types";
import { RelationCache } from "./cache";
import { YBRSettingTab } from "./settings";
import { detectChanges, applyChanges, fullSync } from "./sync";
import { resolveDisplayName } from "./display-name";
import { buildWikilink, extractTargets, hasLinkTo } from "./wikilink-utils";
import { readFieldWikilinks, updateFieldInContent } from "./yaml-utils";
import { showPairSuggestModal } from "./pair-suggest-modal";
import { t } from "./i18n";
import MenuManager from "./menu-manager";
import { getFrontmatterKeys, getFrontmatterValue, isRecord } from "./frontmatter-utils";

function extractYaml(content: string): string {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	return match ? match[1] : "";
}

function readStringSetting(record: Record<string, unknown>, key: string, fallback = ""): string {
	const value = record[key];
	return typeof value === "string" ? value : fallback;
}

function readBooleanSetting(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
	const value = record[key];
	return typeof value === "boolean" ? value : fallback;
}

function normalizeRelationPair(value: unknown): { pair: RelationPair; migrated: boolean } | null {
	if (!isRecord(value)) return null;

	const fieldA = readStringSetting(value, "fieldA");
	const fieldB = readStringSetting(value, "fieldB");
	const patternAValue = value.patternA;
	const patternBValue = value.patternB;
	const patternA = typeof patternAValue === "string"
		? patternAValue
		: readStringSetting(value, "tagA");
	const patternB = typeof patternBValue === "string"
		? patternBValue
		: readStringSetting(value, "tagB");

	return {
		pair: { fieldA, fieldB, patternA, patternB },
		migrated: typeof patternAValue !== "string" || typeof patternBValue !== "string" || "tagA" in value || "tagB" in value,
	};
}

export default class YBRPlugin extends Plugin {
	settings: PluginSettings = DEFAULT_SETTINGS;
	cache: RelationCache = new RelationCache();
	syncing: Set<string> = new Set();
	private debounceTimers: Map<string, number> = new Map();
	private layoutReady = false;
	private menuManager!: MenuManager;

	/** Frontmatter fields that should never show the relation button */
	private static SYSTEM_FIELDS = new Set([
		"title", "aliases", "tags", "cssclasses", "publish",
		"permalink", "description", "image", "cover", "banner",
		"date", "created", "updated", "modified", "position",
	]);

	async onload() {
		await this.loadSettings();

		// Initialize menu manager — intercepts Obsidian's native menus
		this.menuManager = new MenuManager();

		this.addSettingTab(new YBRSettingTab(this.app, this));

		// Register command: full sync
		this.addCommand({
			id: "sync-all-bidirectional-relations",
			name: t("cmd.syncAll"),
			callback: async () => {
				const count = await fullSync(
					this.app.vault,
					this.app.metadataCache,
					this.cache,
					this.getActivePairs(),
					this.syncing,
					this.settings.debug,
					this.settings.useDisplayName
				);
				new Notice(t("notice.syncComplete", String(count)));
			},
		});

		// Build cache when layout is ready (vault files are loaded)
		this.app.workspace.onLayoutReady(() => {
			this.rebuildCache();
			// Mark ready AFTER a short delay so initial file events are ignored
			window.setTimeout(() => {
				this.layoutReady = true;
				if (this.settings.debug) {
					console.log("[YBR] Layout ready, accepting file events");
				}
			}, 2000);
		});

		// Hook into Obsidian's property icon click — queues our menu items
		// that will be added to the native property menu when it shows.
		this.registerDomEvent(activeDocument, "click", (evt) => {
			const target = evt.target as HTMLElement;
			if (!target) return;
			if (target.closest(".metadata-property-icon")) {
				this.queuePropertyMenuItems(target);
			}
		}, true);
		this.registerDomEvent(activeDocument, "contextmenu", (evt) => {
			const target = evt.target as HTMLElement;
			if (!target) return;
			if (target.closest(".metadata-property-icon") || target.closest(".metadata-property")) {
				this.queuePropertyMenuItems(target);
			}
		}, true);

		// Listen for file modifications
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file instanceof TFile && file.extension === "md") {
					this.debouncedOnFileModify(file);
				}
			})
		);

		// Listen for file creation
		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile && file.extension === "md") {
					this.onFileCreate(file);
				}
			})
		);

		// Listen for file rename
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile && file.extension === "md") {
					const oldName = oldPath
						.split("/")
						.pop()
						?.replace(/\.md$/, "");
					if (oldName) {
						this.cache.handleRename(
							oldPath,
							file.path,
							oldName,
							file.basename
						);
						if (this.settings.debug) {
							console.log(
								`[YBR] Renamed: ${oldPath} → ${file.path}`
							);
						}
					}
				}
			})
		);

		// Listen for file deletion
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile && file.extension === "md") {
					this.cache.handleDelete(file.path, file.basename);
					if (this.settings.debug) {
						console.log(`[YBR] Deleted from cache: ${file.path}`);
					}
				}
			})
		);
	}

	onunload() {
		this.menuManager.restore();
		// Clear all debounce timers
		for (const timer of this.debounceTimers.values()) {
			window.clearTimeout(timer);
		}
		this.debounceTimers.clear();
	}

	async loadSettings() {
		const rawData = (await this.loadData()) as unknown;
		const data = isRecord(rawData) ? rawData : {};
		const rawPairs = Array.isArray(data.pairs) ? data.pairs : [];
		const normalizedPairs = rawPairs
			.map(normalizeRelationPair)
			.filter((item): item is { pair: RelationPair; migrated: boolean } => item !== null);
		const migrated =
			normalizedPairs.some((item) => item.migrated) ||
			"autoUpdateDisplayName" in data;

		this.settings = {
			pairs: normalizedPairs.map((item) => item.pair),
			autoSync: readBooleanSetting(data, "autoSync", DEFAULT_SETTINGS.autoSync),
			useDisplayName: readBooleanSetting(data, "useDisplayName", DEFAULT_SETTINGS.useDisplayName),
			debug: readBooleanSetting(data, "debug", DEFAULT_SETTINGS.debug),
		};

		if (migrated) {
			await this.saveData(this.settings);
		}
	}

	async saveSettings() {
		await this.saveData({
			...this.settings,
			pairs: this.getActivePairs(),
		});
	}

	getActivePairs(): RelationPair[] {
		return this.settings.pairs.filter(isCompletePair);
	}

	/**
	 * Rebuild the in-memory cache. Called on startup and when settings change.
	 */
	rebuildCache() {
		const activePairs = this.getActivePairs();
		const watchedFields = RelationCache.getWatchedFields(
			activePairs
		);
		this.cache.buildFullCache(
			this.app.vault,
			this.app.metadataCache,
			watchedFields
		);
	}

	// ─── Property Buttons ───────────────────────────────────────

	// ─── Context menu on properties ──────────────────────────────

	/**
	 * Queue a menu item to be added to Obsidian's native property menu.
	 * The MenuManager's Menu.showAtPosition hook will add it when
	 * the native menu is about to open.
	 */
	private queuePropertyMenuItems(target: HTMLElement) {
		const propEl = target.closest(".metadata-property");
		if (!propEl) return;

		const fieldName = propEl.getAttribute("data-property-key");
		if (!fieldName) return;

		if (YBRPlugin.SYSTEM_FIELDS.has(fieldName.toLowerCase())) return;

		// Use case-correct field name from frontmatter if available
		const activeFile = this.app.workspace.getActiveFile();
		const fm = activeFile
			? this.app.metadataCache.getFileCache(activeFile)?.frontmatter
			: null;
		const caseCorrectFieldName = fm
			? Object.keys(fm).find((k) => k.toLowerCase() === fieldName.toLowerCase()) || fieldName
			: fieldName;

		const isInAnyPair = RelationCache.isFieldInPairs(
			caseCorrectFieldName,
			this.getActivePairs()
		);

		this.menuManager.closeAndFlush();
		this.menuManager.addItem((item) =>
			item
				.setTitle(isInAnyPair ? t("menu.editPair") : t("menu.configurePair"))
				.setIcon("link")
				.onClick(() => {
					void this.onPropertyButtonClick(caseCorrectFieldName);
				})
		);
	}

	/**
	 * Handle click on a property relation button.
	 */
	private async onPropertyButtonClick(fieldName: string) {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) return;

		const currentFm = this.app.metadataCache.getFileCache(activeFile)?.frontmatter;

		// Get current page's field names to filter relevant pairs
		const pageFields = getFrontmatterKeys(currentFm).filter(
			(k) => !YBRPlugin.SYSTEM_FIELDS.has(k.toLowerCase()) && k !== "position"
		);

		const activePairs = this.getActivePairs();
		const result = await showPairSuggestModal(
			this.app,
			fieldName,
			activeFile.basename,
			activePairs,
			activeFile.path,
			pageFields
		);

		if (result.action === "save" && result.counterpartField) {
			const counterpartField = result.counterpartField;

			// Only add if this exact pair doesn't already exist
			const alreadyExists = this.settings.pairs.some(
				(p) =>
					(p.fieldA === fieldName && p.fieldB === counterpartField) ||
					(p.fieldA === counterpartField && p.fieldB === fieldName)
			);
			if (!alreadyExists) {
				this.settings.pairs.push({
					fieldA: fieldName,
					fieldB: counterpartField,
					patternA: result.sourcePattern || activeFile.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
					patternB: result.counterpartPattern || "",
				});
				await this.saveSettings();
			}

			new Notice(t("notice.pairCreated", fieldName, counterpartField));

			// Sync backlinks immediately
			const fm = this.app.metadataCache.getFileCache(activeFile)?.frontmatter;
			if (fm) {
				const targets = extractTargets(getFrontmatterValue(fm, fieldName));
				const sourceDisplay = this.settings.useDisplayName ? this.cache.getDisplayName(activeFile.basename) : null;

				for (const targetName of targets) {
					const targetFile = this.app.metadataCache.getFirstLinkpathDest(targetName, activeFile.path);
					if (!targetFile) {
						new Notice(t("notice.fileNotFound", targetName));
						continue;
					}
					if (!RelationCache.pathMatchesPattern(targetFile.path, result.counterpartPattern || "")) {
						continue;
					}

					const newLink = buildWikilink(activeFile.basename, sourceDisplay);
					this.syncing.add(targetFile.path);
					try {
						await this.app.vault.process(targetFile, (content) => {
							const yaml = extractYaml(content);
							const existing = readFieldWikilinks(yaml, counterpartField);
							if (hasLinkTo(existing, activeFile.basename)) {
								return content;
							}
							const updated = [...existing, newLink];
							return updateFieldInContent(content, counterpartField, updated);
						});
						new Notice(t("notice.backlinkAdded", targetFile.basename, counterpartField, newLink));
					} finally {
						window.setTimeout(() => this.syncing.delete(targetFile.path), 500);
					}
				}
			}

			this.rebuildCache();
			// Button re-attach no longer needed — using context menu
		} else if (result.action === "remove" && result.counterpartField) {
			// Remove a specific pair
			this.settings.pairs = this.settings.pairs.filter(
				(p) =>
					!((p.fieldA === fieldName && p.fieldB === result.counterpartField) ||
					  (p.fieldA === result.counterpartField && p.fieldB === fieldName))
			);
			await this.saveSettings();
			this.rebuildCache();
			new Notice(t("notice.pairRemoved", fieldName));
			// Button re-attach no longer needed — using context menu
		}
	}

	// ─── File Event Handlers ────────────────────────────────────

	/**
	 * Debounced file modify handler (300ms per file).
	 */
	private debouncedOnFileModify(file: TFile) {
		const existing = this.debounceTimers.get(file.path);
		if (existing) window.clearTimeout(existing);

		const timer = window.setTimeout(() => {
			this.debounceTimers.delete(file.path);
			void this.onFileModify(file);
		}, 300);

		this.debounceTimers.set(file.path, timer);
	}

	/**
	 * Handle file modification: detect relation changes and sync.
	 */
	private async onFileModify(file: TFile) {
		// Skip if this file is being written by the plugin
		if (this.syncing.has(file.path)) return;

		// Skip if auto-sync is disabled or no pairs configured
		const activePairs = this.getActivePairs();
		if (!this.settings.autoSync || activePairs.length === 0) return;

		const fm =
			this.app.metadataCache.getFileCache(file)?.frontmatter;
		const watchedFields = RelationCache.getWatchedFields(
			activePairs
		);

		// Detect relation changes
		const changes = detectChanges(
			file.path,
			file.basename,
			fm,
			this.cache,
			activePairs
		);

		if (changes.length > 0) {
			if (this.settings.debug) {
				console.log(`[YBR] Changes detected in ${file.path}:`, changes);
			}
			await applyChanges(
				changes,
				this.app.vault,
				this.app.metadataCache,
				this.cache,
				this.syncing,
				this.settings.debug,
				this.settings.useDisplayName
			);
		}

		// Check for display name changes
		// Update cache for this file
		this.cache.updateFileRelations(file.path, fm, watchedFields);
		this.cache.updateDisplayName(
			file.basename,
			resolveDisplayName(fm)
		);

		// Re-attach property buttons if this is the active file
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile && activeFile.path === file.path) {
			// Button re-attach no longer needed — using context menu
		}
	}

	/**
	 * Handle new file creation.
	 */
	private onFileCreate(file: TFile): void {
		if (!this.settings.autoSync) return;
		if (!this.layoutReady) return; // Skip initial vault scan on startup

		// Delay to let metadataCache index the new file
		window.setTimeout(() => {
			void this.processNewFile(file);
		}, 800);
	}

	private async processNewFile(file: TFile) {
		const activePairs = this.getActivePairs();
		const watchedFields = RelationCache.getWatchedFields(
			activePairs
		);
		const fm =
			this.app.metadataCache.getFileCache(file)?.frontmatter;

		// Update cache
		this.cache.updateFileRelations(file.path, fm, watchedFields);
		this.cache.updateDisplayName(
			file.basename,
			resolveDisplayName(fm)
		);

		// Find all files that link to this new file and write backlinks
		const newFileName = file.basename;
		const linkingFiles = this.cache.findFilesLinkingTo(
			file,
			this.app.metadataCache
		);

		if (linkingFiles.length > 0) {
			this.syncing.add(file.path);
			try {
				await this.app.vault.process(file, (content) => {
					let result = content;

					for (const { filePath: srcPath, fieldName: srcField } of linkingFiles) {
						const srcFile = this.app.vault.getAbstractFileByPath(srcPath);
						if (!(srcFile instanceof TFile)) continue;
						const counterpart = RelationCache.getCounterpartField(
							srcField, activePairs, srcPath
						);
						if (!counterpart) continue;
						if (!RelationCache.pathMatchesPattern(file.path, counterpart.targetPattern)) continue;

						const yaml = extractYaml(result);
						const existing = readFieldWikilinks(yaml, counterpart.counterpartField);
						const srcBasename = srcFile.basename;

						if (!hasLinkTo(existing, srcBasename)) {
							const srcDisplay = this.settings.useDisplayName ? this.cache.getDisplayName(srcBasename) : null;
							const newLink = buildWikilink(srcBasename, srcDisplay);
							const updated = [...existing, newLink];
							result = updateFieldInContent(result, counterpart.counterpartField, updated);

							if (this.settings.debug) {
								console.log(
									`[YBR] New file ${newFileName}: added ${counterpart.counterpartField}: ${newLink} (from ${srcBasename}.${srcField})`
								);
							}
						}

					}


					return result;
				});

				const updatedFm = this.app.metadataCache.getFileCache(file)?.frontmatter;
				this.cache.updateFileRelations(file.path, updatedFm, watchedFields);
				this.cache.updateDisplayName(file.basename, resolveDisplayName(updatedFm));

				new Notice(t("notice.backlinksCreated", newFileName, String(linkingFiles.length)));
			} finally {
				window.setTimeout(() => this.syncing.delete(file.path), 500);
			}
		}

		// Display name updates removed — Obsidian's native rename handles
		// bare [[filename]] links automatically, and custom aliases like
		// [[filename|custom]] should never be modified by the plugin.

		// Re-attach property buttons for the new file
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile && activeFile.path === file.path) {
			// Button re-attach no longer needed — using context menu
		}
	}
}
