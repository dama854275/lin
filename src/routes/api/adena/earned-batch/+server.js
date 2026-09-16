import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabase/server.js';

function normalizeEmail(value) {
	return String(value || '')
		.trim()
		.toLowerCase();
}

function normalizeStatDate(value) {
	const s = String(value || '').trim();
	return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * POST /api/adena/earned-batch
 * - Body: { emails: string[], dates: string[] }
 * - RLS 없이 adena_daily 의 earned_total 을 조회
 */
export async function POST({ request }) {
	try {
		const body = await request.json();
		const emails = Array.from(
			new Set((Array.isArray(body?.emails) ? body.emails : []).map(normalizeEmail).filter(Boolean))
		);
		const dates = Array.from(
			new Set((Array.isArray(body?.dates) ? body.dates : []).map(normalizeStatDate).filter(Boolean))
		);

		if (emails.length === 0 || dates.length === 0) {
			return json({ success: true, rows: [] });
		}

		const rows = [];
		const chunkSize = 200;
		const pageSize = 1000;
		const dateSet = new Set(dates);
		const sortedDates = [...dates].sort();
		const dateStart = sortedDates[0];
		const dateEnd = sortedDates[sortedDates.length - 1];
		for (let i = 0; i < emails.length; i += chunkSize) {
			const chunk = emails.slice(i, i + chunkSize);
			let from = 0;
			while (true) {
				const { data, error } = await supabaseServer
					.from('adena_daily')
					.select('email, stat_date, earned_total')
					.in('email', chunk)
					.gte('stat_date', dateStart)
					.lte('stat_date', dateEnd)
					.range(from, from + pageSize - 1);

				if (error) {
					console.error('adena earned-batch fetch error:', error);
					return json({ success: false, error: '일별 획득 조회 중 오류가 발생했습니다.' }, { status: 500 });
				}

				const page = data || [];
				for (const row of page) {
					const statDate = normalizeStatDate(row.stat_date);
					if (!dateSet.has(statDate)) continue;
					rows.push({
						email: normalizeEmail(row.email),
						stat_date: statDate,
						earned_total: Number(row.earned_total) || 0
					});
				}
				if (page.length < pageSize) break;
				from += pageSize;
			}
		}

		return json({ success: true, rows });
	} catch (e) {
		console.error('API adena earned-batch POST Error:', e);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}
