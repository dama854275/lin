import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabase/server.js';
import { getKstDateString } from '$lib/utils/parseAdena';

/**
 * GET /api/adena/daily
 * - query: email, date(YYYY-MM-DD, optional; default: today KST)
 * - returns: adena_daily row
 */
export async function GET({ url }) {
	try {
		const email = decodeURIComponent(url.searchParams.get('email') || '').trim().toLowerCase();
		const date = decodeURIComponent(url.searchParams.get('date') || '').trim();

		if (!email) {
			return json({ success: false, error: 'email이 필요합니다.' }, { status: 400 });
		}

		const statDate = date || getKstDateString();

		const { data, error } = await supabaseServer
			.from('adena_daily')
			.select('email, stat_date, earned_total, start_total, end_total, max_total, snapshot_count, updated_at')
			.eq('email', email)
			.eq('stat_date', statDate)
			.maybeSingle();

		if (error) {
			console.error('adena daily fetch error:', error);
			return json({ success: false, error: '일별 데이터 조회 중 오류가 발생했습니다.' }, { status: 500 });
		}

		return json({ success: true, data: data || null, stat_date: statDate });
	} catch (e) {
		console.error('API adena daily GET Error:', e);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}

