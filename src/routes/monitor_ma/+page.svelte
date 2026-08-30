<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { supabase } from '$lib/supabase/client';
	import { fetchAllRows } from '$lib/supabase/fetchAll';
	import { user } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { isZGroupAccount, isMaGroupAccount } from '$lib/utils/groupPrefix';
	import { parseMaSetValue } from '$lib/utils/parseMaSetValue';
	import { formatEmailDisplay } from '$lib/utils/formatEmail';
	import { formatKstMonitorDateTime } from '$lib/utils/formatDateTime';
	import { getKstDateString, getKstPreviousDateString, getKstRecentDateStrings } from '$lib/utils/parseAdena';
	import { aggregateEarnedChartData } from '$lib/utils/fetchEarnedDailyRange';
	import DailyAdenaEarningsChart from '$lib/components/DailyAdenaEarningsChart.svelte';

	let currentUser = null;
	let referredMembers = [];
	let loading = false;
	let error = null;
	
	// 필터 상태
	let showStoppedOnly = false;
	let searchFilterType = '아이템'; // '이메일' | '아이템' | '서버'
	let searchFilterTerm = '';
	let levelFilterValue = '';
	let levelFilterType = '이상'; // '이상' 또는 '이하'
	let adenFilterValue = '';
	let adenFilterType = '이상'; // '이상' 또는 '이하'
	
	// 통계 값 유지용
	let cachedStatistics = { totalMoney: 0, totalStorageMoney: 0, itemCounts: {} };

	// 오늘/어제 보관 메소 순 증가(earned_total) - adena_daily 기반
	let earnedByEmail = {};
	let earnedYesterdayByEmail = {};
	let earnedLoading = false;
	let earnedError = null;
	let earnedStatDate = getKstDateString(); // YYYY-MM-DD (KST)
	$: totalEarnedToday = (filteredMembers || []).reduce((sum, m) => {
		const key = (m?.email || '').trim().toLowerCase();
		return sum + (Number(earnedByEmail?.[key] ?? 0) || 0);
	}, 0);
	$: totalEarnedYesterday = (filteredMembers || []).reduce((sum, m) => {
		const key = (m?.email || '').trim().toLowerCase();
		return sum + (Number(earnedYesterdayByEmail?.[key] ?? 0) || 0);
	}, 0);

	// 최근 7일 수익 차트
	let earnedRangeByDate = {};
	let earnedRangeDates = getKstRecentDateStrings(7);
	let earnedRangeLoading = false;
	let earnedRangeError = null;

	$: filteredEmailSet = new Set(
		(filteredMembers || []).map((m) => (m?.email || '').trim().toLowerCase()).filter(Boolean)
	);

	$: dailyEarningsChartItems = aggregateEarnedChartData(
		earnedRangeByDate,
		earnedRangeDates.length > 0 ? earnedRangeDates : getKstRecentDateStrings(7),
		filteredEmailSet,
		getKstDateString()
	);
	
	function formatMoney(money) {
		if (!money || money === '-') return '-';
		const num = parseInt(money.replace(/,/g, ''), 10);
		if (isNaN(num)) return money;
		return num.toLocaleString('ko-KR');
	}

	function formatEokHint(amount) {
		const n = Number(amount);
		if (!Number.isFinite(n) || n < 100000000) return '';
		return ` ( ${Math.floor(n / 100000000)}억 )`;
	}

	function getMemberEarned(email) {
		const key = (email || '').trim().toLowerCase();
		return Number(earnedByEmail?.[key] ?? 0) || 0;
	}

	function getMemberEarnedYesterday(email) {
		const key = (email || '').trim().toLowerCase();
		return Number(earnedYesterdayByEmail?.[key] ?? 0) || 0;
	}

	function isMissingAvatar(avatar) {
		const v = String(avatar || '').trim();
		return v === '없음' || v === '0';
	}

	function isLowPet(pet) {
		const n = parseInt(String(pet || '').trim(), 10);
		return Number.isFinite(n) && n <= 2;
	}

	function isHighLevelThirdJob(parsed) {
		const level = parseLevelNumber(parsed?.level);
		const job = String(parsed?.job || '').trim();
		return level !== null && level >= 120 && job === '3차';
	}

	function parseLevelNumber(level) {
		if (level === null || level === undefined || level === '-') return null;
		const n = parseInt(String(level).trim(), 10);
		return Number.isFinite(n) ? n : null;
	}

	$: avgEarnedToday = (() => {
		const list = filteredMembers || [];
		const map = earnedByEmail || {};
		let sum = 0;
		let cnt = 0;
		for (const m of list) {
			const key = (m?.email || '').trim().toLowerCase();
			if (!key) continue;
			if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
			const v = Number(map[key]) || 0;
			if (v <= 0) continue;
			sum += v;
			cnt += 1;
		}
		if (!cnt) return null;
		return Math.floor(sum / cnt); // 버림
	})();

	$: avgEarnedYesterday = (() => {
		const list = filteredMembers || [];
		const map = earnedYesterdayByEmail || {};
		let sum = 0;
		let cnt = 0;
		for (const m of list) {
			const key = (m?.email || '').trim().toLowerCase();
			if (!key) continue;
			if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
			const v = Number(map[key]) || 0;
			if (v <= 0) continue;
			sum += v;
			cnt += 1;
		}
		if (!cnt) return null;
		return Math.floor(sum / cnt); // 버림
	})();

	function memberEmails(members) {
		return Array.from(
			new Set((members || []).map((m) => (m?.email || '').trim().toLowerCase()).filter(Boolean))
		);
	}

	async function fetchEarnedBatch(emails, dates) {
		const res = await fetch('/api/adena/earned-batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ emails, dates })
		});
		const payload = await res.json();
		if (!res.ok || !payload?.success) {
			throw new Error(payload?.error || 'earned-batch failed');
		}
		return Array.isArray(payload.rows) ? payload.rows : [];
	}

	async function fetchEarnedTotalsForMembers(members, statDate = getKstDateString()) {
		const emails = memberEmails(members);
		const yesterdayDate = getKstPreviousDateString(statDate);

		earnedLoading = true;
		earnedError = null;

		try {
			const todayMap = {};
			const yesterdayMap = {};
			const rows = emails.length
				? await fetchEarnedBatch(emails, [statDate, yesterdayDate])
				: [];

			rows.forEach((row) => {
				const e = String(row.email || '').trim().toLowerCase();
				if (!e) return;
				const amount = Number(row.earned_total) || 0;
				if (row.stat_date === statDate) {
					todayMap[e] = amount;
				} else if (row.stat_date === yesterdayDate) {
					yesterdayMap[e] = amount;
				}
			});

			earnedByEmail = todayMap;
			earnedYesterdayByEmail = yesterdayMap;
		} catch (e) {
			console.error('earned_total fetch error:', e);
			earnedError = '보관 메소 정보를 불러오는 중 오류가 발생했습니다.';
			earnedByEmail = {};
			earnedYesterdayByEmail = {};
		} finally {
			earnedLoading = false;
		}
	}

	async function fetchEarnedRangeForMembers(members) {
		earnedRangeLoading = true;
		earnedRangeError = null;

		try {
			const emails = memberEmails(members);
			const dates = getKstRecentDateStrings(7);
			const byDate = {};
			for (const d of dates) byDate[d] = {};

			if (emails.length) {
				const rows = await fetchEarnedBatch(emails, dates);
				rows.forEach((row) => {
					const dateKey = row.stat_date;
					const emailKey = String(row.email || '').trim().toLowerCase();
					if (!dateKey || !emailKey || !byDate[dateKey]) return;
					byDate[dateKey][emailKey] = Number(row.earned_total) || 0;
				});
			}

			earnedRangeByDate = byDate;
			earnedRangeDates = dates;
		} catch (e) {
			console.error('earned range fetch error:', e);
			earnedRangeError = '날짜별 보관 메소 차트를 불러오는 중 오류가 발생했습니다.';
			earnedRangeByDate = {};
			earnedRangeDates = getKstRecentDateStrings(7);
		} finally {
			earnedRangeLoading = false;
		}
	}

	// 날짜 변경 시(또는 목록 갱신 후) 선택 날짜의 earned_total 재조회
	$: if (browser && referredMembers && referredMembers.length > 0 && earnedStatDate) {
		// 날짜가 바뀌면 최신 데이터로 갱신
		fetchEarnedTotalsForMembers(referredMembers, earnedStatDate);
	}

	$: if (browser && referredMembers && referredMembers.length > 0) {
		fetchEarnedRangeForMembers(referredMembers);
	}

	// 필터링된 회원 목록 계산
	$: filteredMembers = referredMembers
		.filter((member) => {
			if (!member) return false;
			
			const parsed = getMaDisplay(member);
			const lineage = parseApiValue(member?.api_value);
			
			// 중지 상태 필터
			if (showStoppedOnly && lineage.status !== '중지') {
				return false;
			}

			// 통합 검색 필터 (이메일/아이템/서버)
			if (searchFilterTerm && searchFilterTerm.trim() !== '') {
				const searchTerm = searchFilterTerm.trim().toLowerCase();
				if (searchFilterType === '이메일') {
					const memberEmail = (member.email || '').toLowerCase();
					if (!memberEmail.includes(searchTerm)) return false;
				} else if (searchFilterType === '아이템') {
					const hasItem = lineage.items && lineage.items.some((item) =>
						item && item.toLowerCase().includes(searchTerm)
					);
					if (!hasItem) return false;
				} else if (searchFilterType === '서버') {
					const serverName = lineage.server && lineage.server !== '-'
						? lineage.server.toLowerCase()
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
			
			// 보유 메소 필터
			if (adenFilterValue && adenFilterValue.toString().trim() !== '') {
				const filterAden = parseInt(adenFilterValue.toString().trim().replace(/[^\d]/g, ''), 10);
				if (!isNaN(filterAden) && filterAden >= 0) {
					let memberAden = null;
					if (parsed.meso && parsed.meso !== '-') {
						try {
							let moneyStr = String(parsed.meso).trim();
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
						return false; // 보유 메소가 없는 경우 필터에서 제외
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

	function parseMoneyAmount(value) {
		if (!value || value === '-') return 0;
		try {
			let moneyStr = String(value).trim();
			if (moneyStr === '' || moneyStr === '-') return 0;
			moneyStr = moneyStr.replace(/[^\d]/g, '');
			if (moneyStr === '') return 0;
			const moneyNum = parseInt(moneyStr, 10);
			return !isNaN(moneyNum) && moneyNum >= 0 ? moneyNum : 0;
		} catch (e) {
			return 0;
		}
	}

	// 통계 계산 함수 (필터링된 회원 기준)
	function calculateStatistics() {
		let totalMoney = 0;
		let totalStorageMoney = 0;

		if (!filteredMembers || filteredMembers.length === 0) {
			return {
				totalMoney: 0,
				totalStorageMoney: 0,
				itemCounts: {}
			};
		}

		filteredMembers.forEach((member) => {
			if (!member) return;

			const parsed = getMaDisplay(member);

			totalMoney += parseMoneyAmount(parsed.meso);
		});

		return {
			totalMoney,
			totalStorageMoney,
			itemCounts: {}
		};
	}

	$: {
		if (filteredMembers && filteredMembers.length > 0) {
			const newStats = calculateStatistics();
			if (newStats.totalMoney > 0 || newStats.totalStorageMoney > 0 || Object.keys(newStats.itemCounts).length > 0) {
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
				items: [],
				equipment: []
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
				items: [],
				equipment: []
			};
		}

		const parts = apiStr.split('/');
		const result = {
			pcName: '-',
			server: '-',
			status: '-',
			level: '-',
			money: '-',
			items: [],
			equipment: []
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
			} else if (key === '장착 장비') {
				if (value && value !== '' && value !== '-') {
					result.equipment = value.split(',').map((i) => i.trim()).filter((i) => i && i !== '');
				} else {
					result.equipment = [];
				}
			}
		});

		return result;
	}

	function getMaDisplay(member) {
		return parseMaSetValue(member?.set_value_1);
	}

	async function fetchReferredMembers() {
		if (!currentUser?.email) return;

		loading = true;
		error = null;

		try {
			const { data, error: fetchError } = await fetchAllRows(() =>
				supabase
					.from('user_info')
					.select('email, api_value, api_at, set_value_1, set_value_2, set_value_3')
					.eq('referrer_email', currentUser.email)
					.order('email', { ascending: true })
			);

			if (fetchError) {
				error = '회원 목록을 불러오는 중 오류가 발생했습니다.';
				return;
			}

			referredMembers = data || [];
			await fetchEarnedTotalsForMembers(referredMembers, earnedStatDate);
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
				} else if (isZGroupAccount(u.email)) {
					goto('/monitor_2');
				} else if (!isMaGroupAccount(u.email)) {
					goto('/monitor');
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
			<div class="border-b border-gray-200 pb-6 mb-6">
				<h4 class="text-lg font-semibold text-gray-800 mb-1">날짜별 보관 메소</h4>
				<DailyAdenaEarningsChart
					items={dailyEarningsChartItems}
					loading={earnedRangeLoading}
					error={earnedRangeError}
					currencyLabel="메소"
				/>
			</div>

			<h4 class="text-lg font-semibold text-gray-800 mb-4">합계</h4>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 w-full min-w-0">
				<!-- 전체 보유 메소 -->
				<div class="bg-blue-50 rounded-lg p-4 min-h-[110px] min-w-0">
					<h4 class="text-base font-bold text-gray-600 mb-2 break-words">전체 보유 메소<span class="text-blue-600">{formatEokHint(statistics.totalMoney)}</span></h4>
					<p class="text-3xl font-bold text-blue-700 break-words">
						{formatMoney(statistics.totalMoney.toString())}원
					</p>
				</div>

				<!-- 오늘 획득 메소 총합 -->
				<div class="bg-emerald-50 rounded-lg p-4 min-h-[110px] min-w-0">
					<h4 class="text-base font-bold text-gray-600 mb-2 break-words">오늘 획득 메소<span class="text-blue-600">{earnedLoading ? '' : formatEokHint(totalEarnedToday)}</span></h4>
					<p class="text-3xl font-bold text-emerald-700 break-words">
						{#if earnedLoading}
							-
						{:else}
							{formatMoney(totalEarnedToday.toString())}원
						{/if}
					</p>
				</div>

				<!-- 어제 획득 메소 총합 -->
				<div class="bg-orange-50 rounded-lg p-4 min-h-[110px] min-w-0">
					<h4 class="text-base font-bold text-gray-600 mb-2 break-words">어제 획득 메소<span class="text-blue-600">{earnedLoading ? '' : formatEokHint(totalEarnedYesterday)}</span></h4>
					<p class="text-3xl font-bold text-orange-700 break-words">
						{#if earnedLoading}
							-
						{:else}
							{formatMoney(totalEarnedYesterday.toString())}원
						{/if}
					</p>
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
		
		<!-- 두 번째 줄: 레벨, 보유 메소 -->
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
			
			<!-- 보유 메소 필터 -->
			<div class="flex items-center gap-2">
				<span class="text-base text-gray-600 whitespace-nowrap">보유 메소:</span>
				<input
					type="number"
					bind:value={adenFilterValue}
					placeholder="메소"
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
				<table class="w-max min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								이메일
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								별명
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								레벨
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								직업
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								아바타
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								펫
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								묘묘
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								보유 메소
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								오늘 획득 메소
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								어제 획득 메소
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								상태
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								갱신 시간
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each filteredMembers as member}
							{@const parsed = getMaDisplay(member)}
							{@const lineage = parseApiValue(member?.api_value)}
							{@const highlightJob = isHighLevelThirdJob(parsed)}
							<tr class="hover:bg-gray-50">
								<td class="px-4 py-4 text-base font-medium text-gray-900 whitespace-nowrap">
									{formatEmailDisplay(member.email)}
								</td>
								<td class="px-4 py-4 text-base text-gray-500 whitespace-nowrap">
									{lineage.pcName}
								</td>
								<td class="px-4 py-4 text-base whitespace-nowrap {highlightJob ? 'font-bold text-red-600' : 'text-gray-500'}">
									{parsed.level}
								</td>
								<td class="px-4 py-4 text-base whitespace-nowrap {highlightJob ? 'font-bold text-red-600' : 'text-gray-500'}">
									{parsed.job}
								</td>
								<td class="px-4 py-4 text-base whitespace-nowrap {isMissingAvatar(parsed.avatar) ? 'font-bold text-red-600' : 'text-gray-500'}">
									{parsed.avatar}
								</td>
								<td class="px-4 py-4 text-base whitespace-nowrap {isLowPet(parsed.pet) ? 'font-bold text-red-600' : 'text-gray-500'}">
									{parsed.pet}
								</td>
								<td class="px-4 py-4 text-base whitespace-nowrap {parsed.myomyo === '없음' ? 'font-bold text-red-600' : 'text-gray-500'}">
									{parsed.myomyo}
								</td>
								<td class="px-4 py-4 text-base text-gray-500 whitespace-nowrap">
									{formatMoney(parsed.meso)}
								</td>
								<td class="px-4 py-4 text-base text-violet-700 whitespace-nowrap">
									{#if earnedLoading}
										<span class="text-gray-400">-</span>
									{:else}
										{formatMoney(getMemberEarned(member.email).toString())}
									{/if}
								</td>
								<td class="px-4 py-4 text-base text-indigo-700 whitespace-nowrap">
									{#if earnedLoading}
										<span class="text-gray-400">-</span>
									{:else}
										{formatMoney(getMemberEarnedYesterday(member.email).toString())}
									{/if}
								</td>
								<td class="px-4 py-4 text-base text-gray-500 whitespace-nowrap">
									<div class="flex items-center">
										{#if lineage.status === '정상'}
											<span class="w-4 h-4 bg-green-500 rounded-full inline-block flex-shrink-0" title="정상"></span>
										{:else if lineage.status === '중지'}
											<span class="w-4 h-4 bg-red-500 rounded-full inline-block flex-shrink-0" title="중지"></span>
										{:else}
											<span>{lineage.status}</span>
										{/if}
									</div>
								</td>
								<td class="px-4 py-4 text-base text-gray-500 whitespace-nowrap">
									{formatKstMonitorDateTime(member.api_at)}
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

