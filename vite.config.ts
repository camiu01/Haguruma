import { defineConfig } from 'vite';

/**
 * Vite configuration for GitHub Pages deployment.
 * @purpose Define build base and server options.
 */
export default defineConfig({
	base: './',
	server: {
		port: 5173,
	},
	build: {
		outDir: 'dist',
	},
});
