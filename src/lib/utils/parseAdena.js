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
	const prevStorage = prev.storage_adena ?? prev.storage ?? 0;
	return prevStorage !== next.storage;
}

/** API 수신 시 보관 증가분(마이너스·최초 기준선은 0) */
export function calculateStorageIncreaseDelta(prevStorage, newStorage) {
	if (prevStorage === null || prevStorage === undefined) return 0;
	const net = (Number(newStorage) || 0) - (Number(prevStorage) || 0);
	return net > 0 ? net : 0;
}
