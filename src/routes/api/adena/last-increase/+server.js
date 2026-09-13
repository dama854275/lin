import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabase/server.js';

function normalizeEmail(value) {
	return String(value || '')
		.trim()
		.toLowerCase();
}

function lastIncreaseFromRows(rows) {
	const sorted = [...(rows || [])].sort((a, b) => {
		const ta = new Date(a.recorded_at).getTime();
		const tb = new Date(b.recorded_at).getTime();
		return tb - ta;
	});
	if (sorted.length < 2) return 0;
	const newest = Number(sorted[0].held_adena) || 0;
	const prev = Number(sorted[1].held_adena) || 0;
	const net = newest - prev;
	return net > 0 ? net : 0;
}

/**
 * POST /api/adena/last-increase
 * - Body: { emails: string[] }
 * - 계정당 최근 스냅샷 2개로 직전 보유 증가분 조회
 */
export async function POST({ request }) {
	try {
		const body = await request.json();
		const emails = Array.from(
			new Set((Array.isArray(body?.emails) ? body.emails : []).map(normalizeEmail).filter(Boolean))
		);

		if (emails.length === 0) {
			return json({ success: true, rows: [] });
		}

		const rows = [];
		const concurrency = 20;
		for (let i = 0; i < emails.length; i += concurrency) {
			const chunk = emails.slice(i, i + concurrency);
			const results = await Promise.all(
				chunk.map(async (email) => {
					const { data, error } = await supabaseServer
						.from('adena_snapshots')
						.select('email, held_adena, recorded_at')
						.eq('email', email)
						.order('recorded_at', { ascending: false })
						.limit(2);

					if (error) throw error;
					return {
						email,
						last_increase: lastIncreaseFromRows(data)
					};
				})
			);
			rows.push(...results);
		}

		return json({ success: true, rows });
	} catch (e) {
		console.error('API adena last-increase POST Error:', e);
		return json({ success: false, error: '직전 획득 조회 중 오류가 발생했습니다.' }, { status: 500 });
	}
}
