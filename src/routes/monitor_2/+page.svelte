<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { supabase } from '$lib/supabase/client';
	import { fetchAllRows } from '$lib/supabase/fetchAll';
	import { subscribeUserEmail } from '$lib/utils/subscribeUserEmail';
	import { user } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { getZGroupPrefix, isMaGroupAccount } from '$lib/utils/groupPrefix';
	import { mergeMemberSetValues } from '$lib/utils/parseSetValue';
	import { hasDisplayList, getDisplayItems, getPopupDisplayItems, aggregateItemCounts } from '$lib/utils/parseItem';
	import { formatEmailDisplay } from '$lib/utils/formatEmail';
	import { formatKstMonitorDateTime } from '$lib/utils/formatDateTime';
	import { getKstDateString, getKstPreviousDateString, getKstRecentDateStrings } from '$lib/utils/parseAdena';
	import { fetchEarnedBatch, fetchEarnedDailyRange, aggregateEarnedChartData } from '$lib/utils/fetchEarnedDailyRange';
	import DailyAdenaEarningsChart from '$lib/components/DailyAdenaEarningsChart.svelte';
	import MemberDailyEarnedPopup from '$lib/components/MemberDailyEarnedPopup.svelte';

	let currentUser = null;
	let referredMembers = [];
	let loading = true;
	let error = null;
	let listTruncated = false;
	let membersFetchInFlight = false;
	
	// 필터 상태
	let showStoppedOnly = false;
	let searchFilterType = '보유 아이템'; // '이메일' | '서버' | '보유 아이템' | '장착 장비'
	let searchFilterTerm = '';
	let itemFilterType = '보유'; // '보유' 또는 '미보유'
	let levelFilterValue = '';
	let levelFilterType = '이상'; // '이상' 또는 '이하'
	let adenFilterValue = '';
	let adenFilterType = '이상'; // '이상' 또는 '이하'
	let sortKey = 'email';
	let sortDir = 'asc';
	
	// 통계 값 유지용
	let cachedStatistics = { totalMoney: 0, totalStorageMoney: 0, itemCounts: {} };

	// 오늘/어제 보유 아데나 순 증가(earned_total) - adena_daily 기반
	let earnedByEmail = {};
	let earnedYesterdayByEmail = {};
	let earnedLoading = false;
	let earnedError = null;
	let earnedStatDate = getKstDateString(); // YYYY-MM-DD (KST)
	$: totalEarnedToday = (filteredMembers || []).reduce((sum, m) => {
		if (isStaleMember(m)) return sum;
		return sum + getMemberEarned(m?.email, m);
	}, 0);

	$: totalEarnedYesterday = (filteredMembers || []).reduce((sum, m) => {
		if (isStaleMember(m)) return sum;
		return sum + getMemberEarnedYesterday(m?.email, m);
	}, 0);

	// 최근 7일 수익 차트
	let earnedRangeByDate = {};
	let earnedRangeDates = getKstRecentDateStrings(7);
	let earnedRangeLoading = false;
	let earnedRangeError = null;

	$: filteredEmailSet = new Set(
		(filteredMembers || [])
			.filter((m) => !isStaleMember(m))
			.map((m) => (m?.email || '').trim().toLowerCase())
			.filter(Boolean)
	);

	$: dailyEarningsChartItems = aggregateEarnedChartData(
		earnedRangeByDate,
		earnedRangeDates.length > 0 ? earnedRangeDates : getKstRecentDateStrings(7),
		filteredEmailSet,
		getKstDateString()
	);
	
	// 아이템/장비 팝업 상태
	let itemPopupMember = null;
	let equipPopupMember = null;
	let earnedPopupEmail = null;

	const STALE_AFTER_DAYS = 11;
	const EMPTY_MEMBER_DISPLAY = {
		pcName: '-',
		server: '-',
		status: '-',
		level: '-',
		money: '-',
		storageMoney: '-',
		huntingGround: '-',
		equipment: [],
		items: []
	};

	function getKstDaysSince(dateTime) {
		if (!dateTime) return null;
		const date = new Date(dateTime);
		if (isNaN(date.getTime())) return null;
		const updateDay = new Date(`${getKstDateString(date)}T12:00:00+09:00`);
		const today = new Date(`${getKstDateString()}T12:00:00+09:00`);
		return Math.floor((today.getTime() - updateDay.getTime()) / 86400000);
	}

	const memberDisplayCache = new WeakMap();
	const memberStaleCache = new WeakMap();

	function isStaleMember(member) {
		if (!member) return false;
		if (memberStaleCache.has(member)) return memberStaleCache.get(member);
		const days = getKstDaysSince(member?.api_at);
		const stale = days !== null && days >= STALE_AFTER_DAYS;
		memberStaleCache.set(member, stale);
		return stale;
	}

	function formatMoney(money) {
		if (!money || money === '-') return '-';
		const num = parseInt(money.replace(/,/g, ''), 10);
		if (isNaN(num)) return money;
		return num.toLocaleString('ko-KR');
	}

	function getMemberEarned(email, member) {
		if (member && isStaleMember(member)) return 0;
		const key = (email || '').trim().toLowerCase();
		return Number(earnedByEmail?.[key] ?? 0) || 0;
	}

	function getMemberEarnedYesterday(email, member) {
		if (member && isStaleMember(member)) return 0;
		const key = (email || '').trim().toLowerCase();
		return Number(earnedYesterdayByEmail?.[key] ?? 0) || 0;
	}

	function resetFilters() {
		showStoppedOnly = false;
		searchFilterType = '보유 아이템';
		searchFilterTerm = '';
		itemFilterType = '보유';
		levelFilterValue = '';
		levelFilterType = '이상';
		adenFilterValue = '';
		adenFilterType = '이상';
	}

	function toggleSort(key) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
			return;
		}
		sortKey = key;
		sortDir = key === 'email' ? 'asc' : 'desc';
	}

	function sortMark(key) {
		if (sortKey !== key) return '';
		return sortDir === 'asc' ? ' ↑' : ' ↓';
	}

	function getSortValue(member, key) {
		if (key === 'earnedToday') return getMemberEarned(member?.email, member);
		if (key === 'earnedYesterday') return getMemberEarnedYesterday(member?.email, member);
		if (key === 'level' || key === 'money') {
			const parsed = getMemberDisplay(member);
			if (key === 'level') return parseLevelNumber(parsed.level) ?? -1;
			return parseMoneyAmount(parsed.money);
		}
		return (member?.email || '').toLowerCase();
	}

	$: hasActiveFilters = !!(
		showStoppedOnly ||
		searchFilterTerm ||
		levelFilterValue ||
		adenFilterValue
	);

	$: accountStatus = (() => {
		let total = 0;
		let running = 0;
		let stopped = 0;
		let stale = 0;
		for (const member of referredMembers || []) {
			if (!member) continue;
			total += 1;
			if (isStaleMember(member)) {
				stale += 1;
				continue;
			}
			const parsed = getMemberDisplay(member);
			if (parsed.status === '중지') stopped += 1;
			else if (parsed.status === '정상') running += 1;
		}
		return { total, running, stopped, stale };
	})();

	function parseLevelNumber(level) {
		if (level === null || level === undefined || level === '-') return null;
		const n = parseInt(String(level).trim(), 10);
		return Number.isFinite(n) ? n : null;
	}

	$: avgLevel = (() => {
		const list = filteredMembers || [];
		let sum = 0;
		let cnt = 0;
		for (const m of list) {
			const parsed = getMemberDisplay(m);
			const lv = parseLevelNumber(parsed?.level);
			if (lv === null || lv === 0) continue;
			sum += lv;
			cnt += 1;
		}
		if (!cnt) return null;
		return Math.round((sum / cnt) * 10) / 10;
	})();

	$: avgEarnedToday = (() => {
		const list = filteredMembers || [];
		const map = earnedByEmail || {};
		let sum = 0;
		let cnt = 0;
		for (const m of list) {
			if (isStaleMember(m)) continue;
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
			if (isStaleMember(m)) continue;
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

	async function fetchEarnedTotalsForMembers(members, statDate = getKstDateString()) {
		const emails = Array.from(
			new Set((members || []).map((m) => (m?.email || '').trim().toLowerCase()).filter(Boolean))
		);
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
				const dateKey = String(row.stat_date || '').slice(0, 10);
				if (dateKey === statDate) {
					todayMap[e] = amount;
				} else if (dateKey === yesterdayDate) {
					yesterdayMap[e] = amount;
				}
			});

			earnedByEmail = todayMap;
			earnedYesterdayByEmail = yesterdayMap;
		} catch (e) {
			console.error('earned_total fetch error:', e);
			earnedError = '획득 아데나 정보를 불러오는 중 오류가 발생했습니다.';
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
			const { byDate, dates } = await fetchEarnedDailyRange(supabase, members, 7);
			earnedRangeByDate = byDate;
			earnedRangeDates = dates;
		} catch (e) {
			console.error('earned range fetch error:', e);
			earnedRangeError = '날짜별 획득 아데나 차트를 불러오는 중 오류가 발생했습니다.';
			earnedRangeByDate = {};
			earnedRangeDates = getKstRecentDateStrings(7);
		} finally {
			earnedRangeLoading = false;
		}
	}

	// 날짜 변경 시(또는 목록 갱신 후) 선택 날짜의 earned_total 재조회
	$: if (browser && referredMembers && referredMembers.length > 0 && earnedStatDate) {
		fetchEarnedTotalsForMembers(referredMembers, earnedStatDate);
	}

	$: if (browser && referredMembers && referredMembers.length > 0) {
		fetchEarnedRangeForMembers(referredMembers);
	}

	// 필터링된 회원 목록 계산
	$: filteredMembers = referredMembers
		.filter((member) => {
			if (!member) return false;

			const hasSearch = !!(searchFilterTerm && searchFilterTerm.trim() !== '');
			const needParsed =
				showStoppedOnly ||
				(hasSearch && searchFilterType !== '이메일') ||
				!!(levelFilterValue && levelFilterValue.toString().trim() !== '') ||
				!!(adenFilterValue && adenFilterValue.toString().trim() !== '');
			const parsed = needParsed ? getMemberDisplay(member) : null;
			
			// 중지 상태 필터
			if (showStoppedOnly && parsed.status !== '중지') {
				return false;
			}

			// 통합 검색 필터 (이메일/서버/보유 아이템/장착 장비)
			if (searchFilterTerm && searchFilterTerm.trim() !== '') {
				const searchTerm = searchFilterTerm.trim().toLowerCase();
				if (searchFilterType === '이메일') {
					const memberEmail = (member.email || '').toLowerCase();
					if (!memberEmail.includes(searchTerm)) return false;
				} else if (searchFilterType === '서버') {
					const serverName = parsed.server && parsed.server !== '-'
						? parsed.server.toLowerCase()
						: '';
					if (!serverName.includes(searchTerm)) return false;
				} else if (searchFilterType === '보유 아이템') {
					const hasItem = getDisplayItems(parsed.items).some((item) =>
						item.toLowerCase().includes(searchTerm)
					);
					if (itemFilterType === '보유' && !hasItem) return false;
					if (itemFilterType === '미보유' && hasItem) return false;
				} else if (searchFilterType === '장착 장비') {
					const hasEquip = getDisplayItems(parsed.equipment).some((item) =>
						item.toLowerCase().includes(searchTerm)
					);
					if (itemFilterType === '보유' && !hasEquip) return false;
					if (itemFilterType === '미보유' && hasEquip) return false;
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
			const valueA = getSortValue(a, sortKey);
			const valueB = getSortValue(b, sortKey);
			const direction = sortDir === 'asc' ? 1 : -1;
			if (typeof valueA === 'string' || typeof valueB === 'string') {
				return String(valueA).localeCompare(String(valueB), 'ko') * direction;
			}
			if (valueA === valueB) {
				return (a.email || '').localeCompare(b.email || '', 'ko');
			}
			return (valueA - valueB) * direction;
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
		const itemCounts = {};

		if (!filteredMembers || filteredMembers.length === 0) {
			return {
				totalMoney: 0,
				totalStorageMoney: 0,
				itemCounts: {}
			};
		}

		filteredMembers.forEach((member) => {
			if (!member) return;

			const parsed = getMemberDisplay(member);

			totalMoney += parseMoneyAmount(parsed.money);
			totalStorageMoney += parseMoneyAmount(parsed.storageMoney);

			// 아이템별 개수 계산 (괄호 안 숫자를 개수로 합산)
			const memberItemCounts = aggregateItemCounts(parsed.items);
			for (const [name, count] of Object.entries(memberItemCounts)) {
				itemCounts[name] = (itemCounts[name] || 0) + count;
			}
		});

		return {
			totalMoney,
			totalStorageMoney,
			itemCounts
		};
	}

	let lastStatsMemberKey = '';

	$: {
		const memberKey = (filteredMembers || []).map((m) => m?.email || '').join('\n');
		if (filteredMembers && filteredMembers.length > 0 && memberKey !== lastStatsMemberKey) {
			lastStatsMemberKey = memberKey;
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

	function getMemberDisplay(member) {
		if (!member) return EMPTY_MEMBER_DISPLAY;
		const cached = memberDisplayCache.get(member);
		if (cached) return cached;
		const display = isStaleMember(member)
			? EMPTY_MEMBER_DISPLAY
			: mergeMemberSetValues(
					parseApiValue(member?.api_value),
					member?.set_value_1,
					member?.set_value_2,
					member?.set_value_3
				);
		memberDisplayCache.set(member, display);
		return display;
	}

	async function fetchReferredMembers() {
		if (!currentUser?.email || membersFetchInFlight) return;

		const prefix = getZGroupPrefix(currentUser.email);
		if (!prefix) return;

		membersFetchInFlight = true;
		loading = true;
		error = null;
		listTruncated = false;

		try {
			const { data, error: fetchError, truncated } = await fetchAllRows(() =>
				supabase
					.from('user_info')
					.select('email, api_value, api_at, set_value_1, set_value_2, set_value_3')
					.like('email', `${prefix}%`)
					.order('email', { ascending: true })
			);

			if (fetchError) {
				error = '회원 목록을 불러오는 중 오류가 발생했습니다.';
				return;
			}

			listTruncated = !!truncated;
			referredMembers = data || [];
			await fetchEarnedTotalsForMembers(referredMembers, earnedStatDate);
		} catch (err) {
			error = '회원 목록을 불러오는 중 오류가 발생했습니다.';
		} finally {
			loading = false;
			membersFetchInFlight = false;
		}
	}

	onMount(() => {
		if (!browser) return;
		return subscribeUserEmail(user, async (u) => {
			currentUser = u;
			if (!u) {
				goto('/login');
			} else if (isMaGroupAccount(u.email)) {
				goto('/monitor_ma');
			} else if (!getZGroupPrefix(u.email)) {
				goto('/monitor');
			} else {
				await fetchReferredMembers();
			}
		});
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
				<h4 class="text-lg font-semibold text-gray-800 mb-1">날짜별 획득 아데나</h4>
				<DailyAdenaEarningsChart
					items={dailyEarningsChartItems}
					loading={earnedRangeLoading}
					error={earnedRangeError}
				/>
			</div>

			<h4 class="text-lg font-semibold text-gray-800 mb-4">요약</h4>
			<div class="flex flex-row gap-4 items-start w-full min-w-0">
				<!-- 아이템별 개수 -->
				<div class="bg-green-50 rounded-lg p-4 w-[32%] max-w-[420px] min-w-0 shrink">
					<h4 class="text-base font-bold text-gray-600 mb-2">아이템별 보유 개수</h4>
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

				<div class="flex flex-col gap-4 flex-1 min-w-0 w-full">
					<div class="grid grid-cols-3 gap-4">
						<div class="bg-blue-50 rounded-lg p-4 min-h-[110px] min-w-0">
							<h4 class="text-base font-bold text-gray-600 mb-2 break-words">전체 보유 아데나</h4>
							<p class="text-2xl font-bold text-blue-700 whitespace-nowrap">
								{formatMoney(statistics.totalMoney.toString())}
							</p>
						</div>

						<div class="bg-emerald-50 rounded-lg p-4 min-h-[110px] min-w-0">
							<h4 class="text-base font-bold text-gray-600 mb-2 break-words">오늘 획득 합계</h4>
							<p class="text-2xl font-bold text-emerald-700 whitespace-nowrap">
								{formatMoney(totalEarnedToday.toString())}
							</p>
							<p class="text-xs text-gray-500 mt-1">현재 진행 중</p>
						</div>

						<div class="bg-orange-50 rounded-lg p-4 min-h-[110px] min-w-0">
							<h4 class="text-base font-bold text-gray-600 mb-2 break-words">어제 획득 합계</h4>
							<p class="text-2xl font-bold text-orange-700 whitespace-nowrap">
								{formatMoney(totalEarnedYesterday.toString())}
							</p>
						</div>
					</div>

					<div class="grid grid-cols-3 gap-4">
						<div class="bg-slate-50 rounded-lg p-4 min-h-[110px] min-w-0">
							<h4 class="text-base font-bold text-gray-600 mb-2 leading-snug break-words">평균 레벨</h4>
							<p class="text-2xl font-bold text-slate-800 whitespace-nowrap">
								{#if avgLevel === null}-{:else}{avgLevel}{/if}
							</p>
						</div>

						<div class="bg-emerald-50 rounded-lg p-4 min-h-[110px] min-w-0">
							<h4 class="text-base font-bold text-gray-600 mb-2 leading-snug break-words">오늘 평균 획득</h4>
							<p class="text-2xl font-bold text-emerald-700 whitespace-nowrap">
								{#if avgEarnedToday === null}-{:else}{formatMoney(avgEarnedToday.toString())}{/if}
							</p>
							<p class="text-xs text-gray-500 mt-1">현재 진행 중</p>
						</div>

						<div class="bg-orange-50 rounded-lg p-4 min-h-[110px] min-w-0">
							<h4 class="text-base font-bold text-gray-600 mb-2 leading-snug break-words">어제 평균 획득</h4>
							<p class="text-2xl font-bold text-orange-700 whitespace-nowrap">
								{#if avgEarnedYesterday === null}-{:else}{formatMoney(avgEarnedYesterday.toString())}{/if}
							</p>
						</div>
					</div>
				</div>

			</div>
		</div>
	{/if}

	<!-- 필터 섹션 -->
	<div class="bg-white rounded-lg shadow-md p-6 mb-6">
		<!-- 첫 번째 줄: 문제 계정, 레벨, 보유 아데나 -->
		<div class="flex flex-wrap gap-6 items-center mb-4">
			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					bind:checked={showStoppedOnly}
					class="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
				/>
				<span class="text-base text-gray-700">중지 상태만 보기</span>
			</label>
			
			<div class="h-6 w-px bg-gray-300"></div>

			<!-- 레벨 필터 -->
			<div class="flex items-center gap-2">
				<span class="text-base text-gray-600 whitespace-nowrap">레벨:</span>
				<input
					type="text"
					inputmode="numeric"
					bind:value={levelFilterValue}
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
			
			<div class="h-6 w-px bg-gray-300"></div>
			
			<!-- 보유 아데나 필터 -->
			<div class="flex items-center gap-2">
				<span class="text-base text-gray-600 whitespace-nowrap">보유 아데나:</span>
				<input
					type="text"
					inputmode="numeric"
					bind:value={adenFilterValue}
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

			<button
				type="button"
				on:click={resetFilters}
				disabled={!hasActiveFilters}
				class="ml-auto px-3 py-2 border border-gray-300 rounded-lg text-base text-gray-700 bg-white hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
			>
				필터 초기화
			</button>
		</div>
		
		<!-- 두 번째 줄: 통합 검색 -->
		<div class="flex items-center gap-2">
			<select
				bind:value={searchFilterType}
				class="px-3 py-2 border border-gray-400 rounded-lg text-base font-medium text-gray-800 bg-gray-100 hover:bg-gray-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
			>
				<option value="이메일">이메일</option>
				<option value="서버">서버</option>
				<option value="보유 아이템">보유 아이템</option>
				<option value="장착 장비">장착 장비</option>
			</select>
			<input
				type="text"
				bind:value={searchFilterTerm}
				placeholder={searchFilterType + ' 검색'}
				class="px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[200px]"
			/>
			{#if searchFilterType === '보유 아이템' || searchFilterType === '장착 장비'}
				<select
					bind:value={itemFilterType}
					class="px-3 py-2 border border-gray-400 rounded-lg text-base font-medium text-gray-800 bg-gray-100 hover:bg-gray-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				>
					<option value="보유">보유</option>
					<option value="미보유">미보유</option>
				</select>
			{/if}
		</div>
	</div>

	<div class="bg-white rounded-lg shadow-md px-6 py-3 mb-6">
		<p class="text-base text-gray-800 whitespace-nowrap flex items-center gap-x-10">
			<span>전체 {accountStatus.total}</span>
			<span>동작 {accountStatus.running}</span>
			<span>중지 {accountStatus.stopped}</span>
			<span>장기 미접속 {accountStatus.stale}</span>
		</p>
	</div>

	<div class="bg-white rounded-lg shadow-md p-6">
		<div class="flex justify-between items-center mb-4">
			<h3 class="text-2xl font-semibold">그룹 계정 목록</h3>
			<div class="text-sm text-gray-500 text-right">
				<p>수집된 정보는 약 1시간 주기로 업데이트 됩니다</p>
				<p>이메일을 클릭하면 일별 획득 내역을 확인 할 수 있습니다</p>
			</div>
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
				<p class="text-gray-500 text-base">그룹 계정이 없습니다.</p>
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
								<button type="button" class="hover:text-gray-800" on:click={() => toggleSort('email')}>이메일{sortMark('email')}</button>
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								PC 별명
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								서버
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								상태
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								<button type="button" class="hover:text-gray-800" on:click={() => toggleSort('level')}>레벨{sortMark('level')}</button>
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								<button type="button" class="hover:text-gray-800" on:click={() => toggleSort('money')}>보유{sortMark('money')}</button>
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								<button type="button" class="hover:text-gray-800" on:click={() => toggleSort('earnedToday')}>오늘 획득{sortMark('earnedToday')}</button>
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								<button type="button" class="hover:text-gray-800" on:click={() => toggleSort('earnedYesterday')}>어제 획득{sortMark('earnedYesterday')}</button>
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								사냥터
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								장착 장비
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								보유 아이템
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								갱신 시간
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each filteredMembers as member (member.email)}
							{@const parsed = getMemberDisplay(member)}
							<tr class="hover:bg-gray-50">
								<td class="px-4 py-4 text-base font-medium text-gray-900 whitespace-nowrap">
									<button
										type="button"
										on:click={() => earnedPopupEmail = member.email}
										class="text-blue-700 hover:text-blue-900 hover:underline"
									>
										{formatEmailDisplay(member.email)}
									</button>
								</td>
								<td class="px-4 py-4 text-base text-gray-500 whitespace-nowrap">
									{parsed.pcName}
								</td>
								<td class="px-4 py-4 text-base text-gray-500 whitespace-nowrap">
									{parsed.server}
								</td>
								<td class="px-4 py-4 text-base text-gray-500 whitespace-nowrap">
									<div class="flex items-center">
										{#if parsed.status === '정상'}
											<span class="w-4 h-4 bg-green-500 rounded-full inline-block flex-shrink-0" title="정상"></span>
										{:else if parsed.status === '중지'}
											<span class="w-4 h-4 bg-red-500 rounded-full inline-block flex-shrink-0" title="중지"></span>
										{:else}
											<span>{parsed.status}</span>
										{/if}
									</div>
								</td>
								<td class="px-4 py-4 text-base text-gray-500 whitespace-nowrap">
									{parsed.level}
								</td>
								<td class="px-4 py-4 text-base text-gray-500 whitespace-nowrap">
									{formatMoney(parsed.money)}
								</td>
								<td class="px-4 py-4 text-base text-violet-700 whitespace-nowrap">
									{#if earnedLoading || isStaleMember(member)}
										<span class="text-gray-400">-</span>
									{:else}
										{formatMoney(getMemberEarned(member.email, member).toString())}
									{/if}
								</td>
								<td class="px-4 py-4 text-base text-indigo-700 whitespace-nowrap">
									{#if earnedLoading || isStaleMember(member)}
										<span class="text-gray-400">-</span>
									{:else}
										{formatMoney(getMemberEarnedYesterday(member.email, member).toString())}
									{/if}
								</td>
								<td class="px-4 py-4 text-base text-gray-500 whitespace-nowrap">
									{parsed.huntingGround && parsed.huntingGround !== '-' ? parsed.huntingGround : '-'}
								</td>
								<td class="px-4 py-4 text-base text-gray-500 whitespace-nowrap">
									{#if hasDisplayList(parsed.equipment)}
										<button
											type="button"
											on:click={() => equipPopupMember = member}
											class="px-3 py-1.5 bg-purple-100 text-purple-800 rounded text-sm cursor-pointer hover:bg-purple-200 transition-colors whitespace-nowrap"
										>
											자세히 보기
										</button>
									{:else}
										<span class="text-gray-400 whitespace-nowrap">확인 대기중</span>
									{/if}
								</td>
								<td class="px-4 py-4 text-base text-gray-500 whitespace-nowrap">
									{#if hasDisplayList(parsed.items)}
										<button
											type="button"
											on:click={() => itemPopupMember = member}
											class="px-3 py-1.5 bg-blue-100 text-blue-800 rounded text-sm cursor-pointer hover:bg-blue-200 transition-colors whitespace-nowrap"
										>
											자세히 보기
										</button>
									{:else}
										<span class="text-gray-400 whitespace-nowrap">확인 대기중</span>
									{/if}
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
				{#if listTruncated}
					<span class="text-amber-600"> · 목록이 많아 일부만 표시합니다</span>
				{/if}
				{#if hasActiveFilters}
					<span class="text-gray-400">(전체 {referredMembers.length}명 중)</span>
				{/if}
			</div>
		{/if}
	</div>
</div>

{#if earnedPopupEmail}
	<MemberDailyEarnedPopup
		email={earnedPopupEmail}
		onClose={() => earnedPopupEmail = null}
	/>
{/if}

<!-- 장착 장비 팝업 모달 -->
{#if equipPopupMember}
	{@const popupEquipment = getDisplayItems(getMemberDisplay(equipPopupMember).equipment)}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
		on:click={() => equipPopupMember = null}
		on:keydown={(e) => e.key === 'Escape' && (equipPopupMember = null)}
		role="dialog"
		tabindex="-1"
	>
		<div
			class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto"
			on:click|stopPropagation
		>
			<div class="flex justify-between items-center mb-4">
				<h3 class="text-xl font-semibold text-gray-900">장착 장비 목록</h3>
				<button
					type="button"
					on:click={() => equipPopupMember = null}
					class="text-gray-400 hover:text-gray-600 transition-colors"
					aria-label="닫기"
				>
					<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
					</svg>
				</button>
			</div>
			<div class="flex flex-wrap gap-2">
				{#if popupEquipment.length > 0}
					{#each popupEquipment as equip}
						<span
							class="inline-block px-3 py-1.5 bg-purple-100 text-purple-800 rounded text-base break-words"
						>
							{equip}
						</span>
					{/each}
				{:else}
					<p class="text-gray-500 text-base">장착 장비가 없습니다.</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- 아이템 팝업 모달 -->
{#if itemPopupMember}
	{@const popupItems = getPopupDisplayItems(getMemberDisplay(itemPopupMember).items)}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
		on:click={() => itemPopupMember = null}
		on:keydown={(e) => e.key === 'Escape' && (itemPopupMember = null)}
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
					on:click={() => itemPopupMember = null}
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
