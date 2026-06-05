import { parseSetValue } from '$lib/utils/parseSetValue';

/** KST 기준 YYYY-MM-DD */
export function getKstDateString(date = new Date()) {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);
}

/** KST 기준 전날 YYYY-MM-DD */
export function getKstPreviousDateString(dateStr = getKstDateString()) {
	const date = new Date(`${dateStr}T12:00:00+09:00`);
	date.setDate(date.getDate() - 1);
	return getKstDateString(date);
}

/** KST 기준 최근 N일(오늘 포함), 과거→오늘 순 */
export function getKstRecentDateStrings(count = 7, endDateStr = getKstDateString()) {
	const dates = [];
	let d = endDateStr;
	for (let i = 0; i < count; i++) {
		dates.push(d);
		d = getKstPreviousDateString(d);
	}
	return dates.reverse();
}

/** 차트 라벨: M/D (요일) */
export function formatKstChartDateLabel(dateStr) {
	const date = new Date(`${dateStr}T12:00:00+09:00`);
	const weekday = new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' }).format(
		date
	);
	const md = new Intl.DateTimeFormat('ko-KR', {
		month: 'numeric',
		day: 'numeric',
		timeZone: 'Asia/Seoul'
	}).format(date);
	return `${md} (${weekday})`;
}

/** KST 하루의 UTC ISO 범위 */
export function getKstDayBounds(dateStr = getKstDateString()) {
	return {
		start: new Date(`${dateStr}T00:00:00+09:00`).toISOString(),
		end: new Date(`${dateStr}T23:59:59.999+09:00`).toISOString()
	};
}

export function parseAdenaAmount(value) {
	if (value === null || value === undefined || value === '-') return 0;
	const digits = String(value).trim().replace(/[^\d]/g, '');
	if (!digits) return 0;
	const n = parseInt(digits, 10);
	return !isNaN(n) && n >= 0 ? n : 0;
}

/** set_value_1 → 보관/보유/합계 */
export function extractAdenaFromSetValue1(setValue1) {
	const parsed = parseSetValue(setValue1);
	const storage = parseAdenaAmount(parsed.storageMoney);
	const held = parseAdenaAmount(parsed.money);
	return {
		storage,
		held,
		total: storage + held
	};
}

export function hasAdenaChanged(prev, next) {
	if (!prev) return true;
	return prev.storage !== next.storage || prev.held !== next.held;
}

/**
 * 스냅샷 연속 구간 기준 하루 수익
 * - 증가분 + 감소 절대값(출금/사용) 합산
 */
export function calculateDailyEarned(snapshots) {
	if (!snapshots || snapshots.length < 2) return 0;

	const sorted = [...snapshots].sort(
		(a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
	);

	let earned = 0;
	for (let i = 1; i < sorted.length; i++) {
		const ds = sorted[i].storage_adena - sorted[i - 1].storage_adena;
		const dh = sorted[i].held_adena - sorted[i - 1].held_adena;
		if (ds > 0) earned += ds;
		if (dh > 0) earned += dh;
		if (ds < 0) earned += -ds;
		if (dh < 0) earned += -dh;
	}
	return earned;
}

export function summarizeSnapshots(snapshots, baselineSnapshot = null) {
	if (!snapshots || snapshots.length === 0) {
		return { start_total: null, end_total: null, max_total: null, earned_total: 0, snapshot_count: 0 };
	}

	const sorted = [...snapshots].sort(
		(a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
	);

	let maxTotal = sorted[0].total_adena ?? 0;
	for (const row of sorted) {
		const total = row.total_adena ?? 0;
		if (total > maxTotal) maxTotal = total;
	}

	// 당일 스냅샷 2건 미만이면 당일 구간만으로는 수익이 0이 됨 → 직전 스냅샷과 비교
	let earned_total = 0;
	if (sorted.length >= 2) {
		earned_total = calculateDailyEarned(sorted);
	} else if (sorted.length === 1 && baselineSnapshot) {
		earned_total = calculateDailyEarned([baselineSnapshot, sorted[0]]);
	}

	return {
		start_total: sorted[0].total_adena ?? 0,
		end_total: sorted[sorted.length - 1].total_adena ?? 0,
		max_total: maxTotal,
		earned_total,
		snapshot_count: sorted.length
	};
}
