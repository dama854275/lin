<script>
	import { onMount } from 'svelte';
	import { buildExpiryForecast } from './expiryForecast.js';
	export let members = [];
	let now = new Date();
	let activeDate = null;
	let tooltipX = 0;
	let tooltipY = 0;
	let chart;
	$: activeDay = days.find((day) => day.date === activeDate);
	function showDetails(event, day) {
		const bounds = event.currentTarget.getBoundingClientRect();
		const container = chart.getBoundingClientRect();
		tooltipX = Math.max(8, Math.min(bounds.left - container.left + bounds.width / 2, container.width - 200));
		tooltipY = Math.max(8, bounds.top - container.top);
		activeDate = day.date;
	}
	onMount(() => {
		const timer = setInterval(() => (now = new Date()), 60000);
		return () => clearInterval(timer);
	});
	$: days = buildExpiryForecast(members, now);
	$: total = days.reduce((sum, day) => sum + day.count, 0);
	$: step = Math.max(1, Math.ceil(Math.max(...days.map((day) => day.count)) / 4));
	$: maximum = step * 4;
</script>

<section class="bg-white rounded-lg shadow-md p-6 mb-6" aria-labelledby="expiry-forecast-title">
	<div class="flex flex-wrap items-start justify-between gap-3 mb-5">
		<div>
			<h3 id="expiry-forecast-title" class="text-2xl font-semibold text-gray-900">상품 기간 만료 예정</h3>
		</div>
		<div class="rounded-lg bg-blue-50 border border-blue-100 px-4 py-2 text-blue-800">
			<span class="text-sm">기간 내 만료</span>
			<strong class="text-2xl ml-2">{total.toLocaleString('ko-KR')}</strong><span class="text-sm ml-1">개</span>
		</div>
	</div>
	<div class="relative" bind:this={chart}>
	<div class="overflow-x-auto" on:scroll={() => (activeDate = null)}>
		<svg viewBox="0 0 1050 285" class="w-full min-w-[800px]" role="img" aria-label="날짜별 상품 기간 만료 계정 수 막대그래프">
			{#each [0, 1, 2, 3, 4] as tick}
				<line x1="42" y1={225 - tick * 48} x2="1040" y2={225 - tick * 48} stroke="#e5e7eb" />
				<text x="32" y={229 - tick * 48} text-anchor="end" fill="#6b7280" font-size="12">{tick * step}</text>
			{/each}
			<text x="12" y="16" fill="#6b7280" font-size="12">계정 수</text>
			{#each days as day, index}
				{@const thisMonth = day.date.slice(0, 7) === days[0].date.slice(0, 7)}
				<g>
					<rect x={48 + index * 32} y={225 - day.count / maximum * 192} width="22" height={day.count / maximum * 192} rx="3" fill={thisMonth ? '#3b82f6' : '#22c55e'} />
					{#if day.count > 0}
						<text x={59 + index * 32} y={217 - day.count / maximum * 192} text-anchor="middle" fill={thisMonth ? '#1e40af' : '#15803d'} font-size="11">{day.count}</text>
					{/if}
					<text x={59 + index * 32} y="245" text-anchor="middle" fill={index === 0 ? '#c2410c' : '#6b7280'} font-size="10">{day.label}</text>
					{#if index === 0}<text x="59" y="263" text-anchor="middle" fill="#c2410c" font-size="10">오늘</text>{/if}
					<rect
						x={43 + index * 32} y="30" width="32" height="222" fill="transparent"
						role="button" tabindex="0" aria-label={`${day.date}: ${day.count}개 만료, 그룹별 보기`}
						on:mouseenter={(event) => showDetails(event, day)}
						on:mouseleave={() => (activeDate = null)}
						on:focus={(event) => showDetails(event, day)}
						on:blur={() => (activeDate = null)}
						on:click={(event) => showDetails(event, day)}
						on:keydown={(event) => {
							if (event.key === 'Escape') activeDate = null;
							if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showDetails(event, day); }
						}}
					/>
				</g>
			{/each}
		</svg>
	</div>
	{#if activeDay}
		<div role="tooltip" class="absolute z-20 pointer-events-none w-48 rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-sm" style={`left: ${tooltipX}px; top: ${tooltipY}px;`}>
			<p class="font-semibold text-gray-900 border-b border-gray-100 pb-2 mb-2">{activeDay.date} · {activeDay.count}개</p>
			{#each Object.entries(activeDay.groups).sort(([a], [b]) => a.localeCompare(b)) as [prefix, count]}
				<p class="text-lg font-semibold text-gray-700 py-0.5">{prefix} : {count}개</p>
			{:else}
				<p class="text-gray-500">만료 계정 없음</p>
			{/each}
		</div>
	{/if}
	</div>
	{#if total === 0}<p class="text-sm text-gray-500 text-center">이 기간에 상품 기간이 만료되는 하위 계정이 없습니다.</p>{/if}
</section>
