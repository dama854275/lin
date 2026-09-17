import { getKstDateString, getKstPreviousDateString, getKstRecentDateStrings } from '$lib/utils/parseAdena';
import { EARNED_CHART_DAYS } from '$lib/utils/fetchEarnedDailyRange';

export async function fetchZGroupMonitorLoad({ emailStart, emailEnd, dayCount = EARNED_CHART_DAYS }) {
	const dates = getKstRecentDateStrings(dayCount);
	const today = getKstDateString();
	const yesterday = getKstPreviousDateString(today);
	const res = await fetch('/api/monitor/z-group-load', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			emailStart,
			emailEnd,
			dateFrom: dates[0],
			dateTo: dates[dates.length - 1],
			today,
			yesterday
		})
	});
	const payload = await res.json();
	if (!res.ok || !payload?.success) {
		throw new Error(payload?.error || 'z-group-load failed');
	}
	return {
		members: Array.isArray(payload.members) ? payload.members : [],
		chart: Array.isArray(payload.chart) ? payload.chart : [],
		memberEarned: Array.isArray(payload.memberEarned) ? payload.memberEarned : [],
		dates,
		today,
		yesterday
	};
}

export async function fetchZGroupChartRange({ emailStart, emailEnd, dates }) {
	const rangeDates = Array.isArray(dates) ? dates : [];
	if (rangeDates.length === 0) {
		return { chart: [], dates: [] };
	}
	const today = getKstDateString();
	const yesterday = getKstPreviousDateString(today);
	const res = await fetch('/api/monitor/z-group-load', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			emailStart,
			emailEnd,
			dateFrom: rangeDates[0],
			dateTo: rangeDates[rangeDates.length - 1],
			today,
			yesterday,
			chartOnly: true
		})
	});
	const payload = await res.json();
	if (!res.ok || !payload?.success) {
		throw new Error(payload?.error || 'z-group-chart failed');
	}
	return {
		chart: Array.isArray(payload.chart) ? payload.chart : [],
		dates: rangeDates
	};
}

export function mapsFromMemberEarned(rows, today, yesterday) {
	const todayMap = {};
	const yesterdayMap = {};
	for (const row of rows || []) {
		const email = String(row.email || '').trim().toLowerCase();
		if (!email) continue;
		const dateKey = String(row.stat_date || '').slice(0, 10);
		const amount = Number(row.earned_total) || 0;
		if (dateKey === today) todayMap[email] = amount;
		else if (dateKey === yesterday) yesterdayMap[email] = amount;
	}
	return { todayMap, yesterdayMap };
}

export function chartTotalsByDate(rows) {
	const map = {};
	for (const row of rows || []) {
		const dateKey = String(row.stat_date || '').slice(0, 10);
		if (!dateKey) continue;
		map[dateKey] = Number(row.total) || 0;
	}
	return map;
}

export function chartItemsFromTotals(dates, totalsByDate, todayStr) {
	return (dates || []).map((date) => ({
		date,
		total: Number(totalsByDate?.[date]) || 0,
		isToday: date === todayStr
	}));
}
