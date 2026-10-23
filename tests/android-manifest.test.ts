/**
 * @file android-manifest.test.ts
 * @brief Foreground-only sensor permission and private provider contract.
 */
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('permits explicit foreground GPS without requiring GPS hardware or background location', () => {
	const manifest = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
	expect(manifest).toContain('android.permission.ACCESS_COARSE_LOCATION');
	expect(manifest).toContain('android.permission.ACCESS_FINE_LOCATION');
	expect(manifest).not.toContain('android.permission.ACCESS_BACKGROUND_LOCATION');
	expect(manifest).toMatch(/android.hardware.location.gps" android:required="false"/);
	expect(manifest).toMatch(/android:name="androidx.core.content.FileProvider"[\s\S]*?android:exported="false"/);
});
