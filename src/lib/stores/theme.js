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

export function applyDocumentTheme(isDark) {
	if (!browser) return;
	document.documentElement.classList.toggle('dark', !!isDark);
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
	}
}

if (browser) {
	theme.subscribe((value) => {
		try {
			localStorage.setItem(THEME_STORAGE_KEY, value);
		} catch {
			/* ignore */
		}
	});
}
