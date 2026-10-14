import { isExcludedFromAccountStats } from '../../lib/utils/accountPeriodStats.js';

const DAY = 86400000;
const KST = 9 * 3600000;

/** 오늘부터 30일 뒤까지, 한국 날짜별 상품 기간 만료 건수. */
export function buildExpiryForecast(members, now = new Date()) {
	const start = Math.floor((now.getTime() + KST) / DAY);
	const days = Array.from({ length: 31 }, (_, offset) => {
		const date = new Date((start + offset) * DAY).toISOString().slice(0, 10);
		return { date, label: String(Number(date.slice(8))), count: 0, groups: {} };
	});
	for (const member of members || []) {
		if (isExcludedFromAccountStats(member?.email)) continue;
		if (!member?.product_period) continue;
		const timestamp = new Date(member.product_period).getTime();
		if (!Number.isFinite(timestamp)) continue;
		const offset = Math.floor((timestamp + KST) / DAY) - start;
		if (offset >= 0 && offset < days.length) {
			const day = days[offset];
			const prefix = String(member.email).trim().toLowerCase().slice(0, 3);
			day.count++;
			day.groups[prefix] = (day.groups[prefix] || 0) + 1;
		}
	}
	return days;
}
