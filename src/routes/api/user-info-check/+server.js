import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabase/server.js';

async function ensureUserExistsByEmail(email) {
	const { data, error } = await supabaseServer
		.from('user_info')
		.select('email')
		.eq('email', email)
		.limit(1);

	if (error) {
		console.error('user-info-check email existence error:', error);
		return { ok: false, status: 500, body: { success: false, error: '사용자 확인 중 오류가 발생했습니다.' } };
	}
	if (!Array.isArray(data) || !data[0]?.email) {
		return { ok: false, status: 404, body: { success: false, error: '존재하지 않는 이메일입니다.' } };
	}
	return { ok: true };
}

/**
 * GET /api/user-info-check
 * - LinWeb: user_info의 product_token, product_period만 사용 (고정)
 * - 쿼리: email, password 필수. 토큰·남은기간 확인용
 */
export async function GET({ url }) {
	try {
		const email = decodeURIComponent(url.searchParams.get('email') || '').trim().toLowerCase();
		// 기존 호환: password 파라미터는 유지하되 서버에서는 사용하지 않음
		// eslint-disable-next-line no-unused-vars
		const password = decodeURIComponent(url.searchParams.get('password') || '');

		if (!email) {
			return json(
				{ success: false, error: '이메일이 필요합니다.' },
				{ status: 400 }
			);
		}

		const exists = await ensureUserExistsByEmail(email);
		if (!exists.ok) {
			return json(exists.body, { status: exists.status });
		}

		const { data: row, error: fetchError } = await supabaseServer
			.from('user_info')
			.select('product_token, product_period')
			.eq('email', email)
			.single();

		if (fetchError) {
			console.error('Check user info error:', fetchError);
			return json(
				{ success: false, error: '사용자 정보 조회 중 오류가 발생했습니다.' },
				{ status: 500 }
			);
		}

		return json({
			success: true,
			product_token: row?.product_token ?? null,
			product_period: row?.product_period ? 1 : 0
		});
	} catch (error) {
		console.error('API user-info-check Error:', error);
		return json(
			{ success: false, error: '서버 오류가 발생했습니다.' },
			{ status: 500 }
		);
	}
}
