import { getKstRecentDateStrings } from '$lib/utils/parseAdena';

const CHUNK_SIZE = 200;

/** referredMembers 기준 최근 N일 adena_daily 조회 → { [stat_date]: { [email]: 보관 순증가 } } */
export async function fetchEarnedDailyRange(supabase, members, dayCount = 7) {
	const emails = Array.from(
		new Set((members || []).map((m) => (m?.email || '').trim().toLowerCase()).filter(Boolean))
	);
	const dates = getKstRecentDateStrings(dayCount);

	if (emails.length === 0) {
		return { byDate: {}, dates };
	}

	const byDate = {};
	for (const d of dates) {
		byDate[d] = {};
	}

	for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
		const chunk = emails.slice(i, i + CHUNK_SIZE);
		const { data, error } = await supabase
			.from('adena_daily')
			.select('email, stat_date, earned_total')
			.in('stat_date', dates)
			.in('email', chunk);

		if (error) throw error;

		(data || []).forEach((row) => {
			const dateKey = row.stat_date;
			const emailKey = String(row.email || '').trim().toLowerCase();
			if (!dateKey || !emailKey || !byDate[dateKey]) return;
			byDate[dateKey][emailKey] = Number(row.earned_total) || 0;
		});
	}

	return { byDate, dates };
}

/** 필터된 이메일 집합 기준 일별 합계 */
export function aggregateEarnedChartData(byDate, dates, emailSet, todayStr) {
	return dates.map((date) => {
		const dayMap = byDate[date] || {};
		let total = 0;
		if (emailSet && emailSet.size > 0) {
			for (const email of emailSet) {
				total += Number(dayMap[email] ?? 0) || 0;
			}
		}
		return {
			date,
			total,
			isToday: date === todayStr
		};
	});
}
