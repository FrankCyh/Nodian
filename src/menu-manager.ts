// Adapted from Iconic / Pretty Properties plugins
// https://github.com/gfxholo/iconic
// https://github.com/anareaty/pretty-properties

import { Menu, MenuItem } from "obsidian";

/**
 * Intercepts context menus via a Proxy on Menu.prototype.showAtPosition
 * to add custom items to native Obsidian menus (e.g. property menu).
 */
export default class MenuManager {
	private menu: Menu | null = null;
	private queuedActions: Array<() => void> = [];

	constructor() {
		const manager = this;
		Menu.prototype.showAtPosition = new Proxy(Menu.prototype.showAtPosition, {
			apply(showAtPosition, menu, args) {
				manager.menu = menu as Menu;
				if (manager.queuedActions.length > 0) {
					manager.runQueuedActions();
				}
				return showAtPosition.apply(menu, args as any);
			},
		});
	}

	private runQueuedActions(): void {
		const actions = this.queuedActions;
		this.queuedActions = [];
		for (const action of actions) action();
	}

	addItem(callback: (item: MenuItem) => void): this {
		if (this.menu) {
			this.menu.addItem(callback);
		} else {
			this.queuedActions.push(() => this.addItem(callback));
		}
		return this;
	}

	flush(): void {
		this.queuedActions.length = 0;
	}

	closeAndFlush(): void {
		this.menu?.close();
		this.menu = null;
		this.flush();
	}
}
