/**
 * @file vite.config.ts
 * @brief Vite configuration for GitHub Pages deployment.
 *
 * Defines the relative build base and dev server options.
 */
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
	plugins: [visualizer({ filename: 'dist/bundle-report.html', gzipSize: true, brotliSize: true, open: false })],
	base: './',
	publicDir: 'public',
	server: {
		port: 5173,
	},
	build: {
		outDir: 'dist',
	},
});
