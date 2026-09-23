/**
 * @file preset-search.ts
 * @brief Searchable combobox wrapper for preset select elements.
 */
import { debounce } from '../core/debounce';
import { applyI18n, t } from '../core/i18n/language';

/** Filter debounce wait in milliseconds. */
const FILTER_DELAY = 120;

/** Indexed option for substring search. */
interface SearchIndexEntry {
	/** Option value dispatched on pick. */
	value: string;
	/** Visible option label. */
	label: string;
	/** Normalized label for matching. */
	normal: string;
}

/**
 * @brief Normalize a string for case and diacritic insensitive matching.
 * @param value Raw label or query.
 * @return Normalized string.
 */
const normalize = (value: string): string => {
	return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

/**
 * @brief Build the searchable index from live select options.
 * @param select Source select element.
 * @return Index entries excluding the placeholder option.
 */
const buildIndex = (select: HTMLSelectElement): SearchIndexEntry[] => {
	const out: SearchIndexEntry[] = [];
	for (const option of Array.from(select.options)) {
		if (option.value === '' || option.disabled) {
			continue;
		}
		const label = option.textContent ?? option.value;
		out.push({ value: option.value, label, normal: normalize(label) });
	}
	return out;
};

/** @brief Reposition the fixed listbox at the input's current viewport rect. */
const repositionListbox = (input: HTMLInputElement, listbox: HTMLElement): void => {
	const rect = input.getBoundingClientRect();
	listbox.style.left = `${rect.left}px`;
	listbox.style.top = `${rect.bottom + 4}px`;
	listbox.style.width = `${rect.width}px`;
};

/**
 * @brief Enhance a preset select with a searchable combobox.
 * @param select Native select to wrap, kept for form/change contract.
 * @return void
 */
export const enhancePresetSearch = (select: HTMLSelectElement): void => {
	if (select.parentElement?.classList.contains('preset-search')) {
		return;
	}
	const wrapper = document.createElement('div');
	wrapper.className = 'preset-search relative';
	if (select.classList.contains('hidden')) {
		wrapper.classList.add('hidden');
	}
	if (select.classList.contains('md:block')) {
		wrapper.classList.add('md:block');
	}
	wrapper.classList.add('max-w-[170px]');
	const parent = select.parentElement;
	if (parent) {
		parent.insertBefore(wrapper, select);
	}
	wrapper.appendChild(select);
	select.classList.add('preset-search-native');
	select.setAttribute('tabindex', '-1');
	select.setAttribute('aria-hidden', 'true');
	const input = document.createElement('input');
	input.type = 'text';
	input.className = 'preset-search-input';
	input.setAttribute('role', 'combobox');
	input.setAttribute('aria-expanded', 'false');
	input.setAttribute('aria-autocomplete', 'list');
	input.setAttribute('autocomplete', 'off');
	input.setAttribute('data-i18n-ph', 'header.presetSearch');
	input.placeholder = t('header.presetSearch');
	const listbox = document.createElement('ul');
	listbox.className = 'preset-search-listbox hidden';
	listbox.setAttribute('role', 'listbox');
	wrapper.appendChild(input);
	wrapper.appendChild(listbox);
	wireSearch(select, wrapper, input, listbox);
	applyI18n();
};

/**
 * @brief Wire filtering, keyboard, picking and observers for one combobox.
 * @param select Source select element.
 * @param wrapper Wrapper holding select, input and listbox.
 * @param input Filter text input.
 * @param listbox Results list element.
 * @return void
 */
const wireSearch = (
	select: HTMLSelectElement,
	wrapper: HTMLElement,
	input: HTMLInputElement,
	listbox: HTMLElement,
): void => {
	let index = buildIndex(select);
	let shown: SearchIndexEntry[] = [...index];
	let active = -1;
	/** @brief Reposition open listbox only when visible. */
	const reposition = (): void => {
		if (!listbox.classList.contains('hidden')) {
			repositionListbox(input, listbox);
		}
	};
	const close = (): void => {
		listbox.classList.add('hidden');
		input.setAttribute('aria-expanded', 'false');
		window.removeEventListener('scroll', reposition, true);
		window.removeEventListener('resize', reposition);
		active = -1;
	};
	const open = (): void => {
		if (shown.length === 0) {
			renderEmpty(listbox);
		}
		repositionListbox(input, listbox);
		listbox.classList.remove('hidden');
		input.setAttribute('aria-expanded', 'true');
		window.addEventListener('scroll', reposition, true);
		window.addEventListener('resize', reposition);
	};
	const pick = (entry: SearchIndexEntry): void => {
		select.value = entry.value;
		select.dispatchEvent(new Event('change', { bubbles: true }));
		input.value = entry.label;
		close();
	};
	const render = (): void => {
		listbox.innerHTML = '';
		if (shown.length === 0) {
			renderEmpty(listbox);
			return;
		}
		shown.forEach((entry, pos) => {
			listbox.appendChild(buildItem(entry, pos === active, () => pick(entry)));
		});
	};
	const applyFilter = (): void => {
		const query = normalize(input.value.trim());
		shown = query === '' ? [...index] : index.filter((e) => e.normal.includes(query));
		active = -1;
		render();
		open();
	};
	const debouncedFilter = debounce(applyFilter, FILTER_DELAY);
	bindSearchInput(select, input, listbox, debouncedFilter, applyFilter, open, close, pick, () => shown, (v) => {
		active = v;
	}, () => active, render);
	bindSearchOutside(wrapper, close);
	bindSearchSync(select, input, listbox, () => {
		index = buildIndex(select);
		shown = [...index];
		render();
	});
	render();
};

/**
 * @brief Render the empty-state row when no car matches.
 * @param listbox Results list element.
 * @return void
 */
const renderEmpty = (listbox: HTMLElement): void => {
	const empty = document.createElement('li');
	empty.className = 'preset-search-empty';
	empty.textContent = t('preset.noResults');
	listbox.appendChild(empty);
};

/**
 * @brief Build one listbox row for a catalog entry.
 * @param entry Indexed option.
 * @param isActive True when keyboard-highlighted.
 * @param onPick Pick callback.
 * @return List item element.
 */
const buildItem = (entry: SearchIndexEntry, isActive: boolean, onPick: () => void): HTMLElement => {
	const item = document.createElement('li');
	item.className = `preset-search-item${isActive ? ' is-active' : ''}`;
	item.setAttribute('role', 'option');
	item.dataset.value = entry.value;
	item.textContent = entry.label;
	item.addEventListener('pointerdown', (e) => {
		e.preventDefault();
		onPick();
	});
	return item;
};

/**
 * @brief Bind input typing and keyboard navigation.
 * @param select Source select element.
 * @param input Filter text input.
 * @param listbox Results list element.
 * @param debouncedFilter Debounced filter runner.
 * @param applyFilter Immediate filter runner.
 * @param open Open callback.
 * @param close Close callback.
 * @param pick Pick callback.
 * @param getShown Shown entries accessor.
 * @param setActive Active index setter.
 * @param getActive Active index getter.
 * @param render List render callback.
 * @return void
 */
const bindSearchInput = (
	select: HTMLSelectElement,
	input: HTMLInputElement,
	listbox: HTMLElement,
	debouncedFilter: (() => void) & { cancel: () => void },
	applyFilter: () => void,
	open: () => void,
	close: () => void,
	pick: (entry: SearchIndexEntry) => void,
	getShown: () => SearchIndexEntry[],
	setActive: (v: number) => void,
	getActive: () => number,
	render: () => void,
): void => {
	void select;
	input.addEventListener('input', () => {
		debouncedFilter();
	});
	input.addEventListener('focus', () => {
		applyFilter();
	});
	input.addEventListener('click', () => {
		open();
	});
	input.addEventListener('keydown', (e) => {
		const shown = getShown();
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			stepActive(shown.length, e.key === 'ArrowDown' ? 1 : -1, getActive, setActive, render);
			open();
		} else if (e.key === 'Enter') {
			const current = shown[getActive()];
			if (current) {
				e.preventDefault();
				pick(current);
			}
		} else if (e.key === 'Escape') {
			debouncedFilter.cancel();
			close();
			input.blur();
		}
	});
	void listbox;
};

/**
 * @brief Move keyboard highlight within the shown list.
 * @param count Shown entry count.
 * @param delta Step direction.
 * @param getActive Active index getter.
 * @param setActive Active index setter.
 * @param render List render callback.
 * @return void
 */
const stepActive = (
	count: number,
	delta: number,
	getActive: () => number,
	setActive: (v: number) => void,
	render: () => void,
): void => {
	if (count === 0) {
		return;
	}
	const next = (getActive() + delta + count) % count;
	setActive(next);
	render();
};

/**
 * @brief Close the listbox on outside pointerdown.
 * @param wrapper Combobox wrapper.
 * @param close Close callback.
 * @return void
 */
const bindSearchOutside = (wrapper: HTMLElement, close: () => void): void => {
	document.addEventListener('pointerdown', (e) => {
		if (!wrapper.contains(e.target as Node)) {
			close();
		}
	});
};

/**
 * @brief Keep index and input text in sync with select mutations.
 * @param select Source select element.
 * @param input Filter text input.
 * @param listbox Results list element.
 * @param rebuild Rebuild callback.
 * @return void
 */
const bindSearchSync = (
	select: HTMLSelectElement,
	input: HTMLInputElement,
	listbox: HTMLElement,
	rebuild: () => void,
): void => {
	select.addEventListener('change', () => {
		const selected = Array.from(select.options).find((o) => o.value === select.value);
		if (selected && selected.value !== '') {
			input.value = selected.textContent ?? '';
		}
		void listbox;
	});
	const observer = new MutationObserver(() => {
		rebuild();
	});
	observer.observe(select, { childList: true, subtree: true });
};
