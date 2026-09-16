<script>
	import { formatEmailDisplay } from '$lib/utils/formatEmail';
	import { formatKstChartDateLabel, getKstDateString, getKstRecentDateStrings } from '$lib/utils/parseAdena';
	import { EARNED_CHART_DAYS, EARNED_CHART_ZERO_DATES } from '$lib/utils/fetchEarnedDailyRange';

	export let email = '';
	export let currencyLabel = '아데나';
	export let days = EARNED_CHART_DAYS;
	export let onClose = () => {};

	let loading = false;
	let error = null;
	let items = [];

	$: periodSum = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

	function formatMoney(value) {
		return (Number(value) || 0).toLocaleString('ko-KR');
	}

	async function loadHistory(targetEmail) {
		const key = (targetEmail || '').trim().toLowerCase();
		if (!key) return;

		loading = true;
		error = null;
		items = [];

		try {
			const dates = getKstRecentDateStrings(days);
			const today = getKstDateString();
			const res = await fetch('/api/adena/earned-batch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ emails: [key], dates })
			});
			const payload = await res.json();
			if (!res.ok || !payload?.success) {
				throw new Error(payload?.error || '조회 실패');
			}

			const byDate = {};
			for (const row of payload.rows || []) {
				byDate[row.stat_date] = Number(row.earned_total) || 0;
			}

			items = [...dates].reverse().map((date) => ({
				date,
				total: EARNED_CHART_ZERO_DATES.has(date) ? 0 : (byDate[date] ?? 0),
				isToday: date === today
			}));
		} catch (e) {
			console.error('member daily earned fetch error:', e);
			error = '일별 획득 내역을 불러오는 중 오류가 발생했습니다.';
			items = [];
		} finally {
			loading = false;
		}
	}

	$: if (email) {
		loadHistory(email);
	}

	function handleBackdrop() {
		onClose();
	}

	function handleKeydown(e) {
		if (e.key === 'Escape') onClose();
	}
</script>

<div
	class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
	on:click={handleBackdrop}
	on:keydown={handleKeydown}
	role="dialog"
	tabindex="-1"
>
	<div
		class="bg-white rounded-lg shadow-xl p-5 w-full max-w-sm mx-4 max-h-[80vh] overflow-y-auto"
		on:click|stopPropagation
	>
		<div class="flex justify-between items-start mb-4 gap-3">
			<div>
				<h3 class="text-lg font-semibold text-gray-900">일별 획득 {currencyLabel}</h3>
				<p class="text-sm text-gray-500 mt-0.5">{formatEmailDisplay(email)}</p>
			</div>
			<button
				type="button"
				on:click={onClose}
				class="text-gray-400 hover:text-gray-600 transition-colors"
				aria-label="닫기"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
				</svg>
			</button>
		</div>

		{#if loading}
			<p class="text-gray-500 text-sm py-6 text-center">불러오는 중...</p>
		{:else if error}
			<p class="text-red-600 text-sm py-4">{error}</p>
		{:else}
			<div class="mb-3 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5">
				<p class="text-xs font-medium text-blue-700">{days}일 합계</p>
				<p class="text-lg font-bold text-blue-900">{formatMoney(periodSum)}원</p>
			</div>
			<div class="space-y-2">
				{#each items as item}
					<div class="flex justify-between items-center rounded-lg px-3 py-2 {item.isToday ? 'bg-orange-50' : 'bg-slate-50'}">
						<span class="text-sm {item.isToday ? 'font-semibold text-orange-800' : 'text-gray-600'}">
							{formatKstChartDateLabel(item.date)}{item.isToday ? ' · 오늘' : ''}
						</span>
						<span class="text-sm font-semibold {item.isToday ? 'text-orange-900' : 'text-gray-800'}">
							{formatMoney(item.total)}원
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
