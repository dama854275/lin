import { getKstRecentDateStrings } from '$lib/utils/parseAdena';

function memberEmails(members) {
	return Array.from(
		new Set((members || []).map((m) => (m?.email || '').trim().toLowerCase()).filter(Boolean))
	);
}

/** RLS 없이 서버에서 adena_daily.earned_total 조회 */
export async function fetchEarnedBatch(emails, dates) {
	const res = await fetch('/api/adena/earned-batch', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ emails, dates })
	});
	const payload = await res.json();
	if (!res.ok || !payload?.success) {
		throw new Error(payload?.error || 'earned-batch failed');
	}
	return Array.isArray(payload.rows) ? payload.rows : [];
}

/** referredMembers 기준 최근 N일 adena_daily 조회 → { [stat_date]: { [email]: earned_total } } */
export async function fetchEarnedDailyRange(_supabase, members, dayCount = 7) {
	const emails = memberEmails(members);
	const dates = getKstRecentDateStrings(dayCount);
	const byDate = {};
	for (const d of dates) {
		byDate[d] = {};
	}

	if (emails.length === 0) {
		return { byDate, dates };
	}

	const rows = await fetchEarnedBatch(emails, dates);
	rows.forEach((row) => {
		const dateKey = String(row.stat_date || '').slice(0, 10);
		const emailKey = String(row.email || '').trim().toLowerCase();
		if (!dateKey || !emailKey || !byDate[dateKey]) return;
		byDate[dateKey][emailKey] = Number(row.earned_total) || 0;
	});

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
