import { MarkdownView, Menu, Notice, Plugin, TFile } from "obsidian";
import { DEFAULT_SETTINGS, PluginSettings, RelationPair, isCompletePair } from "./types";
import { RelationCache } from "./cache";
import { YBRSettingTab } from "./settings";
import { detectChanges, applyChanges, fullSync } from "./sync";
import { resolveDisplayName } from "./display-name";
import { buildWikilink, extractTargets, hasLinkTo } from "./wikilink-utils";
import { readFieldWikilinks, splitFrontmatter, updateFieldInContent } from "./yaml-utils";
import { showPairSuggestModal } from "./pair-suggest-modal";
import { t } from "./i18n";
import MenuManager from "./menu-manager";

function extractYaml(content: string): string {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	return match ? match[1] : "";
}

export default class YBRPlugin extends Plugin {
	settings: PluginSettings = DEFAULT_SETTINGS;
	cache: RelationCache = new RelationCache();
	syncing: Set<string> = new Set();
	private debounceTimers: Map<string, ReturnType<typeof setTimeout>> =
		new Map();
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
			setTimeout(() => {
				this.layoutReady = true;
				if (this.settings.debug) {
					console.log("[YBR] Layout ready, accepting file events");
				}
			}, 2000);
		});

		// Hook into Obsidian's property icon click — queues our menu items
		// that will be added to the native property menu when it shows.
		this.registerDomEvent(document, "click", (evt) => {
			const target = evt.target as HTMLElement;
			if (!target) return;
			if (target.closest(".metadata-property-icon")) {
				this.queuePropertyMenuItems(target);
			}
		}, true);
		this.registerDomEvent(document, "contextmenu", (evt) => {
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
		// Clear all debounce timers
		for (const timer of this.debounceTimers.values()) {
			clearTimeout(timer);
		}
		this.debounceTimers.clear();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		// Migrate old pairs without tagA/tagB
		let migrated = false;
		for (const pair of this.settings.pairs) {
			if ((pair as any).tagA === undefined) {
				(pair as any).tagA = pair.fieldB;
				migrated = true;
			}
			if ((pair as any).tagB === undefined) {
				(pair as any).tagB = pair.fieldA;
				migrated = true;
			}
		}
		if ((this.settings as any).autoUpdateDisplayName !== undefined) {
			delete (this.settings as any).autoUpdateDisplayName;
			migrated = true;
		}
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
	 * The MenuManager's Proxy on Menu.showAtPosition will add it when
	 * the native menu is about to open.
	 */
	private queuePropertyMenuItems(target: HTMLElement) {
		const propEl = target.closest(".metadata-property") as HTMLElement | null;
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
					this.onPropertyButtonClick(caseCorrectFieldName);
				})
		);
	}

	/**
	 * Get the counterpart field name for display purposes.
	 */
	private getPairCounterparts(fieldName: string): string[] {
		const counterparts: string[] = [];
		for (const pair of this.settings.pairs) {
			if (pair.fieldA === fieldName) counterparts.push(pair.fieldB);
			else if (pair.fieldB === fieldName) counterparts.push(pair.fieldA);
		}
		return counterparts;
	}

	/**
	 * Handle click on a property relation button.
	 */
	private async onPropertyButtonClick(fieldName: string) {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) return;

		// Get current file's tags for highlighting active pair
		const currentFm = this.app.metadataCache.getFileCache(activeFile)?.frontmatter;
		const currentTags: string[] = (() => {
			if (!currentFm) return [];
			const raw = currentFm.tags;
			if (typeof raw === "string") return [raw];
			if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
			return [];
		})();

		// Get current page's field names to filter relevant pairs
		const pageFields = currentFm ? Object.keys(currentFm).filter(
			(k) => !YBRPlugin.SYSTEM_FIELDS.has(k) && k !== "position"
		) : [];

		const activePairs = this.getActivePairs();
		const result = await showPairSuggestModal(
			this.app,
			fieldName,
			activeFile.basename,
			activePairs,
			currentTags,
			pageFields
		);

		if (result.action === "save" && result.counterpartField) {
			const counterpartField = result.counterpartField;

			// If modal returned a sourceTag (user entered tag for untagged page), write it to frontmatter
			if (result.sourceTag) {
				this.syncing.add(activeFile.path);
				try {
					await this.app.vault.process(activeFile, (content) => {
						const split = splitFrontmatter(content);
						if (split) {
							const hasTagsField = split.yaml.split("\n").some(
								(line) => line.startsWith("tags:") || line.startsWith("tags :")
							);
							if (!hasTagsField) {
								return content.replace(
									/^(---\n)/,
									`---\ntags:\n  - ${result.sourceTag}\n`
								);
							}
						}
						return content;
					});
				} finally {
					setTimeout(() => this.syncing.delete(activeFile.path), 500);
				}
				// Update currentTags for pair creation below
				currentTags.push(result.sourceTag);
			}

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
					tagA: currentTags[0] || "",
					tagB: result.counterpartTag || counterpartField,
				});
				await this.saveSettings();
			}

			new Notice(t("notice.pairCreated", fieldName, counterpartField));

			// Sync backlinks immediately
			const fm = this.app.metadataCache.getFileCache(activeFile)?.frontmatter;
			if (fm) {
				const targets = extractTargets(fm[fieldName]);
				const sourceDisplay = this.settings.useDisplayName ? this.cache.getDisplayName(activeFile.basename) : null;

				for (const targetName of targets) {
					const targetFile = this.app.metadataCache.getFirstLinkpathDest(targetName, activeFile.path);
					if (!targetFile) {
						new Notice(t("notice.fileNotFound", targetName));
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
						setTimeout(() => this.syncing.delete(targetFile.path), 500);
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
		if (existing) clearTimeout(existing);

		const timer = setTimeout(() => {
			this.debounceTimers.delete(file.path);
			this.onFileModify(file);
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
	private async onFileCreate(file: TFile) {
		if (!this.settings.autoSync) return;
		if (!this.layoutReady) return; // Skip initial vault scan on startup

		// Delay to let metadataCache index the new file
		setTimeout(async () => {
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
					let autoTag: string | null = null;

					await this.app.vault.process(file, (content) => {
						let result = content;

						for (const { filePath: srcPath, fieldName: srcField } of linkingFiles) {
							const srcFile = this.app.vault.getAbstractFileByPath(srcPath);
							if (!(srcFile instanceof TFile)) continue;
							const srcFm = this.app.metadataCache.getFileCache(srcFile)?.frontmatter;
							const srcTags: string[] = (() => {
								if (!srcFm) return [];
								const raw = srcFm.tags;
								if (typeof raw === "string") return [raw];
								if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
								return [];
							})();

							const counterpart = RelationCache.getCounterpartField(
								srcField, activePairs, srcTags
							);
							if (!counterpart) continue;

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

							if (!autoTag) {
								// Use the pair's target tag instead of the source field name
								autoTag = counterpart.pair.fieldA === srcField
									? counterpart.pair.tagB
									: counterpart.pair.tagA;
							}
						}

						if (autoTag) {
							const split = splitFrontmatter(result);
							if (split) {
								const hasTagsField = split.yaml.split("\n").some(
									(line) => line.startsWith("tags:")
								);
								if (!hasTagsField) {
									result = result.replace(
										/^(---\n)/,
										`---\ntags:\n  - ${autoTag}\n`
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
					setTimeout(() => this.syncing.delete(file.path), 500);
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
		}, 800);
	}
}
