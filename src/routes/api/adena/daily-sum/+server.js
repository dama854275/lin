import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabase/server.js';
import { getKstDateString } from '$lib/utils/parseAdena';

/**
 * GET /api/adena/daily-sum
 * - query:
 *   - prefix: 예) z_a  (email like 'z_a%')
 *   - date: YYYY-MM-DD (optional; default: today KST)
 * - returns:
 *   - sum_earned_total: number
 *   - rows: [{ email, earned_total }]
 */
export async function GET({ url }) {
	try {
		const prefix = decodeURIComponent(url.searchParams.get('prefix') || '').trim().toLowerCase();
		const date = decodeURIComponent(url.searchParams.get('date') || '').trim();

		if (!prefix) {
			return json({ success: false, error: 'prefix가 필요합니다.' }, { status: 400 });
		}

		const statDate = date || getKstDateString();
		const like = `${prefix}%`;

		const { data, error } = await supabaseServer
			.from('adena_daily')
			.select('email, earned_total')
			.eq('stat_date', statDate)
			.like('email', like)
			.order('email', { ascending: true });

		if (error) {
			console.error('adena daily-sum fetch error:', error);
			return json({ success: false, error: '일별 합계 조회 중 오류가 발생했습니다.' }, { status: 500 });
		}

		const rows = Array.isArray(data) ? data : [];
		const sum = rows.reduce((acc, r) => acc + (Number(r.earned_total) || 0), 0);

		return json({ success: true, stat_date: statDate, prefix, sum_earned_total: sum, rows });
	} catch (e) {
		console.error('API adena daily-sum GET Error:', e);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}

