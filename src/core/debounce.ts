/**
 * @file debounce.ts
 * @brief Typed trailing-edge debounce utility.
 */

/**
 * Wrap a function so it only runs after `delay` ms of inactivity.
 * @brief Standard trailing debounce with an explicit cancel handle.
 * @param fn Function to debounce.
 * @param delay Wait window in milliseconds.
 * @returns Debounced callable plus a cancel method.
 */
export const debounce = <T extends (...args: never[]) => void>(
	fn: T,
	delay: number,
): ((...args: Parameters<T>) => void) & { cancel: () => void } => {
	let timer: number | null = null;
	const debounced = (...args: Parameters<T>): void => {
		if (timer !== null) {
			window.clearTimeout(timer);
		}
		timer = window.setTimeout(() => {
			timer = null;
			fn(...args);
		}, delay);
	};
	debounced.cancel = (): void => {
		if (timer !== null) {
			window.clearTimeout(timer);
			timer = null;
		}
	};
	return debounced;
};