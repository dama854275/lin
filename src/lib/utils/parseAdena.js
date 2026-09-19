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

/** KST 기준 다음날 YYYY-MM-DD */
export function getKstNextDateString(dateStr = getKstDateString()) {
	const date = new Date(`${dateStr}T12:00:00+09:00`);
	date.setDate(date.getDate() + 1);
	return getKstDateString(date);
}

/** KST 달력 월(YYYY-MM)의 날짜 목록. 이번 달은 오늘까지 */
export function getKstMonthDateStrings(yearMonth, todayStr = getKstDateString()) {
	const key = String(yearMonth || '').slice(0, 7);
	if (!/^\d{4}-\d{2}$/.test(key)) return [];
	const [year, month] = key.split('-').map((v) => Number(v));
	const nextMonth =
		month === 12
			? `${year + 1}-01-01`
			: `${year}-${String(month + 1).padStart(2, '0')}-01`;
	const dates = [];
	let d = `${key}-01`;
	while (d < nextMonth && d <= todayStr) {
		dates.push(d);
		d = getKstNextDateString(d);
	}
	return dates;
}

/** 2026년 6월부터 이번 달까지 (최신→과거). [{ value: '2026-09', label: '9월' }] */
export function getKstRecentMonthOptions(_count = 12, todayStr = getKstDateString()) {
	const startYear = 2026;
	const startMonth = 6;
	const [year, month] = todayStr.slice(0, 7).split('-').map((v) => Number(v));
	const currentYear = year;
	const options = [];
	let y = year;
	let m = month;
	while (y > startYear || (y === startYear && m >= startMonth)) {
		const value = `${y}-${String(m).padStart(2, '0')}`;
		const label = y === currentYear ? `${m}월` : `${y}년 ${m}월`;
		options.push({ value, label });
		m -= 1;
		if (m < 1) {
			m = 12;
			y -= 1;
		}
	}
	return options;
}

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
	const prevHeld = Number(prev.held_adena ?? prev.held ?? 0);
	return prevHeld !== Number(next.held ?? 0);
}

/** API 수신 시 보유 증가분(마이너스·최초 기준선은 0). 10만 이상 점프는 획득에 넣지 않음 */
export const ADENA_EARNED_JUMP_IGNORE = 100000;

export function calculateStorageIncreaseDelta(prevStorage, newStorage) {
	if (prevStorage === null || prevStorage === undefined) return 0;
	const net = (Number(newStorage) || 0) - (Number(prevStorage) || 0);
	if (net <= 0) return 0;
	if (net >= ADENA_EARNED_JUMP_IGNORE) return 0;
	return net;
}
