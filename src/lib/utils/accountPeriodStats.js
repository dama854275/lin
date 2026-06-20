/** KST 기준 YYYY-MM */
function getKstYearMonth(date = new Date()) {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Seoul',
		year: 'numeric',
		month: '2-digit'
	}).formatToParts(date);
	const year = parts.find((p) => p.type === 'year')?.value ?? '';
	const month = parts.find((p) => p.type === 'month')?.value ?? '';
	return `${year}-${month}`;
}

function getKstNextYearMonth(date = new Date()) {
	const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);
	const d = new Date(`${dateStr}T12:00:00+09:00`);
	d.setDate(1);
	d.setMonth(d.getMonth() + 1);
	return getKstYearMonth(d);
}

function getProductPeriodYearMonth(productPeriod) {
	if (!productPeriod) return null;
	const d = new Date(productPeriod);
	if (isNaN(d.getTime())) return null;
	return getKstYearMonth(d);
}

/** 기간 통계·만료 필터에서 제외할 계정 (hh_ 접두 이메일) */
export function isExcludedFromPeriodStats(email) {
	return (email || '').toLowerCase().startsWith('hh_');
}

/** 하위 계정 product_period 기준 통계 */
export function summarizeAccountPeriodStats(members, now = new Date()) {
	const thisMonth = getKstYearMonth(now);
	const nextMonth = getKstNextYearMonth(now);

	let activeCount = 0;
	let expiringThisMonth = 0;
	let expiringNextMonth = 0;

	for (const member of members || []) {
		if (isExcludedFromPeriodStats(member?.email)) continue;

		const productPeriod = member?.product_period;
		if (!productPeriod) continue;

		const expiry = new Date(productPeriod);
		if (isNaN(expiry.getTime())) continue;

		if (expiry > now) activeCount++;

		const yearMonth = getProductPeriodYearMonth(productPeriod);
		if (yearMonth === thisMonth) expiringThisMonth++;
		else if (yearMonth === nextMonth) expiringNextMonth++;
	}

	return { activeCount, expiringThisMonth, expiringNextMonth };
}

export function isExpiringThisMonth(productPeriod, now = new Date()) {
	const yearMonth = getProductPeriodYearMonth(productPeriod);
	return yearMonth === getKstYearMonth(now);
}

export function isExpiringNextMonth(productPeriod, now = new Date()) {
	const yearMonth = getProductPeriodYearMonth(productPeriod);
	return yearMonth === getKstNextYearMonth(now);
}
