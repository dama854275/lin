<script>
	import { onMount } from 'svelte';
	import { formatKstChartDateLabel, getKstRecentMonthOptions } from '$lib/utils/parseAdena';
	import { EARNED_CHART_ZERO_DATES } from '$lib/utils/fetchEarnedDailyRange';
	import { createEventDispatcher } from 'svelte';

	/** @type {{ date: string, total: number, isToday?: boolean }[]} */
	export let items = [];
	export let loading = false;
	export let error = null;
	export let currencyLabel = '아데나';
	export let showRangeControls = false;
	export let rangeMode = 'recent';
	export let selectedYearMonth = '';

	const dispatch = createEventDispatcher();
	$: monthOptions = getKstRecentMonthOptions();
	let monthSelectValue = '';
	$: monthSelectValue = rangeMode === 'month' ? selectedYearMonth || '' : '';

	const CHART_HEIGHT = 220;
	const PADDING = { top: 28, right: 48, bottom: 36, left: 12 };

	// 색상 팔레트(의미 기반)
	const COLORS = {
		barOdd: '#3b82f6',
		barEven: '#94a3b8',
		barToday: '#f97316',
		text: '#0f172a',
		muted: '#475569',
		grid: '#e2e8f0'
	};

	function formatFull(value) {
		return (Number(value) || 0).toLocaleString('ko-KR');
	}

	function formatAxisValue(value) {
		const n = Math.max(0, Number(value) || 0);
		if (n < 1) return '0';
		if (n >= 100000000) {
			const eok = n / 100000000;
			const s = eok >= 10 ? String(Math.round(eok)) : eok.toFixed(1).replace(/\.0$/, '');
			return `${s}억`;
		}
		if (n >= 10000) {
			const man = n / 10000;
			const s = man >= 10 ? String(Math.round(man)) : man.toFixed(1).replace(/\.0$/, '');
			return `${s}만`;
		}
		return Math.round(n).toLocaleString('ko-KR');
	}

	function formatChartAxisLabel(dateStr) {
		const date = new Date(`${dateStr}T12:00:00+09:00`);
		return new Intl.DateTimeFormat('ko-KR', {
			month: 'numeric',
			day: 'numeric',
			timeZone: 'Asia/Seoul'
		}).format(date);
	}

	function formatTooltipDate(dateStr) {
		const date = new Date(`${dateStr}T12:00:00+09:00`);
		const weekday = new Intl.DateTimeFormat('ko-KR', {
			weekday: 'narrow',
			timeZone: 'Asia/Seoul'
		}).format(date);
		const parts = new Intl.DateTimeFormat('en-US', {
			month: 'numeric',
			day: 'numeric',
			timeZone: 'Asia/Seoul'
		}).formatToParts(date);
		const month = parts.find((p) => p.type === 'month')?.value;
		const day = parts.find((p) => p.type === 'day')?.value;
		return `${weekday} (${Number(month)}월 ${Number(day)}일)`;
	}

	function isOddCalendarDay(dateStr) {
		const day = Number(String(dateStr || '').slice(8, 10));
		return Number.isFinite(day) && day % 2 === 1;
	}

	function barFill(item) {
		if (item.isToday) return COLORS.barToday;
		return isOddCalendarDay(item.date) ? COLORS.barOdd : COLORS.barEven;
	}

	function shouldShowAxisLabel(item, i, count) {
		if (item.isToday || i === count - 1) return true;
		if (i === 0) return true;
		if (i % 7 !== 0) return false;
		// 첫/끝(오늘) 라벨과 하루 차이로 겹치지 않게
		if (i <= 1) return false;
		if (count - 1 - i <= 1) return false;
		return true;
	}

	function axisLabelAnchor(i, count) {
		if (i === 0) return 'start';
		if (i === count - 1) return 'end';
		return 'middle';
	}

	$: displayItems = (items || []).map((item) => {
		const dateKey = String(item?.date || '').slice(0, 10);
		if (EARNED_CHART_ZERO_DATES.has(dateKey)) {
			return { ...item, total: 0 };
		}
		return item;
	});
	$: periodDays = displayItems?.length || 0;
	$: periodLabel =
		rangeMode === 'month' && selectedYearMonth
			? `${Number(selectedYearMonth.slice(5, 7))}월`
			: periodDays > 0
				? `${periodDays}일`
				: '';

	$: maxTotal = Math.max(...displayItems.map((i) => i.total), 1);
	$: axisMax = Math.max(0, ...displayItems.map((i) => Number(i.total) || 0));
	$: yTicks = [
		{ ratio: 1, label: formatAxisValue(axisMax) },
		{ ratio: 0.5, label: formatAxisValue(axisMax / 2) },
		{ ratio: 0, label: '0' }
	];
	$: chartWidth = Math.max(containerWidth || 640, 200);
	$: plotWidth = chartWidth - PADDING.left - PADDING.right;
	$: plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
	$: slotWidth = displayItems.length > 0 ? plotWidth / displayItems.length : 0;
	$: barWidth = displayItems.length > 0 ? Math.max(3, slotWidth * 0.42) : 4;
	$: sevenDaySum = displayItems.reduce((s, i) => s + i.total, 0);
	$: avgDaysCount = displayItems.reduce((c, i) => c + (Number(i?.total) > 0 ? 1 : 0), 0);
	$: sevenDayAvg = avgDaysCount > 0 ? Math.round(sevenDaySum / avgDaysCount) : null;

	let chartWrapEl = null;
	let containerWidth = 0;
	let tooltip = null; // { x, y, date, total, placeLeft }
	let resizeObserver = null;

	function sizeChart(node) {
		chartWrapEl = node;
		const applyWidth = () => {
			const w = Math.floor(node.clientWidth || 0);
			if (w > 0) containerWidth = w;
		};
		applyWidth();
		if (typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(applyWidth);
			resizeObserver.observe(node);
		}
		return {
			destroy() {
				resizeObserver?.disconnect();
				resizeObserver = null;
			}
		};
	}

	onMount(() => {
		return () => resizeObserver?.disconnect();
	});

	function setTooltip(e, item) {
		if (!chartWrapEl || !item) return;
		const rect = chartWrapEl.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		tooltip = {
			x,
			y,
			date: item.date,
			total: Number(item.total) || 0,
			placeLeft: x > rect.width * 0.55
		};
	}

	function clearTooltip() {
		tooltip = null;
	}

	function selectRecentRange() {
		dispatch('rangechange', { mode: 'recent', yearMonth: '' });
	}

	function selectMonthRange(event) {
		const value = String(event?.target?.value || '').trim();
		if (!value) {
			selectRecentRange();
			return;
		}
		dispatch('rangechange', { mode: 'month', yearMonth: value });
	}
</script>

<div class="w-full">
	{#if error}
		<div class="rounded-xl bg-red-50 border border-red-100 p-4">
			<p class="text-red-600 text-base">{error}</p>
		</div>
	{:else if loading && displayItems.length === 0}
		<div class="flex items-center justify-center h-56 rounded-xl bg-slate-50 border border-slate-100">
			<p class="text-gray-500 text-base">차트 데이터를 불러오는 중...</p>
		</div>
	{:else if displayItems.length === 0}
		<div class="flex items-center justify-center h-56 rounded-xl bg-slate-50 border border-slate-100">
			<p class="text-gray-500 text-base">표시할 획득 {currencyLabel} 데이터가 없습니다.</p>
		</div>
	{:else}
		<div class="flex flex-col lg:flex-row gap-6 items-start w-full">
			<div class="flex-1 min-w-0 w-full">
				<div class="flex items-center justify-between gap-3 mb-2 min-w-0">
					<h4 class="text-lg font-semibold text-gray-800 truncate">날짜별 획득 {currencyLabel}</h4>
					{#if showRangeControls}
						<div class="flex items-center gap-2 shrink-0">
							<button
								type="button"
								class="px-3 py-1.5 text-sm rounded-lg border whitespace-nowrap transition-colors {rangeMode === 'recent'
									? 'bg-blue-600 text-white border-blue-600 font-semibold'
									: 'bg-white text-gray-700 border-slate-200 hover:bg-slate-50'}"
								on:click={selectRecentRange}
							>
								최근 30일
							</button>
							<select
								class="px-3 py-1.5 text-sm rounded-lg border bg-white whitespace-nowrap {rangeMode === 'month'
									? 'border-blue-600 text-blue-700 font-semibold'
									: 'border-slate-200 text-gray-700'}"
								bind:value={monthSelectValue}
								on:change={selectMonthRange}
							>
								<option value="">월 선택</option>
								{#each monthOptions as opt}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							</select>
						</div>
					{/if}
				</div>
			<!-- 그래프(가로폭 꽉 채움) -->
			<div class="relative min-w-0 overflow-visible rounded-xl bg-white border border-slate-200 p-4">
				<div use:sizeChart class="relative w-full">
				{#if tooltip}
					<div
						class="absolute z-10 pointer-events-none"
						style="left: {tooltip.x}px; top: {Math.max(tooltip.y - 72, 8)}px; transform: {tooltip.placeLeft ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)'};"
					>
						{#key tooltip.date}
							<div class="chart-tooltip-flash px-4 py-3 rounded-xl bg-slate-900 text-white shadow-xl whitespace-nowrap">
								<div class="text-sm font-semibold tracking-wide">{formatTooltipDate(tooltip.date)}</div>
								<div class="mt-1 text-lg font-bold">{formatFull(tooltip.total)}</div>
							</div>
						{/key}
					</div>
				{/if}
				<svg
					viewBox="0 0 {chartWidth} {CHART_HEIGHT}"
					width="100%"
					height={CHART_HEIGHT}
					class="block"
					role="img"
					aria-label={`최근 ${periodLabel} 획득 ${currencyLabel} 봉 그래프`}
				>
					<!-- 범례 -->
					<g>
						<rect x={PADDING.left} y={9} width="8" height="10" rx="1" fill={COLORS.barOdd} />
						<text
							x={PADDING.left + 12}
							y={18}
							style="font-size: 11px; fill: {COLORS.muted}; font-weight: 600"
						>
							홀수일
						</text>
						<rect x={PADDING.left + 62} y={9} width="8" height="10" rx="1" fill={COLORS.barEven} />
						<text
							x={PADDING.left + 74}
							y={18}
							style="font-size: 11px; fill: {COLORS.muted}; font-weight: 600"
						>
							짝수일
						</text>
						<rect x={PADDING.left + 128} y={9} width="8" height="10" rx="1" fill={COLORS.barToday} />
						<text
							x={PADDING.left + 140}
							y={18}
							style="font-size: 11px; fill: {COLORS.muted}; font-weight: 600"
						>
							오늘
						</text>
					</g>

					<!-- 가로 그리드 -->
					{#each [0, 0.25, 0.5, 0.75, 1] as ratio}
						{@const y = PADDING.top + plotHeight * (1 - ratio)}
						<line
							x1={PADDING.left}
							y1={y}
							x2={chartWidth - PADDING.right}
							y2={y}
							stroke={COLORS.grid}
							stroke-width="1"
							stroke-dasharray="4 4"
						/>
					{/each}

					{#each displayItems as item, i}
						{@const cx = PADDING.left + slotWidth * i + slotWidth / 2}
						{@const barH = maxTotal > 0 ? (item.total / maxTotal) * plotHeight : 0}
						{@const drawH = Math.max(barH, 2)}
						{@const barX = cx - barWidth / 2}
						{@const barY = PADDING.top + plotHeight - drawH}
						{@const fill = barFill(item)}
						<g>
							<rect
								x={PADDING.left + slotWidth * i}
								y={PADDING.top}
								width={slotWidth}
								height={plotHeight}
								fill="transparent"
								role="img"
								aria-label={`${formatChartAxisLabel(item.date)} 획득 ${currencyLabel} ${formatFull(item.total)}원`}
								on:mouseenter={(e) => setTooltip(e, item)}
								on:mousemove={(e) => setTooltip(e, item)}
								on:mouseleave={clearTooltip}
							/>
							<rect
								x={barX}
								y={barY}
								width={barWidth}
								height={drawH}
								rx="1"
								fill={fill}
								pointer-events="none"
							/>
							{#if shouldShowAxisLabel(item, i, displayItems.length)}
								<text
									x={cx}
									y={CHART_HEIGHT - 10}
									text-anchor={axisLabelAnchor(i, displayItems.length)}
									style="font-size: 11px; fill: {item.isToday ? COLORS.barToday : COLORS.muted}; font-weight: {item.isToday ? 800 : 600}"
								>
									{formatChartAxisLabel(item.date)}
								</text>
							{/if}
						</g>
					{/each}

					<!-- Y값: 막대 오른쪽 좁은 칸 (오늘 봉과 겹치지 않음) -->
					{#each yTicks as tick}
						{@const y = PADDING.top + plotHeight * (1 - tick.ratio)}
						<text
							x={chartWidth - PADDING.right + 4}
							y={y}
							dy={tick.ratio === 1 ? 5 : tick.ratio === 0 ? -5 : 0}
							text-anchor="start"
							dominant-baseline="middle"
							pointer-events="none"
							style="font-size: 13px; fill: {COLORS.muted}; font-weight: 700;"
						>
							{tick.label}
						</text>
					{/each}
				</svg>
				</div>
			</div>
			</div>

			<!-- 요약(그래프 오른쪽) -->
			<div class="w-full lg:w-[160px] ml-auto flex flex-col gap-3 lg:items-end lg:text-right">
				<div class="w-full rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
					<p class="text-xs font-medium text-blue-700 mb-0.5">{periodLabel} 합계</p>
					<p class="text-xl font-bold text-blue-900">{formatFull(sevenDaySum)}</p>
				</div>
				<div class="w-full rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
					<p class="text-xs font-medium text-slate-500 mb-0.5">일평균</p>
					<p class="text-xl font-bold text-slate-800">
						{#if sevenDayAvg === null}-{:else}{formatFull(sevenDayAvg)}{/if}
					</p>
				</div>
				{#if displayItems.length > 0}
					{@const peak = displayItems.reduce((a, b) => (a.total >= b.total ? a : b), displayItems[0])}
					<div class="w-full rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
						<p class="text-xs font-medium text-amber-700 mb-0.5">최고 획득일</p>
						<p class="text-sm font-semibold text-amber-900">{formatKstChartDateLabel(peak.date)}</p>
						<p class="text-lg font-bold text-amber-950">{formatFull(peak.total)}</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.chart-tooltip-flash {
		animation: chart-tooltip-refresh 180ms ease-out;
	}

	@keyframes chart-tooltip-refresh {
		0% {
			opacity: 0.4;
			transform: scale(0.94);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
