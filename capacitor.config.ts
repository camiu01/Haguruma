/**
 * @file capacitor.config.ts
 * @brief Capacitor native wrapper pointing at the Vite build output.
 */
import type { CapacitorConfig } from '@capacitor/cli';

/** Native app shell for the Haguruma web build. */
const config: CapacitorConfig = {
	appId: 'com.haguruma.app',
	appName: 'Haguruma',
	webDir: 'dist',
};

export default config;
