import { json } from '@sveltejs/kit';
import { supabaseServer, createSupabaseAuthVerifyClient } from '$lib/supabase/server.js';
import crypto from 'crypto';

/** Supabase Auth(GoTrue)로 비밀번호 검증 — 서비스 롤 클라이언트와 동일 키 정책, 인스턴스는 호출부에서 격리 */
async function verifyLoginWithSupabaseAuth(email, password) {
	const auth = createSupabaseAuthVerifyClient();
	const { data, error } = await auth.auth.signInWithPassword({ email, password });
	if (error || !data?.user?.email) {
		return false;
	}
	return data.user.email.trim().toLowerCase() === email;
}

async function ensureUserExistsByEmail(email) {
	const { data, error } = await supabaseServer
		.from('user_info')
		.select('email')
		.eq('email', email)
		.limit(1);

	if (error) {
		console.error('user-info email existence error:', error);
		return { ok: false, status: 500, body: { success: false, error: '사용자 확인 중 오류가 발생했습니다.' } };
	}
	if (!Array.isArray(data) || !data[0]?.email) {
		return { ok: false, status: 404, body: { success: false, error: '존재하지 않는 이메일입니다.' } };
	}
	return { ok: true };
}

/** product_token 갱신용 토큰 생성 */
function generateToken() {
	return crypto.randomBytes(32).toString('hex');
}

/**
 * GET /api/user-info
 * - LinWeb: user_info의 product_token, product_period만 사용 (고정)
 * - 쿼리: email 필수. action=update_token 이면 password 필수(Supabase Auth 로그인 검증 후 토큰 갱신)
 */
export async function GET({ url }) {
	try {
		const email = decodeURIComponent(url.searchParams.get('email') || '').trim().toLowerCase();
		const action = decodeURIComponent(url.searchParams.get('action') || '');

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

		if (action === 'update_token') {
			const password = decodeURIComponent(url.searchParams.get('password') || '');
			if (!password) {
				return json(
					{ success: false, error: '비밀번호가 필요합니다.' },
					{ status: 400 }
				);
			}
			const loginOk = await verifyLoginWithSupabaseAuth(email, password);
			if (!loginOk) {
				return json(
					{ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
					{ status: 401 }
				);
			}

			const newToken = generateToken();
			const { data: row, error: updateError } = await supabaseServer
				.from('user_info')
				.update({ product_token: newToken })
				.eq('email', email)
				.select('product_token, product_period')
				.single();

			if (updateError) {
				console.error('Update product_token error:', updateError);
				return json(
					{ success: false, error: '토큰 갱신 중 오류가 발생했습니다.' },
					{ status: 500 }
				);
			}

			// product_period_2: DB의 product_period 컬럼값을 YYYYMMDD 숫자만 반환
			let product_period_2 = null;
			if (row?.product_period) {
				const d = new Date(row.product_period);
				if (!isNaN(d.getTime())) {
					product_period_2 =
						`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
				}
			}

			return json({
				success: true,
				product_token: row?.product_token ?? newToken,
				product_period: row?.product_period ? 1 : 0,
				product_period_2
			});
		}

		// 일반 조회: product_token, product_period(1/0)만 반환
		const { data: row, error: fetchError } = await supabaseServer
			.from('user_info')
			.select('product_token, product_period')
			.eq('email', email)
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
