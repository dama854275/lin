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
		for (let i = 0; i < emails.length; i += chunkSize) {
			const chunk = emails.slice(i, i + chunkSize);
			const { data, error } = await supabaseServer
				.from('adena_daily')
				.select('email, stat_date, earned_total')
				.in('email', chunk)
				.in('stat_date', dates);

			if (error) {
				console.error('adena earned-batch fetch error:', error);
				return json({ success: false, error: '일별 획득 조회 중 오류가 발생했습니다.' }, { status: 500 });
			}

			for (const row of data || []) {
				rows.push({
					email: normalizeEmail(row.email),
					stat_date: normalizeStatDate(row.stat_date),
					earned_total: Number(row.earned_total) || 0
				});
			}
		}

		return json({ success: true, rows });
	} catch (e) {
		console.error('API adena earned-batch POST Error:', e);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}
