import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabase/server.js';

/**
 * GET /api/user-info-check
 * - LinWeb: user_info의 product_token, product_period만 사용 (고정)
 * - 쿼리: email, password 필수. 토큰·남은기간 확인용
 */
export async function GET({ url }) {
	try {
		const email = decodeURIComponent(url.searchParams.get('email') || '').trim().toLowerCase();
		const password = decodeURIComponent(url.searchParams.get('password') || '');

		if (!email || !password) {
			return json(
				{ success: false, error: '이메일과 비밀번호가 필요합니다.' },
				{ status: 400 }
			);
		}

		const { data: authData, error: authError } = await supabaseServer.auth.signInWithPassword({
			email,
			password
		});

		if (authError) {
			return json({ success: false, error: authError.message }, { status: 401 });
		}

		const userEmail = authData.user.email ?? email;

		const { data: row, error: fetchError } = await supabaseServer
			.from('user_info')
			.select('product_token, product_period')
			.eq('email', userEmail)
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
