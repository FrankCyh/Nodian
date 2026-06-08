import { App, ButtonComponent, Notice, PluginSettingTab, Setting } from "obsidian";
import type YBRPlugin from "./main";
import { isValidRegexPattern } from "./types";
import { fullSync } from "./sync";
import { t } from "./i18n";
import { getFrontmatterKeys } from "./frontmatter-utils";

const SYSTEM_FIELDS = new Set([
	"title",
	"aliases",
	"tags",
	"cssclasses",
	"publish",
	"permalink",
	"description",
	"image",
	"cover",
	"banner",
	"date",
	"created",
	"updated",
	"modified",
	"position",
]);

function collectExistingFields(app: App): string[] {
	const fieldSet = new Set<string>();
	const files = app.vault.getMarkdownFiles();
	for (const file of files) {
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		for (const key of getFrontmatterKeys(fm)) {
			if (!SYSTEM_FIELDS.has(key.toLowerCase())) fieldSet.add(key);
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

		new Setting(containerEl)
			.setName(t("settings.fullSync"))
			.setDesc(t("settings.fullSync.desc"))
			.addButton((btn) =>
				btn
					.setButtonText(t("settings.fullSync.button"))
					.onClick(() => {
						void this.runFullSync(btn);
					})
			);

		new Setting(containerEl)
			.setName(t("settings.autoSync"))
			.setDesc(t("settings.autoSync.desc"))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoSync).onChange((value) => {
					this.plugin.settings.autoSync = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName(t("settings.useDisplayName"))
			.setDesc(t("settings.useDisplayName.desc"))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.useDisplayName).onChange((value) => {
					this.plugin.settings.useDisplayName = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName(t("settings.debug"))
			.setDesc(t("settings.debug.desc"))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.debug).onChange((value) => {
					this.plugin.settings.debug = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl).setName(t("settings.relationPairs")).setHeading();

		const fields = collectExistingFields(this.app);
		const fieldListId = "ybr-datalist-fields";

		const fieldList = containerEl.createEl("datalist", { attr: { id: fieldListId } });
		for (const field of fields) {
			fieldList.createEl("option", { attr: { value: field } });
		}

		const headerRow = containerEl.createDiv({ cls: "ybr-settings-pair-row ybr-settings-header" });
		headerRow.createEl("span", { cls: "ybr-settings-header-tag", text: t("settings.patternA") });
		headerRow.createEl("span", { cls: "ybr-settings-header-field", text: "Field" });
		headerRow.createEl("span", { cls: "ybr-settings-arrow", text: "" });
		headerRow.createEl("span", { cls: "ybr-settings-header-field", text: "Field" });
		headerRow.createEl("span", { cls: "ybr-settings-header-tag", text: t("settings.patternB") });
		headerRow.createEl("span", { cls: "ybr-settings-header-delete", text: "" });

		const pairsContainer = containerEl.createDiv();
		const renderPairs = () => {
			pairsContainer.empty();

			this.plugin.settings.pairs.forEach((pair, index) => {
				const row = pairsContainer.createDiv({ cls: "ybr-settings-pair-row" });

				const patternAInput = row.createEl("input", {
					cls: "ybr-settings-input ybr-settings-tag",
					attr: { type: "text", placeholder: "project/.*\\.md", value: pair.patternA || "" },
				});
				patternAInput.classList.toggle("is-invalid", !isValidRegexPattern(pair.patternA || ""));
				patternAInput.addEventListener("change", () => {
					this.plugin.settings.pairs[index].patternA = patternAInput.value.trim();
					patternAInput.classList.toggle("is-invalid", !isValidRegexPattern(patternAInput.value.trim()));
					void this.saveSettingsAndRebuild();
				});

				const fieldAInput = row.createEl("input", {
					cls: "ybr-settings-input ybr-settings-field",
					attr: { type: "text", placeholder: "Field", value: pair.fieldA || "", list: fieldListId },
				});
				fieldAInput.addEventListener("change", () => {
					this.plugin.settings.pairs[index].fieldA = fieldAInput.value.trim();
					void this.saveSettingsAndRebuild();
				});

				row.createEl("span", { cls: "ybr-settings-arrow", text: "↔" });

				const fieldBInput = row.createEl("input", {
					cls: "ybr-settings-input ybr-settings-field",
					attr: { type: "text", placeholder: "Field", value: pair.fieldB || "", list: fieldListId },
				});
				fieldBInput.addEventListener("change", () => {
					this.plugin.settings.pairs[index].fieldB = fieldBInput.value.trim();
					void this.saveSettingsAndRebuild();
				});

				const patternBInput = row.createEl("input", {
					cls: "ybr-settings-input ybr-settings-tag",
					attr: { type: "text", placeholder: "task/.*\\.md", value: pair.patternB || "" },
				});
				patternBInput.classList.toggle("is-invalid", !isValidRegexPattern(pair.patternB || ""));
				patternBInput.addEventListener("change", () => {
					this.plugin.settings.pairs[index].patternB = patternBInput.value.trim();
					patternBInput.classList.toggle("is-invalid", !isValidRegexPattern(patternBInput.value.trim()));
					void this.saveSettingsAndRebuild();
				});

				const deleteBtn = row.createEl("button", { cls: "ybr-settings-delete", text: "×" });
				deleteBtn.setAttribute("aria-label", t("settings.deletePair"));
				deleteBtn.addEventListener("click", () => {
					this.plugin.settings.pairs.splice(index, 1);
					void this.saveSettingsAndRebuild(renderPairs);
				});
			});

			const addRow = pairsContainer.createDiv({ cls: "ybr-settings-add-row" });
			const addBtn = addRow.createEl("button", { cls: "mod-cta", text: t("settings.addPair") });
			addBtn.addEventListener("click", () => {
				this.plugin.settings.pairs.push({ fieldA: "", fieldB: "", patternA: "", patternB: "" });
				void this.saveSettings(renderPairs);
			});
		};

		renderPairs();
	}

	private async runFullSync(btn: ButtonComponent): Promise<void> {
		btn.setDisabled(true);
		btn.setButtonText("...");
		try {
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
		} finally {
			btn.setDisabled(false);
			btn.setButtonText(t("settings.fullSync.button"));
		}
	}

	private async saveSettingsAndRebuild(afterSave?: () => void): Promise<void> {
		await this.plugin.saveSettings();
		this.plugin.rebuildCache();
		afterSave?.();
	}

	private async saveSettings(afterSave?: () => void): Promise<void> {
		await this.plugin.saveSettings();
		afterSave?.();
	}
}
