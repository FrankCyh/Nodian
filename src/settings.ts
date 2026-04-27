import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type YBRPlugin from "./main";
import { fullSync } from "./sync";
import { t } from "./i18n";

function collectExistingTags(app: App): string[] {
	const tagSet = new Set<string>();
	const files = app.vault.getMarkdownFiles();
	for (const file of files) {
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		if (!fm) continue;
		const raw = fm.tags;
		if (typeof raw === "string") tagSet.add(raw);
		else if (Array.isArray(raw)) {
			for (const tag of raw) {
				if (typeof tag === "string") tagSet.add(tag);
			}
		}
	}
	return Array.from(tagSet).sort();
}

function collectExistingFields(app: App): string[] {
	const SYSTEM = new Set(["title","aliases","tags","cssclasses","publish","permalink","description","image","cover","banner","date","created","updated","modified","position"]);
	const fieldSet = new Set<string>();
	const files = app.vault.getMarkdownFiles();
	for (const file of files) {
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		if (!fm) continue;
		for (const key of Object.keys(fm)) {
			if (!SYSTEM.has(key) && key !== "position") fieldSet.add(key);
		}
	}
	return Array.from(fieldSet).sort();
}

export class YBRSettingTab extends PluginSettingTab {
	plugin: YBRPlugin;

	constructor(app: App, plugin: YBRPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// --- Full Sync Button ---
		new Setting(containerEl)
			.setName(t("settings.fullSync"))
			.setDesc(t("settings.fullSync.desc"))
			.addButton((btn) =>
				btn
					.setButtonText(t("settings.fullSync.button"))
					.onClick(async () => {
						btn.setDisabled(true);
						btn.setButtonText("...");
						const count = await fullSync(
							this.app.vault,
							this.app.metadataCache,
							this.plugin.cache,
							this.plugin.getActivePairs(),
							this.plugin.syncing,
							this.plugin.settings.debug,
							this.plugin.settings.useDisplayName
						);
						new Notice(t("notice.syncComplete", String(count)));
						btn.setDisabled(false);
						btn.setButtonText(t("settings.fullSync.button"));
					})
			);

		// --- Toggles ---
		new Setting(containerEl)
			.setName(t("settings.autoSync"))
			.setDesc(t("settings.autoSync.desc"))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoSync).onChange(async (value) => {
					this.plugin.settings.autoSync = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName(t("settings.useDisplayName"))
			.setDesc(t("settings.useDisplayName.desc"))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.useDisplayName).onChange(async (value) => {
					this.plugin.settings.useDisplayName = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName(t("settings.debug"))
			.setDesc(t("settings.debug.desc"))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.debug).onChange(async (value) => {
					this.plugin.settings.debug = value;
					await this.plugin.saveSettings();
				})
			);

		// --- Relation Pairs ---
		containerEl.createEl("h3", { text: t("settings.relationPairs") });

		// Datalists for autocomplete
		const tags = collectExistingTags(this.app);
		const fields = collectExistingFields(this.app);

		const tagListId = "ybr-datalist-tags";
		const fieldListId = "ybr-datalist-fields";

		let tagList = containerEl.querySelector(`#${tagListId}`) as HTMLDataListElement;
		if (!tagList) {
			tagList = containerEl.createEl("datalist", { attr: { id: tagListId } });
			for (const tag of tags) {
				tagList.createEl("option", { attr: { value: tag } });
			}
		}

		let fieldList = containerEl.querySelector(`#${fieldListId}`) as HTMLDataListElement;
		if (!fieldList) {
			fieldList = containerEl.createEl("datalist", { attr: { id: fieldListId } });
			for (const field of fields) {
				fieldList.createEl("option", { attr: { value: field } });
			}
		}

		// Column headers
		const headerRow = containerEl.createDiv({ cls: "ybr-settings-pair-row ybr-settings-header" });
		headerRow.createEl("span", { cls: "ybr-settings-header-tag", text: "Tag" });
		headerRow.createEl("span", { cls: "ybr-settings-header-field", text: "Field" });
		headerRow.createEl("span", { cls: "ybr-settings-arrow", text: "" });
		headerRow.createEl("span", { cls: "ybr-settings-header-field", text: "Field" });
		headerRow.createEl("span", { cls: "ybr-settings-header-tag", text: "Tag" });
		headerRow.createEl("span", { cls: "ybr-settings-header-delete", text: "" });

		const pairsContainer = containerEl.createDiv();

		const renderPairs = () => {
			pairsContainer.empty();

			this.plugin.settings.pairs.forEach((pair, index) => {
				const row = pairsContainer.createDiv({ cls: "ybr-settings-pair-row" });

				const tagAInput = row.createEl("input", {
					cls: "ybr-settings-input ybr-settings-tag",
					attr: { type: "text", placeholder: "Tag", value: pair.tagA || "", list: tagListId },
				});
				if (!pair.tagA) tagAInput.style.borderColor = "var(--text-error)";
				tagAInput.addEventListener("change", async () => {
					this.plugin.settings.pairs[index].tagA = tagAInput.value.trim();
					tagAInput.style.borderColor = tagAInput.value.trim() ? "" : "var(--text-error)";
					await this.plugin.saveSettings();
					this.plugin.rebuildCache();
				});

				const fieldAInput = row.createEl("input", {
					cls: "ybr-settings-input ybr-settings-field",
					attr: { type: "text", placeholder: "Field", value: pair.fieldA || "", list: fieldListId },
				});
				fieldAInput.addEventListener("change", async () => {
					this.plugin.settings.pairs[index].fieldA = fieldAInput.value.trim();
					await this.plugin.saveSettings();
					this.plugin.rebuildCache();
				});

				row.createEl("span", { cls: "ybr-settings-arrow", text: "↔" });

				const fieldBInput = row.createEl("input", {
					cls: "ybr-settings-input ybr-settings-field",
					attr: { type: "text", placeholder: "Field", value: pair.fieldB || "", list: fieldListId },
				});
				fieldBInput.addEventListener("change", async () => {
					this.plugin.settings.pairs[index].fieldB = fieldBInput.value.trim();
					await this.plugin.saveSettings();
					this.plugin.rebuildCache();
				});

				const tagBInput = row.createEl("input", {
					cls: "ybr-settings-input ybr-settings-tag",
					attr: { type: "text", placeholder: "Tag", value: pair.tagB || "", list: tagListId },
				});
				if (!pair.tagB) tagBInput.style.borderColor = "var(--text-error)";
				tagBInput.addEventListener("change", async () => {
					this.plugin.settings.pairs[index].tagB = tagBInput.value.trim();
					tagBInput.style.borderColor = tagBInput.value.trim() ? "" : "var(--text-error)";
					await this.plugin.saveSettings();
					this.plugin.rebuildCache();
				});

				const deleteBtn = row.createEl("button", { cls: "ybr-settings-delete", text: "×" });
				deleteBtn.setAttribute("aria-label", t("settings.deletePair"));
				deleteBtn.addEventListener("click", async () => {
					this.plugin.settings.pairs.splice(index, 1);
					await this.plugin.saveSettings();
					this.plugin.rebuildCache();
					renderPairs();
				});
			});

			const addRow = pairsContainer.createDiv({ cls: "ybr-settings-add-row" });
			const addBtn = addRow.createEl("button", { cls: "mod-cta", text: t("settings.addPair") });
			addBtn.addEventListener("click", async () => {
				this.plugin.settings.pairs.push({ fieldA: "", fieldB: "", tagA: "", tagB: "" });
				await this.plugin.saveSettings();
				renderPairs();
			});
		};

		renderPairs();
	}
}
