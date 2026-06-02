<script>
	import { formatKstChartDateLabel } from '$lib/utils/parseAdena';

	/** @type {{ date: string, total: number, isToday?: boolean }[]} */
	export let items = [];
	export let loading = false;
	export let error = null;

	const CHART_HEIGHT = 220;
	const PADDING = { top: 28, right: 12, bottom: 36, left: 12 };

	// 색상 팔레트(의미 기반)
	const COLORS = {
		bar: '#3b82f6', // 기본(파랑)
		barToday: '#f97316', // 오늘(주황)
		text: '#0f172a',
		muted: '#475569',
		grid: '#e2e8f0'
	};

	function formatFull(value) {
		return (Number(value) || 0).toLocaleString('ko-KR');
	}

	// 그래프 축 라벨용: 요일 없이 M. D. 형태
	function formatChartAxisLabel(dateStr) {
		const date = new Date(`${dateStr}T12:00:00+09:00`);
		return new Intl.DateTimeFormat('ko-KR', {
			month: 'numeric',
			day: 'numeric',
			timeZone: 'Asia/Seoul'
		}).format(date);
	}

	// 그래프 표기용: 반올림 없이 버림 처리
	function formatCompactTrunc(value) {
		const n = Number(value) || 0;
		if (n >= 100000000) return `${Math.floor(n / 100000000)}억`;
		if (n >= 10000) return `${Math.floor(n / 10000)}만`;
		return n.toLocaleString('ko-KR');
	}

	$: periodDays = items?.length || 0;
	$: periodLabel = periodDays > 0 ? `${periodDays}일` : '';

	$: maxTotal = Math.max(...items.map((i) => i.total), 1);
	// 막대 간 간격(가로 폭)을 조금 더 넓게 + 컨테이너 폭에 맞춰 확장(비율 유지)
	$: chartWidth = Math.max(items.length * 104, 460);
	$: plotWidth = chartWidth - PADDING.left - PADDING.right;
	$: plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
	$: barWidth = items.length > 0 ? Math.min(48, (plotWidth / items.length) * 0.65) : 40;
	$: sevenDaySum = items.reduce((s, i) => s + i.total, 0);
	$: avgDaysCount = items.reduce((c, i) => c + (Number(i?.total) > 0 ? 1 : 0), 0);
	$: sevenDayAvg = avgDaysCount > 0 ? Math.round(sevenDaySum / avgDaysCount) : null;

	let chartWrapEl = null;
	let tooltip = null; // { x, y, date, total }

	function setTooltip(e, item) {
		if (!chartWrapEl || !item) return;
		const rect = chartWrapEl.getBoundingClientRect();
		tooltip = {
			x: e.clientX - rect.left,
			y: e.clientY - rect.top,
			date: item.date,
			total: Number(item.total) || 0
		};
	}

	function clearTooltip() {
		tooltip = null;
	}
</script>

<div class="w-full">
	{#if loading}
		<div class="flex items-center justify-center h-56 rounded-xl bg-slate-50 border border-slate-100">
			<p class="text-gray-500 text-base">차트 데이터를 불러오는 중...</p>
		</div>
	{:else if error}
		<div class="rounded-xl bg-red-50 border border-red-100 p-4">
			<p class="text-red-600 text-base">{error}</p>
		</div>
	{:else if items.length === 0}
		<div class="flex items-center justify-center h-56 rounded-xl bg-slate-50 border border-slate-100">
			<p class="text-gray-500 text-base">표시할 수익 데이터가 없습니다.</p>
		</div>
	{:else}
		<div class="flex flex-col lg:flex-row gap-6 items-start w-full">
			<!-- 그래프(가로폭 꽉 채움) -->
			<div
				bind:this={chartWrapEl}
				class="relative flex-1 min-w-0 overflow-x-auto rounded-xl bg-white border border-slate-200 p-4 text-center"
			>
				{#if tooltip}
					<div
						class="absolute z-10 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs shadow-lg pointer-events-none whitespace-nowrap"
						style="left: {Math.min(Math.max(tooltip.x + 12, 8), (chartWrapEl?.clientWidth || 0) - 8)}px; top: {Math.max(tooltip.y - 44, 8)}px; transform: translateX(-0%);"
					>
						<div class="font-semibold">{formatChartAxisLabel(tooltip.date)}</div>
						<div class="mt-0.5">{formatFull(tooltip.total)}원</div>
					</div>
				{/if}
				<svg
					viewBox="0 0 {chartWidth} {CHART_HEIGHT}"
					width={chartWidth}
					height={CHART_HEIGHT}
					class="inline-block"
					role="img"
					aria-label={`최근 ${periodLabel} 아데나 수익 막대 그래프`}
				>
					<!-- 범례 -->
					<g>
						<circle cx={PADDING.left + 6} cy={14} r="5" fill={COLORS.bar} opacity="0.85" />
						<text
							x={PADDING.left + 18}
							y={18}
							style="font-size: 11px; fill: {COLORS.muted}; font-weight: 600"
						>
							최근 {periodLabel}
						</text>
						<circle cx={PADDING.left + 82} cy={14} r="5" fill={COLORS.barToday} />
						<text
							x={PADDING.left + 94}
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

					{#each items as item, i}
						{@const slotWidth = plotWidth / items.length}
						{@const cx = PADDING.left + slotWidth * i + slotWidth / 2}
						{@const barH = maxTotal > 0 ? (item.total / maxTotal) * plotHeight : 0}
						{@const barX = cx - barWidth / 2}
						{@const barY = PADDING.top + plotHeight - barH}
						<g class="group">
							<rect
								x={barX}
								y={barY}
								width={barWidth}
								height={Math.max(barH, item.total > 0 ? 4 : 0)}
								rx="6"
								role="img"
								aria-label={`${formatChartAxisLabel(item.date)} 수익 ${formatFull(item.total)}원`}
								fill={item.isToday ? COLORS.barToday : COLORS.bar}
								opacity={item.isToday ? 1 : 0.82}
								stroke={item.isToday ? '#c2410c' : '#1d4ed8'}
								stroke-width={item.isToday ? 1.25 : 1}
								on:mouseenter={(e) => setTooltip(e, item)}
								on:mousemove={(e) => setTooltip(e, item)}
								on:mouseleave={clearTooltip}
							/>
							{#if item.total > 0}
								<text
									x={cx}
									y={barY - 6}
									text-anchor="middle"
									style="font-size: 12px; font-weight: 850; fill: {item.isToday ? COLORS.barToday : COLORS.bar}"
								>
									{formatCompactTrunc(item.total)}
								</text>
							{/if}
							<text
								x={cx}
								y={CHART_HEIGHT - 10}
								text-anchor="middle"
								style="font-size: 14px; fill: {item.isToday ? COLORS.text : COLORS.muted}; font-weight: {item.isToday ? 900 : 700}"
							>
								{formatChartAxisLabel(item.date)}
							</text>
							{#if item.isToday}
								<text
									x={cx}
									y={CHART_HEIGHT - 22}
									text-anchor="middle"
									style="font-size: 12px; fill: {COLORS.barToday}; font-weight: 950"
								>
									오늘
								</text>
							{/if}
						</g>
					{/each}
				</svg>
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
				{#if items.length > 0}
					{@const peak = items.reduce((a, b) => (a.total >= b.total ? a : b), items[0])}
					<div class="w-full rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
						<p class="text-xs font-medium text-amber-700 mb-0.5">최고 수익일</p>
						<p class="text-sm font-semibold text-amber-900">{formatKstChartDateLabel(peak.date)}</p>
						<p class="text-lg font-bold text-amber-950">{formatFull(peak.total)}</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
