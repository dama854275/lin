import { parseSetValue } from '$lib/utils/parseSetValue';

/** KST 기준 YYYY-MM-DD */
export function getKstDateString(date = new Date()) {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);
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

export function summarizeSnapshots(snapshots) {
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

	return {
		start_total: sorted[0].total_adena ?? 0,
		end_total: sorted[sorted.length - 1].total_adena ?? 0,
		max_total: maxTotal,
		earned_total: calculateDailyEarned(sorted),
		snapshot_count: sorted.length
	};
}
