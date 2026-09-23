/**
 * @file base-card.ts
 * @brief Abstract reusable card with mount/unmount lifecycle and DOM helpers.
 */
import type { DictKey } from '../../core/i18n/dictionaries';

/**
 * @brief Create an element with classes and an optional i18n key.
 * @brief Uses textContent-only filling downstream, never innerHTML.
 * @param tag Tag name to create.
 * @param className Space-separated classes, skipped when empty.
 * @param i18nKey Dictionary key applied as data-i18n, when present.
 * @return Prepared element without children.
 */
export const createEl = (tag: string, className?: string, i18nKey?: DictKey): HTMLElement => {
	const node = document.createElement(tag);
	if (className) {
		node.className = className;
	}
	if (i18nKey) {
		node.dataset.i18n = i18nKey;
	}
	return node;
};

/** Base options accepted by every card. */
export interface CardOptions {
	/** Container classes applied by render implementations. */
	containerClass?: string;
	/** Collapsed rendering starts closed; defaults to open. */
	open?: boolean;
}

/**
 * @brief Reusable card contract: props in, DOM out, no side effects.
 * @brief Subclasses implement render; mount/unmount manage attachment.
 */
export abstract class Card<TOptions extends CardOptions = CardOptions> {
	/** Props received at construction, never mutated afterwards. */
	protected readonly options: TOptions;
	/** Currently mounted node, null when detached. */
	protected node: HTMLElement | null = null;

	/**
	 * @brief Receive props for this card instance.
	 * @param options Card props.
	 * @return void
	 */
	constructor(options: TOptions) {
		this.options = options;
	}

	/**
	 * @brief Build a fresh DOM node for current props.
	 * @return Detached element ready to mount.
	 */
	abstract render(): HTMLElement;

	/**
	 * @brief Attach a fresh render into a host element.
	 * @param host Parent receiving the card node.
	 * @return void
	 */
	mount(host: HTMLElement): void {
		this.unmount();
		this.node = this.render();
		host.appendChild(this.node);
	}

	/**
	 * @brief Detach the card node without touching siblings.
	 * @return void
	 */
	unmount(): void {
		if (this.node) {
			this.node.remove();
			this.node = null;
		}
	}

	/**
	 * @brief Tear down the card and release its node.
	 * @return void
	 */
	destroy(): void {
		this.unmount();
	}

	/**
	 * @brief Read the mounted node, if any.
	 * @return Mounted element or null when detached.
	 */
	get element(): HTMLElement | null {
		return this.node;
	}

	/**
	 * @brief Check whether the card renders in open state.
	 * @return False only when constructed with open set to false.
	 */
	isOpen(): boolean {
		return this.options.open !== false;
	}

	/**
	 * @brief Toggle open styling on collapsible descendants.
	 * @brief No-op until mounted; collaborates with the accordion binder.
	 * @param open Target open state.
	 * @return void
	 */
	setOpen(open: boolean): void {
		if (!this.node) {
			return;
		}
		this.node.querySelectorAll('[data-accordion-content], [data-chevron]').forEach((part) => {
			part.classList.toggle('open', open);
		});
	}
}
