/**
 * @file device-feedback.ts
 * @brief Opt-in native haptics and screen-awake lifecycle.
 */
import { Capacitor } from '@capacitor/core';

let lastHaptic = 0;
let hapticsEnabled = false;

/**
 * @brief Enable or disable optional tactile feedback.
 * @param enabled User choice.
 * @return void
 */
export const setHapticsEnabled = (enabled: boolean): void => { hapticsEnabled = enabled; };

/**
 * @brief Emit a light, throttled native haptic without breaking web operation.
 * @param none No parameters.
 * @return Promise resolved after the attempt.
 */
export const lightHaptic = async (): Promise<void> => {
	if (!hapticsEnabled || !Capacitor.isNativePlatform() || Date.now() - lastHaptic < 100) return;
	lastHaptic = Date.now();
	try {
		const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
		await Haptics.impact({ style: ImpactStyle.Light });
	} catch { /* Haptics are optional on unsupported devices. */ }
};

/**
 * @brief Toggle screen awake through the Capacitor plugin's web/native implementations.
 * @param enabled Whether to request an awake screen.
 * @return True when the platform accepted the request.
 */
export const setScreenAwake = async (enabled: boolean): Promise<boolean> => {
	try {
		const { KeepAwake } = await import('@capacitor-community/keep-awake');
		if (!(await KeepAwake.isSupported()).isSupported) return false;
		if (enabled) await KeepAwake.keepAwake();
		else await KeepAwake.allowSleep();
		return true;
	} catch {
		return false;
	}
};
