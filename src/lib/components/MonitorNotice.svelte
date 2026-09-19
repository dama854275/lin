<script>
	import { browser } from '$app/environment';

	const STORAGE_KEY = 'monitor-notice-open-v2';

	let open = false;

	if (browser) {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === '1') open = true;
	}

	function toggle() {
		open = !open;
		if (browser) localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
	}
</script>

<div class="bg-white rounded-lg shadow-md mb-4 overflow-hidden">
	<button
		type="button"
		class="w-full flex items-center justify-between gap-3 px-6 py-3 text-left hover:bg-gray-50 transition-colors"
		on:click={toggle}
		aria-expanded={open}
	>
		<div class="flex items-center gap-2 min-w-0">
			<span class="text-sm font-semibold text-gray-800">안내 및 주의사항</span>
			{#if !open}
				<span class="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">주의</span>
			{/if}
		</div>
		<span class="flex items-center gap-1.5 shrink-0 text-base font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-1.5">
			{open ? '접기' : '펼치기'}
			<svg
				class="w-5 h-5 text-blue-600 transition-transform {open ? 'rotate-180' : ''}"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
					clip-rule="evenodd"
				/>
			</svg>
		</span>
	</button>

	{#if open}
		<div class="px-6 pb-4 text-sm text-gray-600 leading-relaxed space-y-3 border-t border-gray-100 pt-4">
			<p>* 아데나 관련 값들과 1시간 킬수는 10분 주기 / 장착장비·보유 아이템은 1시간 주기 / 사냥터는 실시간으로 갱신됩니다</p>
			<p>* 감소된 아데나는 계산에서 제외 됩니다 오직 증가된 아데나만 계산에 포함됩니다</p>
			<p>* 이메일을 클릭해 일별 획득 내역을 확인 할 수 있습니다</p>
			<p>* 1시간 킬수와 1시간 아데나는 우측의 갱신시간 기준 최근 1시간 동안의 변화값 ( 1시간 내에 아이템 판매로 획득한 아데나도 포함 )</p>
			<p>* '그룹 계정 목록'에서 1시간 킬수 / 1시간 획득량 / 오늘 획득 / 어제 획득 같은 분류 항목을 누르면 오름 정렬, 내림 정렬이 가능합니다</p>
			<p>* 하단에서 서버를 선택하고 검색하는 등. 조건을 넣으면 상단의 통계도 그 조건에 맞는 캐릭터들만 반영됩니다</p>
			<div class="font-bold space-y-1">
				<p class="text-red-600">[ 주의 ]</p>
				<p>* 다른 캐릭터로부터 받아 증가된 아데나도 획득량으로 계산됩니다</p>
				<p class="pl-4">단 한번에 10만 이상이 늘었을때는 반영되지 않습니다</p>
				<p>* 이메일이 빨간 계정은 리니지 계정 만료일이 24시간 이내에 끝나는 계정입니다</p>
				<p class="pl-4">가방에 있는 두루마리 만료일 기간이며 우측의 '계정 만료일'를 통해 확인 가능합니다</p>
				<p>* 확인 대기 중, 확인 불가 라고 표시될때는 NC 웹사이트에서 '대표 캐릭터' 설정을 해야됩니다</p>
			</div>
		</div>
	{/if}
</div>
