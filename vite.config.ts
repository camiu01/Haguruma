/**
 * @file vite.config.ts
 * @brief Vite configuration for GitHub Pages deployment.
 *
 * Defines the relative build base and dev server options, injects the
 * Content Security Policy into production builds only (so dev HMR keeps its
 * websocket), and emits a bundle treemap (`dist/stats.html`) for
 * `npm run analyze` or when `ANALYZE=1` is set.
 */
import { defineConfig, type Plugin } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

/** Production Content Security Policy: same-origin code, Google Fonts only. */
export const CSP = [
	"default-src 'self'",
	"script-src 'self'",
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
	"font-src 'self' https://fonts.gstatic.com",
	"img-src 'self' data: blob:",
	"connect-src 'self'",
	"worker-src 'self'",
	"manifest-src 'self'",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'none'",
].join('; ');

/**
 * @brief Build-only plugin that prepends the CSP meta tag to index.html.
 * @return Vite plugin.
 */
const cspPlugin = (): Plugin => ({
	name: 'haguruma-csp',
	apply: 'build',
	transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
});

export default defineConfig(({ mode }) => ({
	base: './',
	publicDir: 'public',
	server: {
		port: 5173,
	},
	build: {
		outDir: 'dist',
	},
	plugins: [
		cspPlugin(),
		mode === 'analyze' || process.env.ANALYZE ? visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true }) : null,
	],
}));
