import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabase/server.js';
import crypto from 'crypto';

/** product_token 갱신용 토큰 생성 */
function generateToken() {
	return crypto.randomBytes(32).toString('hex');
}

/**
 * GET /api/user-info
 * - LinWeb: user_info의 product_token, product_period만 사용 (고정)
 * - 쿼리: email, password 필수. action=update_token 이면 토큰 갱신 후 반환
 */
export async function GET({ url }) {
	try {
		const email = decodeURIComponent(url.searchParams.get('email') || '').trim().toLowerCase();
		const password = decodeURIComponent(url.searchParams.get('password') || '');
		const action = decodeURIComponent(url.searchParams.get('action') || '');

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

		// LinWeb: user_info는 email로 조회
		const userEmail = authData.user.email ?? email;

		if (action === 'update_token') {
			const newToken = generateToken();
			const { data: row, error: updateError } = await supabaseServer
				.from('user_info')
				.update({ product_token: newToken })
				.eq('email', userEmail)
				.select('product_token, product_period')
				.single();

			if (updateError) {
				console.error('Update product_token error:', updateError);
				return json(
					{ success: false, error: '토큰 갱신 중 오류가 발생했습니다.' },
					{ status: 500 }
				);
			}

			return json({
				success: true,
				product_token: row?.product_token ?? newToken,
				product_period: row?.product_period ? 1 : 0
			});
		}

		// 일반 조회: product_token, product_period(1/0)만 반환
		const { data: row, error: fetchError } = await supabaseServer
			.from('user_info')
			.select('product_token, product_period')
			.eq('email', userEmail)
			.single();

		if (fetchError) {
			console.error('Get user info error:', fetchError);
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
		console.error('API user-info Error:', error);
		return json(
			{ success: false, error: '서버 오류가 발생했습니다.' },
			{ status: 500 }
		);
	}
}
