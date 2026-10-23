/**
 * @file wake-lock.ts
 * @brief Keep-screen-awake toggle for track-side phone mounts.
 * @brief Wraps navigator.wakeLock with a capability probe so unsupported
 * @brief browsers (and the vitest node environment) degrade to a silent
 * @brief no-op instead of throwing.
 */

/** Opaque wake-lock sentinel handle. */
type WakeSentinel = { release: () => Promise<void> };

/** Active sentinel, null when no lock is held. */
let sentinel: WakeSentinel | null = null;

/**
 * @brief Check whether the Wake Lock API is available.
 * @return True when navigator.wakeLock.request exists.
 */
export const isWakeLockSupported = (): boolean => {
	try {
		return typeof navigator !== 'undefined' &&
			typeof (navigator as unknown as { wakeLock?: unknown }).wakeLock === 'object';
	} catch {
		return false;
	}
};

/**
 * @brief Check whether a wake lock is currently held.
 * @return True after a successful acquire without a matching release.
 */
export const isWakeLockHeld = (): boolean => {
	return sentinel !== null;
};

/**
 * @brief Acquire a screen wake lock.
 * @return True when the lock is held, false when unsupported or denied.
 */
export const acquireWakeLock = async (): Promise<boolean> => {
	if (!isWakeLockSupported() || sentinel) {
		return sentinel !== null;
	}
	try {
		const api = (navigator as unknown as { wakeLock: { request: (kind: string) => Promise<WakeSentinel> } }).wakeLock;
		sentinel = await api.request('screen');
		return true;
	} catch {
		sentinel = null;
		return false;
	}
};

/**
 * @brief Release the held wake lock, if any.
 * @return void
 */
export const releaseWakeLock = async (): Promise<void> => {
	if (!sentinel) {
		return;
	}
	try {
		await sentinel.release();
	} catch {
		return;
	} finally {
		sentinel = null;
	}
};
