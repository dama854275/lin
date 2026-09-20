<script>
	import { onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { supabase } from '$lib/supabase/client';
	import { fetchAllRows } from '$lib/supabase/fetchAll';
	import { subscribeUserEmail } from '$lib/utils/subscribeUserEmail';
	import { user } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { isZGroupAccount, isMaGroupAccount } from '$lib/utils/groupPrefix';
	import { mergeMemberSetValues } from '$lib/utils/parseSetValue';
	import { hasDisplayList, getDisplayItems, getPopupDisplayItems, aggregateItemCounts } from '$lib/utils/parseItem';
	import { formatEmailDisplay } from '$lib/utils/formatEmail';
	import { formatKstMonitorDateTime, formatAccountExpireDate, isAccountExpireSoon } from '$lib/utils/formatDateTime';
	import { getKstDateString, getKstPreviousDateString, getKstRecentDateStrings, getKstMonthDateStrings } from '$lib/utils/parseAdena';
	import { fetchEarnedBatch, fetchEarnedDailyRange, aggregateEarnedChartData, EARNED_CHART_DAYS } from '$lib/utils/fetchEarnedDailyRange';
	// import { fetchLastIncreaseBatch } from '$lib/utils/fetchEarnedDailyRange';
	import DailyAdenaEarningsChart from '$lib/components/DailyAdenaEarningsChart.svelte';
	import MemberDailyEarnedPopup from '$lib/components/MemberDailyEarnedPopup.svelte';
	import MonitorNotice from '$lib/components/MonitorNotice.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

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
	// let lastIncreaseByEmail = {};
	let earnedLoading = false;
	// let lastIncreaseLoading = false;
	let earnedError = null;
	let earnedStatDate = getKstDateString(); // YYYY-MM-DD (KST)
	function sumEarnedFromMap(members, map) {
		let sum = 0;
		for (const m of members || []) {
			if (isStaleMember(m)) continue;
			const key = (m?.email || '').trim().toLowerCase();
			if (!key) continue;
			sum += Number(map?.[key] ?? 0) || 0;
		}
		return sum;
	}

	$: totalEarnedToday = sumEarnedFromMap(filteredMembers, earnedByEmail);
	$: totalEarnedYesterday = sumEarnedFromMap(filteredMembers, earnedYesterdayByEmail);

	// 최근 30일 수익 차트
	let earnedRangeByDate = {};
	let earnedRangeDates = getKstRecentDateStrings(EARNED_CHART_DAYS);
	let earnedRangeLoading = false;
	let earnedRangeError = null;
	let chartRangeMode = 'recent';
	let chartYearMonth = '';

	$: filteredEmailSet = new Set(
		(filteredMembers || [])
			.filter((m) => !isStaleMember(m))
			.map((m) => (m?.email || '').trim().toLowerCase())
			.filter(Boolean)
	);

	$: dailyEarningsChartItems = aggregateEarnedChartData(
		earnedRangeByDate,
		earnedRangeDates.length > 0 ? earnedRangeDates : getKstRecentDateStrings(EARNED_CHART_DAYS),
		filteredEmailSet,
		getKstDateString()
	);
	
	// 아이템/장비 팝업 상태
	let itemPopupMember = null;
	let equipPopupMember = null;
	let earnedPopupEmail = null;
	let memberListScroller = null;
	let canScrollMemberListLeft = false;
	let canScrollMemberListRight = false;

	const STALE_AFTER_DAYS = 11;
	const EMPTY_MEMBER_DISPLAY = {
		pcName: '-',
		server: '-',
		status: '-',
		level: '-',
		money: '-',
		storageMoney: '-',
		hourlyKill: '-',
		hourlyAdena: '-',
		huntingGround: '-',
		remainPeriod: '',
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

	function isPendingDisplayValue(value) {
		const s = String(value ?? '').trim();
		return !s || s === '-' || s === '확인 대기중';
	}

	function formatLevel(level) {
		return isPendingDisplayValue(level) ? '-' : String(level).trim();
	}

	function formatMoney(money) {
		if (isPendingDisplayValue(money)) return '-';
		const num = parseInt(String(money).replace(/,/g, ''), 10);
		if (isNaN(num)) return '-';
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

	// function getMemberLastIncrease(email, member) {
	// 	if (member && isStaleMember(member)) return 0;
	// 	const key = (email || '').trim().toLowerCase();
	// 	return Number(lastIncreaseByEmail?.[key] ?? 0) || 0;
	// }

	function updateMemberListScrollState() {
		const el = memberListScroller;
		if (!el) {
			canScrollMemberListLeft = false;
			canScrollMemberListRight = false;
			return;
		}
		const maxScroll = el.scrollWidth - el.clientWidth;
		canScrollMemberListLeft = el.scrollLeft > 1;
		canScrollMemberListRight = maxScroll > 1 && el.scrollLeft < maxScroll - 1;
	}

	function scrollMemberList(direction) {
		if (!memberListScroller) return;
		const el = memberListScroller;
		const left = direction < 0 ? 0 : el.scrollWidth - el.clientWidth;
		el.scrollTo({ left, behavior: 'smooth' });
	}

	$: if (browser && memberListScroller && filteredMembers) {
		tick().then(updateMemberListScrollState);
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
		// if (key === 'lastIncrease') return Number(lastIncreaseByEmail?.[(member?.email || '').trim().toLowerCase()] ?? 0) || 0;
		if (key === 'level' || key === 'money' || key === 'hourlyKill' || key === 'hourlyAdena') {
			const parsed = getMemberDisplay(member);
			if (key === 'level') return parseLevelNumber(parsed.level) ?? -1;
			if (key === 'hourlyKill') return parseMoneyAmount(parsed.hourlyKill);
			if (key === 'hourlyAdena') return parseMoneyAmount(parsed.hourlyAdena);
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

	// async function fetchLastIncreasesForMembers(members) {
	// 	const emails = Array.from(
	// 		new Set((members || []).map((m) => (m?.email || '').trim().toLowerCase()).filter(Boolean))
	// 	);
	//
	// 	lastIncreaseLoading = true;
	// 	try {
	// 		const rows = emails.length ? await fetchLastIncreaseBatch(emails) : [];
	// 		const map = {};
	// 		rows.forEach((row) => {
	// 			const e = String(row.email || '').trim().toLowerCase();
	// 			if (!e) return;
	// 			map[e] = Number(row.last_increase) || 0;
	// 		});
	// 		lastIncreaseByEmail = map;
	// 	} catch (e) {
	// 		console.error('last_increase fetch error:', e);
	// 		lastIncreaseByEmail = {};
	// 	} finally {
	// 		lastIncreaseLoading = false;
	// 	}
	// }

	async function fetchEarnedRangeForMembers(members, datesOverride = null) {
		earnedRangeLoading = true;
		earnedRangeError = null;

		try {
			const dates =
				Array.isArray(datesOverride) && datesOverride.length > 0
					? datesOverride
					: getKstRecentDateStrings(EARNED_CHART_DAYS);
			const { byDate } = await fetchEarnedDailyRange(supabase, members, EARNED_CHART_DAYS, dates);
			earnedRangeByDate = byDate;
			earnedRangeDates = dates;
		} catch (e) {
			console.error('earned range fetch error:', e);
			earnedRangeError = '날짜별 획득 아데나 차트를 불러오는 중 오류가 발생했습니다.';
			earnedRangeByDate = {};
			earnedRangeDates = getKstRecentDateStrings(EARNED_CHART_DAYS);
		} finally {
			earnedRangeLoading = false;
		}
	}

	async function handleChartRangeChange(event) {
		const mode = event?.detail?.mode === 'month' ? 'month' : 'recent';
		const yearMonth = mode === 'month' ? String(event?.detail?.yearMonth || '').slice(0, 7) : '';
		chartRangeMode = mode;
		chartYearMonth = yearMonth;
		const dates =
			mode === 'month' && yearMonth
				? getKstMonthDateStrings(yearMonth)
				: getKstRecentDateStrings(EARNED_CHART_DAYS);
		await fetchEarnedRangeForMembers(referredMembers, dates);
	}

	// 날짜 변경 시(또는 목록 갱신 후) 선택 날짜의 earned_total 재조회
	$: if (browser && referredMembers && referredMembers.length > 0 && earnedStatDate) {
		// 날짜가 바뀌면 최신 데이터로 갱신
		fetchEarnedTotalsForMembers(referredMembers, earnedStatDate);
	}

	$: if (browser && referredMembers && referredMembers.length > 0) {
		fetchEarnedRangeForMembers(referredMembers);
		// fetchLastIncreasesForMembers(referredMembers);
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

		membersFetchInFlight = true;
		loading = true;
		error = null;
		listTruncated = false;

		try {
			const { data, error: fetchError, truncated } = await fetchAllRows(() =>
				supabase
					.from('user_info')
					.select('email, api_value, api_at, set_value_1, set_value_2, set_value_3, product_period')
					.eq('referrer_email', currentUser.email)
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
		const onResize = () => updateMemberListScrollState();
		window.addEventListener('resize', onResize);
		const unsubscribe = subscribeUserEmail(user, async (u) => {
			currentUser = u;
			if (!u) {
				goto('/login');
			} else if (isZGroupAccount(u.email)) {
				goto('/monitor_2');
			} else if (isMaGroupAccount(u.email)) {
				goto('/monitor_ma');
			} else {
				await fetchReferredMembers();
			}
		});
		return () => {
			window.removeEventListener('resize', onResize);
			if (typeof unsubscribe === 'function') unsubscribe();
		};
	});

	async function handleLogout() {
		await supabase.auth.signOut();
		goto('/login');
	}
</script>

<div class="monitor-page w-full max-w-[1500px] mx-auto px-2 sm:px-4">
	<div class="flex flex-col gap-3 mb-6 md:mb-8 sm:flex-row sm:justify-between sm:items-center">
		<h2 class="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">캐릭터 모니터링</h2>
		<div class="flex items-center gap-2 sm:gap-3">
			<ThemeToggle />
			{#if currentUser}
				<button
					on:click={handleLogout}
					class="px-3 py-2 sm:px-5 sm:py-2.5 bg-red-500 text-white text-sm sm:text-base rounded-lg hover:bg-red-600 transition-colors"
				>
					로그아웃
				</button>
			{/if}
		</div>
	</div>

	<!-- 통계 섹션 -->
	{#if !loading && !error && referredMembers.length > 0}
		<div class="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
			<div class="border-b border-gray-200 pb-6 mb-6">
				<DailyAdenaEarningsChart
					items={dailyEarningsChartItems}
					loading={earnedRangeLoading}
					error={earnedRangeError}
					showRangeControls={true}
					rangeMode={chartRangeMode}
					selectedYearMonth={chartYearMonth}
					on:rangechange={handleChartRangeChange}
				/>
			</div>

			<h4 class="text-base md:text-lg font-semibold text-gray-800 mb-4">요약</h4>
			<div class="flex flex-col md:flex-row gap-4 items-stretch md:items-start w-full min-w-0">
				<!-- 아이템별 개수 -->
				<div class="bg-green-100 rounded-lg p-3 md:p-4 w-full md:w-[32%] md:max-w-[420px] min-w-0 shrink">
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

				<div class="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 flex-1 min-w-0 w-full">
						<div class="order-1 md:order-1 bg-blue-100 rounded-lg p-3 md:p-4 min-h-0 md:min-h-[110px] min-w-0">
							<h4 class="text-base font-bold text-gray-600 mb-2 break-words">전체 보유 아데나</h4>
							<p class="text-xl md:text-2xl font-bold text-blue-700 whitespace-nowrap">
								{formatMoney(statistics.totalMoney.toString())}
							</p>
						</div>

						<div class="order-3 md:order-2 bg-emerald-100 rounded-lg p-3 md:p-4 min-h-0 md:min-h-[110px] min-w-0">
							<h4 class="text-base font-bold text-gray-600 mb-2 break-words">오늘 획득 합계</h4>
							<p class="text-xl md:text-2xl font-bold text-emerald-700 whitespace-nowrap">
								{formatMoney(totalEarnedToday.toString())}
							</p>
							<p class="text-xs text-gray-500 mt-1">현재 진행 중</p>
						</div>

						<div class="order-5 md:order-3 bg-orange-100 rounded-lg p-3 md:p-4 min-h-0 md:min-h-[110px] min-w-0">
							<h4 class="text-base font-bold text-gray-600 mb-2 break-words">어제 획득 합계</h4>
							<p class="text-xl md:text-2xl font-bold text-orange-700 whitespace-nowrap">
								{formatMoney(totalEarnedYesterday.toString())}
							</p>
						</div>

						<div class="order-2 md:order-4 bg-slate-100 rounded-lg p-3 md:p-4 min-h-0 md:min-h-[110px] min-w-0">
							<h4 class="text-base font-bold text-gray-600 mb-2 leading-snug break-words">평균 레벨</h4>
							<p class="text-xl md:text-2xl font-bold text-slate-800 whitespace-nowrap">
								{#if avgLevel === null}-{:else}{avgLevel}{/if}
							</p>
						</div>

						<div class="order-4 md:order-5 bg-emerald-100 rounded-lg p-3 md:p-4 min-h-0 md:min-h-[110px] min-w-0">
							<h4 class="text-base font-bold text-gray-600 mb-2 leading-snug break-words">오늘 평균 획득</h4>
							<p class="text-xl md:text-2xl font-bold text-emerald-700 whitespace-nowrap">
								{#if avgEarnedToday === null}-{:else}{formatMoney(avgEarnedToday.toString())}{/if}
							</p>
							<p class="text-xs text-gray-500 mt-1">현재 진행 중</p>
						</div>

						<div class="order-6 md:order-6 bg-orange-100 rounded-lg p-3 md:p-4 min-h-0 md:min-h-[110px] min-w-0">
							<h4 class="text-base font-bold text-gray-600 mb-2 leading-snug break-words">어제 평균 획득</h4>
							<p class="text-xl md:text-2xl font-bold text-orange-700 whitespace-nowrap">
								{#if avgEarnedYesterday === null}-{:else}{formatMoney(avgEarnedYesterday.toString())}{/if}
							</p>
						</div>
				</div>

			</div>
		</div>
	{/if}

	<MonitorNotice />

	<div class="flex flex-wrap items-center gap-3 mb-4">
		<div class="status-chip status-chip-run flex items-baseline gap-2 rounded-lg bg-emerald-50 px-3 py-2 border-2 border-emerald-300">
			<span class="text-sm font-medium text-emerald-600">동작</span>
			<span class="text-lg font-bold text-emerald-700">{accountStatus.running}</span>
		</div>
		<div class="status-chip status-chip-stop flex items-baseline gap-2 rounded-lg bg-red-50 px-3 py-2 border-2 border-red-300">
			<span class="text-sm font-medium text-red-600">중지</span>
			<span class="text-lg font-bold text-red-700">{accountStatus.stopped}</span>
		</div>
		<div class="status-chip status-chip-stale flex items-baseline gap-2 rounded-lg bg-amber-50 px-3 py-2 border-2 border-amber-300">
			<span class="text-sm font-medium text-amber-600">장기 미접속</span>
			<span class="text-lg font-bold text-amber-700">{accountStatus.stale}</span>
		</div>
	</div>

	<!-- 필터 섹션 -->
	<div class="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6 min-w-0 overflow-hidden">
		<!-- 첫 번째 줄: 문제 계정, 레벨, 보유 아데나 -->
		<div class="flex flex-col md:flex-row md:flex-wrap gap-3 md:gap-6 md:items-center mb-4 min-w-0">
			<label class="flex items-center gap-2 cursor-pointer w-full md:w-auto">
				<input
					type="checkbox"
					bind:checked={showStoppedOnly}
					class="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
				/>
				<span class="text-base text-gray-700">중지 상태만 보기</span>
			</label>
			
			<div class="hidden md:block h-6 w-px bg-gray-300"></div>

			<!-- 레벨 필터 -->
			<div class="flex items-center gap-2 min-w-0 w-full md:w-auto">
				<span class="text-base text-gray-600 whitespace-nowrap shrink-0">레벨:</span>
				<input
					type="text"
					inputmode="numeric"
					bind:value={levelFilterValue}
					class="px-3 py-2 border border-gray-300 rounded-lg text-base w-full min-w-0 md:w-20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
				<select
					bind:value={levelFilterType}
					class="px-3 py-2 border border-gray-300 rounded-lg text-base shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				>
					<option value="이상">이상</option>
					<option value="이하">이하</option>
				</select>
			</div>
			
			<div class="hidden md:block h-6 w-px bg-gray-300"></div>
			
			<!-- 보유 아데나 필터 -->
			<div class="flex items-center gap-2 min-w-0 w-full md:w-auto">
				<span class="text-base text-gray-600 whitespace-nowrap shrink-0">보유 아데나:</span>
				<input
					type="text"
					inputmode="numeric"
					bind:value={adenFilterValue}
					class="px-3 py-2 border border-gray-300 rounded-lg text-base w-full min-w-0 md:w-24 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
				<select
					bind:value={adenFilterType}
					class="px-3 py-2 border border-gray-300 rounded-lg text-base shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				>
					<option value="이상">이상</option>
					<option value="이하">이하</option>
				</select>
			</div>

			<button
				type="button"
				on:click={resetFilters}
				disabled={!hasActiveFilters}
				class="w-full md:w-auto md:ml-auto px-3 py-2 border border-gray-300 rounded-lg text-base text-gray-700 bg-white hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
			>
				필터 초기화
			</button>
		</div>
		
		<!-- 두 번째 줄: 통합 검색 -->
		<div class="flex flex-col md:flex-row md:items-center gap-2 min-w-0">
			<select
				bind:value={searchFilterType}
				class="w-full md:w-auto shrink-0 px-3 py-2 border border-gray-400 rounded-lg text-base font-medium text-gray-800 bg-gray-100 hover:bg-gray-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
				class="w-full min-w-0 md:w-[220px] md:flex-none px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
			/>
			{#if searchFilterType === '보유 아이템' || searchFilterType === '장착 장비'}
				<select
					bind:value={itemFilterType}
					class="w-full md:w-auto shrink-0 px-3 py-2 border border-gray-400 rounded-lg text-base font-medium text-gray-800 bg-gray-100 hover:bg-gray-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				>
					<option value="보유">보유</option>
					<option value="미보유">미보유</option>
				</select>
			{/if}
		</div>
	</div>

	<div class="bg-white rounded-lg shadow-md p-6">
		<div class="grid grid-cols-3 items-center mb-4 gap-3">
			<h3 class="text-lg md:text-2xl font-semibold justify-self-start">하위 계정 목록</h3>
			<div class="justify-self-center inline-flex items-center gap-2">
					<button
						type="button"
						on:click={() => scrollMemberList(-1)}
						disabled={!canScrollMemberListLeft}
						class="member-scroll-btn {canScrollMemberListLeft ? 'is-on' : 'is-off'}"
						aria-label="목록 왼쪽으로 스크롤"
					>
						<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.83 10l3.94 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
						</svg>
					</button>
					<button
						type="button"
						on:click={() => scrollMemberList(1)}
						disabled={!canScrollMemberListRight}
						class="member-scroll-btn {canScrollMemberListRight ? 'is-on' : 'is-off'}"
						aria-label="목록 오른쪽으로 스크롤"
					>
						<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.17 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
						</svg>
					</button>
			</div>
			<div></div>
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
			<div class="overflow-x-auto" bind:this={memberListScroller} on:scroll={updateMemberListScrollState}>
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
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-px">
								상태
							</th>
							<th class="pl-3 pr-4 py-3 text-left text-sm font-medium text-gray-500 whitespace-nowrap w-px">
								<button type="button" class="hover:text-gray-800" on:click={() => toggleSort('level')}>레벨{sortMark('level')}</button>
							</th>
							<th class="pl-4 pr-3 py-3 text-left text-sm font-medium text-gray-500 whitespace-nowrap w-px">
								<button type="button" class="hover:text-gray-800" on:click={() => toggleSort('money')}>보유{sortMark('money')}</button>
							</th>
							<th class="pl-4 pr-3 py-3 text-left text-sm font-medium text-gray-500 whitespace-nowrap w-px">
								<button type="button" class="hover:text-gray-800" on:click={() => toggleSort('hourlyKill')}>1시간 킬수{sortMark('hourlyKill')}</button>
							</th>
							<th class="pl-3 pr-4 py-3 text-left text-sm font-medium text-gray-500 whitespace-nowrap w-px">
								<button type="button" class="hover:text-gray-800" on:click={() => toggleSort('hourlyAdena')}>1시간 획득량{sortMark('hourlyAdena')}</button>
							</th>
							<!--
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								<button type="button" class="hover:text-gray-800" on:click={() => toggleSort('lastIncrease')}>직전 획득{sortMark('lastIncrease')}</button>
							</th>
							-->
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
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
								두루마리 만료일
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-full">
								코드 만료일
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each filteredMembers as member (member.email)}
							{@const parsed = getMemberDisplay(member)}
							{@const accountExpireSoon = isAccountExpireSoon(parsed.remainPeriod)}
							{@const codeExpireSoon = isAccountExpireSoon(member.product_period)}
							{@const expireSoon = accountExpireSoon || codeExpireSoon}
							<tr class="monitor-member-row">
								<td class="px-4 py-4 text-base font-medium text-gray-900 whitespace-nowrap">
									<button
										type="button"
										on:click={() => earnedPopupEmail = member.email}
										class="{expireSoon ? 'text-red-600 font-bold hover:text-red-700' : 'text-blue-700 hover:text-blue-900'} hover:underline"
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
								<td class="px-4 py-4 text-base text-gray-500 whitespace-nowrap w-px">
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
								<td class="pl-3 pr-4 py-4 text-base text-gray-500 whitespace-nowrap w-px">
									{formatLevel(parsed.level)}
								</td>
								<td class="pl-4 pr-3 py-4 text-base whitespace-nowrap w-px {parseMoneyAmount(parsed.money) >= 1000000 ? 'font-bold text-gray-800' : 'text-gray-500'}">
									{formatMoney(parsed.money)}
								</td>
								<td class="pl-4 pr-3 py-4 text-base text-amber-800 whitespace-nowrap w-px">
									{formatMoney(parsed.hourlyKill)}
								</td>
								<td class="pl-3 pr-4 py-4 text-base text-orange-700 whitespace-nowrap w-px">
									{formatMoney(parsed.hourlyAdena)}
								</td>
								<!--
								<td class="px-4 py-4 text-base text-teal-700 whitespace-nowrap">
									{#if lastIncreaseLoading || isStaleMember(member)}
										<span class="text-gray-400">-</span>
									{:else}
										{formatMoney((Number(lastIncreaseByEmail?.[(member.email || '').trim().toLowerCase()] ?? 0) || 0).toString())}
									{/if}
								</td>
								-->
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
								<td class="px-4 py-4 text-base whitespace-nowrap {accountExpireSoon ? 'text-red-600' : 'text-gray-500'}">
									{formatAccountExpireDate(parsed.remainPeriod)}
								</td>
								<td class="px-4 py-4 text-base whitespace-nowrap w-full {codeExpireSoon ? 'text-red-600' : 'text-gray-500'}">
									{formatAccountExpireDate(member.product_period)}
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
