import { App, Modal, Setting } from "obsidian";
import { RelationPair } from "./types";
import { RelationCache } from "./cache";
import { t } from "./i18n";

export interface PairSuggestResult {
	action: "save" | "ignore" | "remove";
	counterpartField?: string;
	counterpartTag?: string;
	sourceTag?: string;
}

const SYSTEM_FIELDS = new Set([
	"title", "aliases", "tags", "cssclasses", "publish",
	"permalink", "description", "image", "cover", "banner",
	"date", "created", "updated", "modified", "position",
]);

function collectExistingFields(app: App, excludeField: string): string[] {
	const fieldSet = new Set<string>();
	const files = app.vault.getMarkdownFiles();
	for (const file of files) {
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		if (!fm) continue;
		for (const key of Object.keys(fm)) {
			if (SYSTEM_FIELDS.has(key)) continue;
			if (key === excludeField) continue;
			if (key === "position") continue;
			fieldSet.add(key);
		}
	}
	return Array.from(fieldSet).sort();
}

function collectExistingTags(app: App): string[] {
	const tagSet = new Set<string>();
	const files = app.vault.getMarkdownFiles();
	for (const file of files) {
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		if (!fm) continue;
		const raw = fm.tags;
		if (typeof raw === "string") {
			tagSet.add(raw);
		} else if (Array.isArray(raw)) {
			for (const tag of raw) {
				if (typeof tag === "string") tagSet.add(tag);
			}
		}
	}
	return Array.from(tagSet).sort();
}

export class PairSuggestModal extends Modal {
	private fieldName: string;
	private fileName: string;
	private existingPairs: RelationPair[];
	private sourceTags: string[];
	private pageFields: string[];
	private resolve: (result: PairSuggestResult) => void;
	private counterpartValue: string;
	private counterpartTagValue: string;
	private sourceTagValue: string;
	private cleanupFns: Array<() => void> = [];

	constructor(
		app: App,
		fieldName: string,
		fileName: string,
		existingPairs: RelationPair[],
		sourceTags: string[],
		pageFields: string[],
		resolve: (result: PairSuggestResult) => void
	) {
		super(app);
		this.fieldName = fieldName;
		this.fileName = fileName;
		this.existingPairs = existingPairs;
		this.sourceTags = sourceTags;
		this.pageFields = pageFields;
		this.resolve = resolve;
		this.counterpartValue = fieldName;
		this.counterpartTagValue = "";
		this.sourceTagValue = sourceTags[0] || "";
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("ybr-modal");

		// Title
		contentEl.createEl("h3", {
			text: t("modal.editTitle"),
			attr: { style: "text-align: center; margin-bottom: 16px;" },
		});

		const fieldPairs = this.existingPairs.filter(
			(p) => p.fieldA === this.fieldName || p.fieldB === this.fieldName
		);

		// Find active pair
		const activeResult = RelationCache.getCounterpartField(
			this.fieldName, this.existingPairs, this.sourceTags
		);
		const activePair = activeResult?.pair ?? null;

		// ─── Existing pairs section ───
		if (fieldPairs.length > 0) {
			contentEl.createEl("p", {
				text: t("modal.existingPairs"),
				attr: { style: "font-weight: 600; font-size: 0.9em; margin-bottom: 8px; color: var(--text-muted);" },
			});

			for (const pair of fieldPairs) {
				const isActive = activePair === pair;
				const row = contentEl.createDiv({ cls: "ybr-pair-row" + (isActive ? " is-active" : "") });

				// [tagA] fieldA ↔ fieldB [tagB]
				const left = row.createDiv({ cls: "ybr-pair-content" });

				left.createEl("span", { cls: "ybr-tag-badge", text: pair.tagA || "—" });
				left.createEl("span", {
					cls: "ybr-field-name" + (isActive && pair.fieldA === this.fieldName ? " is-active" : ""),
					text: ` ${pair.fieldA} `,
				});
				left.createEl("span", { cls: "ybr-arrow", text: "↔" });
				left.createEl("span", {
					cls: "ybr-field-name" + (isActive && pair.fieldB === this.fieldName ? " is-active" : ""),
					text: ` ${pair.fieldB} `,
				});
				left.createEl("span", { cls: "ybr-tag-badge", text: pair.tagB || "—" });

				if (isActive) {
					left.createEl("span", { cls: "ybr-active-badge", text: t("modal.active") });
				}

				// Delete button
				const counterpart = pair.fieldA === this.fieldName ? pair.fieldB : pair.fieldA;
				const deleteBtn = row.createEl("button", { cls: "ybr-delete-btn", text: "×" });
				deleteBtn.addEventListener("click", () => {
					this.resolve({ action: "remove", counterpartField: counterpart });
					this.close();
				});
			}
		}

		// No-pair warning
		if (!activePair && this.sourceTags.length > 0) {
			contentEl.createEl("p", {
				text: t("modal.noPairForTag", this.sourceTags.join(", ")),
				attr: { style: "color: var(--color-red); font-size: 0.85em; margin: 8px 0;" },
			});
		}

		// ─── Add new pair section ───
		contentEl.createEl("hr");
		contentEl.createEl("p", {
			text: t("modal.addAnother"),
			attr: { style: "font-weight: 600; font-size: 0.9em; margin-bottom: 8px; color: var(--text-muted);" },
		});

		this.renderAddForm(contentEl);
	}

	private renderAddForm(contentEl: HTMLElement) {
		const existingFields = collectExistingFields(this.app, this.fieldName);
		const existingTags = collectExistingTags(this.app);
		const currentTag = this.sourceTags[0] || "";

		// ─── Row 1: [currentTag] currentField ↔ [field select] [tag select] ───
		const addRow = contentEl.createDiv({ cls: "ybr-add-row" });

		// Left side (fixed): [tag] field ↔
		const leftSide = addRow.createDiv({ cls: "ybr-add-left" });
		if (currentTag) {
			leftSide.createEl("span", { cls: "ybr-tag-badge ybr-active-tag", text: currentTag });
		}
		leftSide.createEl("span", {
			cls: "ybr-field-name is-active",
			text: ` ${this.fieldName} `,
		});
		leftSide.createEl("span", { cls: "ybr-arrow", text: "↔" });

		// Right side: combo dropdowns
		const rightSide = addRow.createDiv({ cls: "ybr-add-right" });

		// Target field combo
		const fieldCol = rightSide.createDiv({ cls: "ybr-add-col" });
		this.createCombo(fieldCol, existingFields, t("modal.counterpartTag.field"), (val) => {
			this.counterpartValue = val;
		});
		fieldCol.createEl("span", { cls: "ybr-select-label", text: t("modal.counterpartTag.field") });

		// Target tag combo
		const tagCol = rightSide.createDiv({ cls: "ybr-add-col" });
		this.createCombo(tagCol, existingTags, t("modal.counterpartTag"), (val) => {
			this.counterpartTagValue = val;
		});
		tagCol.createEl("span", { cls: "ybr-select-label", text: t("modal.counterpartTag") });

		// ─── Source tag input (if page has no tag) ───
		if (this.sourceTags.length === 0) {
			contentEl.createEl("hr");
			contentEl.createEl("p", {
				text: t("modal.sourceTag.required"),
				attr: { style: "color: var(--color-red); font-size: 0.85em;" },
			});
			const sourceTagRow = contentEl.createDiv({ cls: "ybr-add-row" });
			sourceTagRow.createEl("span", {
				cls: "ybr-add-label",
				text: t("modal.sourceTag"),
			});
			const sourceCol = sourceTagRow.createDiv({ cls: "ybr-add-col" });
			this.createCombo(sourceCol, existingTags, t("modal.counterpartTag.placeholder"), (val) => {
				this.sourceTagValue = val;
			});
		}

		// ─── Buttons ───
		contentEl.createEl("hr");
		const btnRow = contentEl.createDiv({ cls: "ybr-btn-row" });
		const saveBtn = btnRow.createEl("button", { cls: "mod-cta", text: t("modal.save") });
		saveBtn.addEventListener("click", () => {
			if (!this.counterpartValue) return;
			if (!this.counterpartTagValue) return;
			if (this.sourceTags.length === 0 && !this.sourceTagValue) return;
			this.resolve({
				action: "save",
				counterpartField: this.counterpartValue,
				counterpartTag: this.counterpartTagValue,
				sourceTag: this.sourceTagValue || undefined,
			});
			this.close();
		});
		const closeBtn = btnRow.createEl("button", { text: t("modal.close") });
		closeBtn.addEventListener("click", () => {
			this.resolve({ action: "ignore" });
			this.close();
		});
	}

	/**
	 * Create a combo box (input + dropdown) inside a container.
	 */
	private createCombo(
		container: HTMLElement,
		options: string[],
		placeholder: string,
		onChange: (value: string) => void
	) {
		const combo = container.createDiv({ cls: "ybr-combo" });
		const input = combo.createEl("input", {
			cls: "ybr-combo-input",
			attr: { type: "text", placeholder },
		});
		// Arrow icon
		const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		arrow.setAttribute("class", "ybr-combo-arrow");
		arrow.setAttribute("viewBox", "0 0 12 12");
		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
		path.setAttribute("d", "M3 5l3 3 3-3");
		path.setAttribute("fill", "none");
		path.setAttribute("stroke", "currentColor");
		path.setAttribute("stroke-width", "1.5");
		arrow.appendChild(path);
		combo.appendChild(arrow);

		const dropdown = combo.createDiv({ cls: "ybr-combo-dropdown" });
		const optEls: HTMLElement[] = [];
		for (const opt of options) {
			const el = dropdown.createDiv({ cls: "ybr-combo-option", attr: { "data-value": opt } });
			el.textContent = opt;
			optEls.push(el);
		}

		const filterOptions = (query: string) => {
			const q = query.toLowerCase();
			for (const el of optEls) {
				el.style.display = (el.dataset.value || "").toLowerCase().includes(q) ? "" : "none";
			}
		};

		combo.addEventListener("mousedown", (e: MouseEvent) => {
			if ((e.target as HTMLElement).closest(".ybr-combo-option")) return;
			e.preventDefault();
			input.focus();
			if (dropdown.style.display === "block") {
				dropdown.style.display = "none";
			} else {
				dropdown.style.display = "block";
				filterOptions(input.value);
			}
		});

		input.addEventListener("input", () => {
			dropdown.style.display = "block";
			filterOptions(input.value);
			onChange(input.value.trim());
		});

		for (const el of optEls) {
			el.addEventListener("mousedown", (e: MouseEvent) => {
				e.preventDefault();
				e.stopPropagation();
				input.value = el.dataset.value || "";
				dropdown.style.display = "none";
				onChange(input.value);
			});
		}

		const onDocMousedown = (e: MouseEvent) => {
			if (!combo.contains(e.target as Node)) {
				dropdown.style.display = "none";
			}
		};
		document.addEventListener("mousedown", onDocMousedown);
		this.cleanupFns.push(() => document.removeEventListener("mousedown", onDocMousedown));
	}

	onClose() {
		for (const fn of this.cleanupFns) fn();
		this.cleanupFns = [];
		this.contentEl.empty();
		this.resolve({ action: "ignore" });
	}
}

export function showPairSuggestModal(
	app: App,
	fieldName: string,
	fileName: string,
	existingPairs: RelationPair[],
	sourceTags: string[] = [],
	pageFields: string[] = []
): Promise<PairSuggestResult> {
	return new Promise((resolve) => {
		let resolved = false;
		const wrappedResolve = (result: PairSuggestResult) => {
			if (!resolved) {
				resolved = true;
				resolve(result);
			}
		};
		new PairSuggestModal(app, fieldName, fileName, existingPairs, sourceTags, pageFields, wrappedResolve).open();
	});
}
