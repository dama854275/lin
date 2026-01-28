<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { supabase } from '$lib/supabase/client';
	import { user } from '$lib/stores/auth';
	import { goto } from '$app/navigation';

	let currentUser = null;
	let referredMembers = [];
	let loading = false;
	let error = null;
	
	// 필터 상태
	let showStoppedOnly = false;
	let searchFilterType = '이메일'; // '이메일' | '아이템' | '서버'
	let searchFilterTerm = '';
	let levelFilterValue = '';
	let levelFilterType = '이상'; // '이상' 또는 '이하'
	let adenFilterValue = '';
	let adenFilterType = '이상'; // '이상' 또는 '이하'
	
	// 통계 값 유지용
	let cachedStatistics = { totalMoney: 0, itemCounts: {} };
	
	// 아이템 팝업 상태
	let itemPopupOpen = null; // 열린 회원의 이메일 또는 null

	function formatMoney(money) {
		if (!money || money === '-') return '-';
		const num = parseInt(money.replace(/,/g, ''), 10);
		if (isNaN(num)) return money;
		return num.toLocaleString('ko-KR');
	}

	function formatDateTime(dateTime) {
		if (!dateTime) return '-';
		try {
			const date = new Date(dateTime);
			if (isNaN(date.getTime())) return '-';
			return date.toLocaleString('ko-KR', {
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch (e) {
			return '-';
		}
	}

	// 아이템 배열을 받아서 중복을 카운트하여 포맷팅된 배열로 반환
	function formatItemsWithCount(items) {
		if (!items || !Array.isArray(items) || items.length === 0) {
			return [];
		}

		const itemCounts = {};
		items.forEach((item) => {
			if (item && typeof item === 'string') {
				const trimmedItem = item.trim();
				if (trimmedItem !== '' && trimmedItem !== '-') {
					itemCounts[trimmedItem] = (itemCounts[trimmedItem] || 0) + 1;
				}
			}
		});

		return Object.entries(itemCounts).map(([item, count]) => {
			return count > 1 ? `${item} x${count}` : item;
		});
	}

	// 필터링된 회원 목록 계산
	$: filteredMembers = referredMembers
		.filter((member) => {
			if (!member) return false;
			
			const parsed = parseApiValue(member.api_value);
			
			// 중지 상태 필터
			if (showStoppedOnly && parsed.status !== '중지') {
				return false;
			}

			// 통합 검색 필터 (이메일/아이템/서버)
			if (searchFilterTerm && searchFilterTerm.trim() !== '') {
				const searchTerm = searchFilterTerm.trim().toLowerCase();
				if (searchFilterType === '이메일') {
					const memberEmail = (member.email || '').toLowerCase();
					if (!memberEmail.includes(searchTerm)) return false;
				} else if (searchFilterType === '아이템') {
					const hasItem = parsed.items && parsed.items.some((item) =>
						item && item.toLowerCase().includes(searchTerm)
					);
					if (!hasItem) return false;
				} else if (searchFilterType === '서버') {
					const serverName = parsed.server && parsed.server !== '-'
						? parsed.server.toLowerCase()
						: '';
					if (!serverName.includes(searchTerm)) return false;
				}
			}
			
			// 레벨 필터
			if (levelFilterValue && levelFilterValue.toString().trim() !== '') {
				const filterLevel = parseInt(levelFilterValue.toString().trim(), 10);
				if (!isNaN(filterLevel) && filterLevel >= 0) {
					let memberLevel = null;
					if (parsed.level && parsed.level !== '-') {
						memberLevel = parseInt(parsed.level.toString().trim(), 10);
						if (isNaN(memberLevel)) {
							memberLevel = null;
						}
					}
					
					if (memberLevel === null) {
						return false; // 레벨이 없는 경우 필터에서 제외
					}
					
					if (levelFilterType === '이상') {
						if (memberLevel < filterLevel) {
							return false;
						}
					} else if (levelFilterType === '이하') {
						if (memberLevel > filterLevel) {
							return false;
						}
					}
				}
			}
			
			// 보유 아데나 필터
			if (adenFilterValue && adenFilterValue.toString().trim() !== '') {
				const filterAden = parseInt(adenFilterValue.toString().trim().replace(/[^\d]/g, ''), 10);
				if (!isNaN(filterAden) && filterAden >= 0) {
					let memberAden = null;
					if (parsed.money && parsed.money !== '-') {
						try {
							let moneyStr = String(parsed.money).trim();
							if (moneyStr !== '' && moneyStr !== '-') {
								moneyStr = moneyStr.replace(/[^\d]/g, '');
								if (moneyStr !== '') {
									memberAden = parseInt(moneyStr, 10);
									if (isNaN(memberAden)) {
										memberAden = null;
									}
								}
							}
						} catch (e) {
							memberAden = null;
						}
					}
					
					if (memberAden === null) {
						return false; // 보유 아데나가 없는 경우 필터에서 제외
					}
					
					if (adenFilterType === '이상') {
						if (memberAden < filterAden) {
							return false;
						}
					} else if (adenFilterType === '이하') {
						if (memberAden > filterAden) {
							return false;
						}
					}
				}
			}
			
			return true;
		})
		.sort((a, b) => {
			// 이메일 기준 오름차순 정렬
			const emailA = (a.email || '').toLowerCase();
			const emailB = (b.email || '').toLowerCase();
			return emailA.localeCompare(emailB);
		});

	// 통계 계산 함수 (필터링된 회원 기준)
	function calculateStatistics() {
		let totalMoney = 0;
		const itemCounts = {};

		if (!filteredMembers || filteredMembers.length === 0) {
			return {
				totalMoney: 0,
				itemCounts: {}
			};
		}

		filteredMembers.forEach((member) => {
			// api_value가 null이거나 빈 값인 경우 건너뛰기
			if (!member || !member.api_value) return;
			
			const parsed = parseApiValue(member.api_value);
			
			// 전체 보유 금액 합계
			if (parsed.money && parsed.money !== '-') {
				try {
					// 문자열로 변환 후 숫자가 아닌 문자 제거 (쉼표, 공백, 한글 등)
					let moneyStr = String(parsed.money).trim();
					
					// 빈 문자열이 아니고 '-'가 아닌 경우
					if (moneyStr !== '' && moneyStr !== '-') {
						// 숫자만 추출 (쉼표, 공백, 기타 문자 제거)
						moneyStr = moneyStr.replace(/[^\d]/g, '');
						
						// 숫자로 변환
						if (moneyStr !== '') {
							const moneyNum = parseInt(moneyStr, 10);
							if (!isNaN(moneyNum) && moneyNum >= 0) {
								totalMoney += moneyNum;
							}
						}
					}
				} catch (e) {
					// 금액 파싱 오류 무시
				}
			}

			// 아이템별 개수 계산
			if (parsed.items && Array.isArray(parsed.items)) {
				parsed.items.forEach((item) => {
					if (item && typeof item === 'string') {
						const trimmedItem = item.trim();
						if (trimmedItem !== '' && trimmedItem !== '-') {
							itemCounts[trimmedItem] = (itemCounts[trimmedItem] || 0) + 1;
						}
					}
				});
			}
		});

		return {
			totalMoney,
			itemCounts
		};
	}

	$: {
		if (filteredMembers && filteredMembers.length > 0) {
			const newStats = calculateStatistics();
			if (newStats.totalMoney > 0 || Object.keys(newStats.itemCounts).length > 0) {
				cachedStatistics = newStats;
			}
		} else if (referredMembers && referredMembers.length > 0) {
			// 필터링 결과가 없어도 이전 값 유지
		}
	}
	
	$: statistics = cachedStatistics;

	function parseApiValue(apiValue) {
		// null, undefined, 빈 문자열 처리
		if (!apiValue || (typeof apiValue === 'string' && apiValue.trim() === '')) {
			return {
				pcName: '-',
				server: '-',
				status: '-',
				level: '-',
				money: '-',
				items: []
			};
		}

		// 문자열로 변환
		const apiStr = String(apiValue).trim();
		if (apiStr === '') {
			return {
				pcName: '-',
				server: '-',
				status: '-',
				level: '-',
				money: '-',
				items: []
			};
		}

		const parts = apiStr.split('/');
		const result = {
			pcName: '-',
			server: '-',
			status: '-',
			level: '-',
			money: '-',
			items: []
		};

		parts.forEach((part) => {
			if (!part || part.trim() === '') return;
			
			const colonIndex = part.indexOf(':');
			if (colonIndex === -1) return;

			const key = part.substring(0, colonIndex).trim();
			const value = part.substring(colonIndex + 1).trim();

			if (key === 'PC 별명') {
				result.pcName = (value && value !== '') ? value : '-';
			} else if (key === '서버') {
				result.server = (value && value !== '') ? value : '-';
			} else if (key === '현재 상태') {
				result.status = (value && value !== '') ? value : '-';
			} else if (key === '레벨') {
				result.level = (value && value !== '') ? value : '-';
			} else if (key === '보유 금액') {
				result.money = (value && value !== '') ? value : '-';
			} else if (key === '보유 아이템') {
				if (value && value !== '' && value !== '-') {
					result.items = value.split(',').map((i) => i.trim()).filter((i) => i && i !== '');
				} else {
					result.items = [];
				}
			}
		});

		return result;
	}

	async function fetchReferredMembers() {
		if (!currentUser?.email) return;

		loading = true;
		error = null;

		try {
			// 모든 회원을 가져오기 위해 큰 limit 설정 (최대 100,000개)
			const { data, error: fetchError } = await supabase
				.from('user_info')
				.select('email, api_value, api_at')
				.eq('referrer_email', currentUser.email)
				.limit(100000);

			if (fetchError) {
				error = '회원 목록을 불러오는 중 오류가 발생했습니다.';
				return;
			}

			referredMembers = data || [];
		} catch (err) {
			error = '회원 목록을 불러오는 중 오류가 발생했습니다.';
		} finally {
			loading = false;
		}
	}

	onMount(async () => {
		if (browser) {
			user.subscribe(async (u) => {
				currentUser = u;
				if (!u) {
					goto('/login');
				} else {
					// 하위 계정 목록 조회
					await fetchReferredMembers();
				}
			});
		}
	});

	async function handleLogout() {
		await supabase.auth.signOut();
		goto('/login');
	}
</script>

<div class="w-full max-w-[1500px] mx-auto px-4">
	<div class="flex justify-between items-center mb-8">
		<h2 class="text-4xl font-bold text-gray-900">캐릭터 모니터링</h2>
		{#if currentUser}
			<button
				on:click={handleLogout}
				class="px-5 py-2.5 bg-red-500 text-white text-base rounded-lg hover:bg-red-600 transition-colors"
			>
				로그아웃
			</button>
		{/if}
	</div>

	<!-- 통계 섹션 -->
	{#if !loading && !error && referredMembers.length > 0}
		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<h3 class="text-2xl font-semibold mb-4">통계</h3>
			<div class="flex flex-row gap-6 items-start">
				<!-- 아이템별 개수 -->
				<div class="bg-green-50 rounded-lg p-4 w-[300px]">
					<h4 class="text-base font-bold text-gray-600 mb-2 whitespace-nowrap">아이템별 보유 개수</h4>
					<div class="max-h-48 overflow-y-scroll item-scrollbar pr-4" style="scrollbar-width: auto; scrollbar-color: #10b981 #d1fae5;">
						{#if Object.keys(statistics.itemCounts).length === 0}
							<p class="text-gray-500 text-base">보유 아이템이 없습니다.</p>
						{:else}
							<div class="space-y-2">
								{#each Object.entries(statistics.itemCounts).sort((a, b) => b[1] - a[1]) as [item, count]}
									<div class="flex justify-between items-center">
										<span class="text-base text-gray-700 break-words">{item}</span>
										<span class="text-base font-semibold text-green-700 break-words">{count}개</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- 전체 보유 아데나 -->
				<div class="bg-blue-50 rounded-lg p-4 w-[400px] self-start">
					<h4 class="text-base font-bold text-gray-600 mb-2 whitespace-nowrap">전체 보유 아데나</h4>
					<p class="text-3xl font-bold text-blue-700 break-words">{formatMoney(statistics.totalMoney.toString())}원</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- 필터 섹션 -->
	<div class="bg-white rounded-lg shadow-md p-6 mb-6">
		<!-- 첫 번째 줄: 중지 상태, 검색 유형 드롭다운 + 검색어 -->
		<div class="flex gap-6 items-center mb-4">
			<!-- 중지 상태 필터 -->
			<div class="flex items-center">
				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						bind:checked={showStoppedOnly}
						class="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
					/>
					<span class="text-base text-gray-700">중지 상태만 보기</span>
				</label>
			</div>
			
			<!-- 구분선 -->
			<div class="h-6 w-px bg-gray-300"></div>

			<!-- 검색 유형 드롭다운 + 검색어 입력 -->
			<div class="flex items-center gap-2">
				<select
					bind:value={searchFilterType}
					class="px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
				>
					<option value="이메일">이메일</option>
					<option value="아이템">아이템</option>
					<option value="서버">서버</option>
				</select>
				<input
					type="text"
					bind:value={searchFilterTerm}
					placeholder={searchFilterType + ' 검색'}
					class="px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[200px]"
				/>
			</div>
		</div>
		
		<!-- 두 번째 줄: 레벨, 보유 아데나 -->
		<div class="flex gap-6 items-center">
			<!-- 레벨 필터 -->
			<div class="flex items-center gap-2">
				<span class="text-base text-gray-600 whitespace-nowrap">레벨:</span>
				<input
					type="number"
					bind:value={levelFilterValue}
					placeholder="레벨"
					min="0"
					class="px-3 py-2 border border-gray-300 rounded-lg text-base w-20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
				<select
					bind:value={levelFilterType}
					class="px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				>
					<option value="이상">이상</option>
					<option value="이하">이하</option>
				</select>
			</div>
			
			<!-- 구분선 -->
			<div class="h-6 w-px bg-gray-300"></div>
			
			<!-- 보유 아데나 필터 -->
			<div class="flex items-center gap-2">
				<span class="text-base text-gray-600 whitespace-nowrap">보유 아데나:</span>
				<input
					type="number"
					bind:value={adenFilterValue}
					placeholder="아데나"
					min="0"
					class="px-3 py-2 border border-gray-300 rounded-lg text-base w-24 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
				<select
					bind:value={adenFilterType}
					class="px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				>
					<option value="이상">이상</option>
					<option value="이하">이하</option>
				</select>
			</div>
		</div>
	</div>

	<div class="bg-white rounded-lg shadow-md p-6">
		<div class="flex justify-between items-center mb-4">
			<h3 class="text-2xl font-semibold">하위 계정 목록</h3>
			<p class="text-sm text-gray-500 text-right">캐릭터가 사냥 중 마을에 도착해 점검을 할때 수집된 정보를 바탕으로 갱신됩니다</p>
		</div>

		{#if loading}
			<div class="text-center py-8">
				<p class="text-gray-500 text-base">로딩 중...</p>
			</div>
		{:else if error}
			<div class="bg-red-50 border-l-4 border-red-300 p-4 rounded-lg">
				<p class="text-base text-red-700">{error}</p>
			</div>
		{:else if referredMembers.length === 0}
			<div class="text-center py-8">
				<p class="text-gray-500 text-base">하위 회원이 없습니다.</p>
			</div>
		{:else if filteredMembers.length === 0}
			<div class="text-center py-8">
				<p class="text-gray-500 text-base">필터 조건에 맞는 회원이 없습니다.</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full divide-y divide-gray-200" style="min-width: 100%;">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								이메일
							</th>
							<th class="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								PC 별명
							</th>
							<th class="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								서버
							</th>
							<th class="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								현재 상태
							</th>
							<th class="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								레벨
							</th>
							<th class="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								보유 아데나
							</th>
							<th class="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								보유 아이템
							</th>
							<th class="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								갱신 시간
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each filteredMembers as member}
							{@const parsed = parseApiValue(member.api_value)}
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4 text-base font-medium text-gray-900 break-words whitespace-normal">
									{member.email}
								</td>
								<td class="px-6 py-4 text-base text-gray-500 break-words whitespace-normal">
									{parsed.pcName}
								</td>
								<td class="px-6 py-4 text-base text-gray-500 whitespace-nowrap">
									{parsed.server}
								</td>
								<td class="px-6 py-4 text-base text-gray-500 break-words whitespace-normal">
									<div class="flex items-center gap-2">
										{#if parsed.status === '정상'}
											<span class="w-4 h-4 bg-green-500 rounded-full inline-block flex-shrink-0"></span>
										{:else if parsed.status === '중지'}
											<span class="w-4 h-4 bg-red-500 rounded-full inline-block flex-shrink-0"></span>
										{/if}
										<span>{parsed.status}</span>
									</div>
								</td>
								<td class="px-6 py-4 text-base text-gray-500 break-words whitespace-normal">
									{parsed.level}
								</td>
								<td class="px-6 py-4 text-base text-gray-500 break-words whitespace-normal">
									{formatMoney(parsed.money)}
								</td>
								<td class="px-6 py-4 text-base text-gray-500 whitespace-normal">
									{#if parsed.items.length > 0}
										{@const formattedItems = formatItemsWithCount(parsed.items)}
										{@const displayItems = formattedItems.slice(0, 5)}
										{@const remainingCount = formattedItems.length - 5}
										<div class="flex flex-wrap gap-1">
											{#each displayItems as item}
												<span
													class="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm break-words"
												>
													{item}
												</span>
											{/each}
											{#if remainingCount > 0}
												<button
													type="button"
													on:click={() => itemPopupOpen = member.email}
													class="inline-block px-2 py-1 bg-gray-200 text-gray-600 rounded text-sm cursor-pointer hover:bg-gray-300 transition-colors"
												>
													+{remainingCount}
												</button>
											{/if}
										</div>
									{:else}
										-
									{/if}
								</td>
								<td class="px-6 py-4 text-base text-gray-500 whitespace-nowrap">
									{formatDateTime(member.api_at)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="mt-4 text-base text-gray-600">
				총 {filteredMembers.length}명의 회원
				{#if showStoppedOnly || searchFilterTerm || levelFilterValue || adenFilterValue}
					<span class="text-gray-400">(전체 {referredMembers.length}명 중)</span>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- 아이템 팝업 모달 -->
{#if itemPopupOpen}
	{@const popupMember = filteredMembers.find(m => m.email === itemPopupOpen)}
	{@const popupItemsRaw = popupMember ? parseApiValue(popupMember.api_value).items : []}
	{@const popupItems = formatItemsWithCount(popupItemsRaw)}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
		on:click={() => itemPopupOpen = null}
		on:keydown={(e) => e.key === 'Escape' && (itemPopupOpen = null)}
		role="dialog"
		tabindex="-1"
	>
		<div
			class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto"
			on:click|stopPropagation
		>
			<div class="flex justify-between items-center mb-4">
				<h3 class="text-xl font-semibold text-gray-900">보유 아이템 목록</h3>
				<button
					type="button"
					on:click={() => itemPopupOpen = null}
					class="text-gray-400 hover:text-gray-600 transition-colors"
					aria-label="닫기"
				>
					<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
					</svg>
				</button>
			</div>
			<div class="flex flex-wrap gap-2">
				{#if popupItems.length > 0}
					{#each popupItems as item}
						<span
							class="inline-block px-3 py-1.5 bg-blue-100 text-blue-800 rounded text-base break-words"
						>
							{item}
						</span>
					{/each}
				{:else}
					<p class="text-gray-500 text-base">보유 아이템이 없습니다.</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.item-scrollbar::-webkit-scrollbar {
		width: 12px;
		background-color: #d1fae5;
		border-radius: 6px;
	}

	.item-scrollbar::-webkit-scrollbar-thumb {
		background-color: #10b981;
		border-radius: 6px;
		border: 2px solid #d1fae5;
	}

	.item-scrollbar::-webkit-scrollbar-thumb:hover {
		background-color: #059669;
	}

	.item-scrollbar::-webkit-scrollbar-track {
		background-color: #d1fae5;
		border-radius: 6px;
	}
</style>
