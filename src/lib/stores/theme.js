import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const THEME_STORAGE_KEY = 'lin-theme';

function readStoredTheme() {
	if (!browser) return 'light';
	try {
		return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
	} catch {
		return 'light';
	}
}

export const theme = writable(readStoredTheme());

function isThemeablePath(pathname = browser ? window.location.pathname : '') {
	return pathname === '/monitor' || pathname === '/monitor_2';
}

export function applyDocumentTheme(isDark) {
	if (!browser) return;
	document.documentElement.classList.toggle('dark', !!isDark);
}

export function syncDocumentTheme(pathname, currentTheme) {
	applyDocumentTheme(isThemeablePath(pathname) && currentTheme === 'dark');
}

export function setTheme(next) {
	const value = next === 'dark' ? 'dark' : 'light';
	theme.set(value);
	if (browser) {
		try {
			localStorage.setItem(THEME_STORAGE_KEY, value);
		} catch {
			/* ignore */
		}
		applyDocumentTheme(isThemeablePath() && value === 'dark');
	}
}

if (browser) {
	theme.subscribe((value) => {
		try {
			localStorage.setItem(THEME_STORAGE_KEY, value);
		} catch {
			/* ignore */
		}
		applyDocumentTheme(isThemeablePath() && value === 'dark');
	});
}
