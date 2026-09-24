/**
 * @file vite.config.ts
 * @brief Vite configuration for GitHub Pages deployment.
 *
 * Defines the relative build base and dev server options.
 */
import { defineConfig } from 'vite';

export default defineConfig({
	base: './',
	publicDir: 'public',
	server: {
		port: 5173,
	},
	build: {
		outDir: 'dist',
	},
});
