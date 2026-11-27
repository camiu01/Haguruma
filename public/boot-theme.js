/**
 * @file boot-theme.js
 * @brief Apply the stored theme and language before first paint.
 *
 * Loaded as a blocking classic script from the document head so the default
 * dark palette never flashes before `initTheme()` runs. Kept outside the
 * bundle (and free of inline code) so the Content Security Policy needs no
 * `unsafe-inline` script source.
 */
(function () {
	var root = document.documentElement;
	try {
		var theme = localStorage.getItem('haguruma-theme');
		if (theme === 'dark' || theme === 'oled' || theme === 'light') {
			root.dataset.theme = theme;
			root.classList.toggle('dark', theme !== 'light');
		}
		var lang = localStorage.getItem('haguruma-lang');
		if (lang === 'en' || lang === 'it' || lang === 'de' || lang === 'es' || lang === 'fr') {
			root.lang = lang;
		}
	} catch (e) {
		return;
	}
})();
