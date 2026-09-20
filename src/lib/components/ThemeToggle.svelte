<script>
	import { theme, setTheme } from '$lib/stores/theme';
</script>

<div class="theme-toggle inline-flex rounded-lg border border-gray-300 overflow-hidden" role="group" aria-label="화면 테마">
	<button
		type="button"
		on:click={() => setTheme('light')}
		class="theme-toggle-btn px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-1.5 {$theme === 'light' ? 'theme-toggle-on' : 'theme-toggle-off'}"
		aria-pressed={$theme === 'light'}
	>
		<svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<path
				d="M10 3.5a.75.75 0 01.75.75v1.25a.75.75 0 01-1.5 0V4.25A.75.75 0 0110 3.5zM10 14a.75.75 0 01.75.75v1.25a.75.75 0 01-1.5 0V14.75A.75.75 0 0110 14zM4.25 10a.75.75 0 01.75-.75H6.25a.75.75 0 010 1.5H5a.75.75 0 01-.75-.75zM13.75 10a.75.75 0 01.75-.75H16a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zM5.81 5.81a.75.75 0 011.06 0l.88.88a.75.75 0 11-1.06 1.06l-.88-.88a.75.75 0 010-1.06zM12.25 12.25a.75.75 0 011.06 0l.88.88a.75.75 0 11-1.06 1.06l-.88-.88a.75.75 0 010-1.06zM5.81 14.19a.75.75 0 010-1.06l.88-.88a.75.75 0 111.06 1.06l-.88.88a.75.75 0 01-1.06 0zM12.25 7.75a.75.75 0 010-1.06l.88-.88a.75.75 0 111.06 1.06l-.88.88a.75.75 0 01-1.06 0zM10 7a3 3 0 100 6 3 3 0 000-6z"
			/>
		</svg>
		<span class="hidden sm:inline">라이트</span>
	</button>
	<button
		type="button"
		on:click={() => setTheme('dark')}
		class="theme-toggle-btn px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-1.5 border-l border-gray-300 {$theme === 'dark' ? 'theme-toggle-on' : 'theme-toggle-off'}"
		aria-pressed={$theme === 'dark'}
	>
		<svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<path
				d="M7.455 2.104a.75.75 0 01.21.78 7 7 0 009.45 9.45.75.75 0 011.06.927A8.5 8.5 0 117.038 2.02a.75.75 0 01.417.084z"
			/>
		</svg>
		<span class="hidden sm:inline">다크</span>
	</button>
</div>
