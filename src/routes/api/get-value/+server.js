import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabase/server.js';

/** 공통 처리: 인증 후 user_info에서 set_value 조회 */
async function getValue(email, password) {
	if (!email || !password) {
		return { ok: false, status: 400, body: { success: false, error: '이메일(id)과 비밀번호(pw)가 필요합니다.' } };
	}

	const { data: authData, error: authError } = await supabaseServer.auth.signInWithPassword({
		email,
		password
	});
	if (authError) {
		return { ok: false, status: 401, body: { success: false, error: authError.message } };
	}

	const userEmail = authData.user.email ?? email;
	const { data: userData, error: fetchError } = await supabaseServer
		.from('user_info')
		.select('set_value')
		.eq('email', userEmail)
		.single();

	if (fetchError) {
		console.error('get-value fetch error:', fetchError);
		return { ok: false, status: 500, body: { success: false, error: 'set_value 조회 중 오류가 발생했습니다.' } };
	}

	const setValue = userData?.set_value ?? '';
	return { ok: true, body: { success: true, set_value: setValue } };
}

/**
 * GET /api/get-value
 * - 쿼리: email, password (또는 id, pw)
 * - 인증 후 해당 사용자의 user_info.set_value 반환
 * - 예: ?email=test@gmail.com&password=test11
 */
export async function GET({ url }) {
	try {
		const email = decodeURIComponent(url.searchParams.get('email') || url.searchParams.get('id') || '').trim().toLowerCase();
		const password = decodeURIComponent(url.searchParams.get('password') || url.searchParams.get('pw') || '');

		const result = await getValue(email, password);
		return json(result.body, { status: result.ok ? 200 : result.status });
	} catch (error) {
		console.error('API get-value GET Error:', error);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}

/**
 * POST /api/get-value
 * - id(이메일), pw(비밀번호)를 받아 해당 사용자의 set_value 반환
 * - Body: JSON { email, password } 또는 form-data
 */
export async function POST({ request }) {
	try {
		let email, password;

		const contentType = request.headers.get('content-type') || '';
		if (contentType.includes('application/json')) {
			const body = await request.json();
			email = (body.email ?? body.id ?? '').toString().trim().toLowerCase();
			password = (body.password ?? body.pw ?? '').toString();
		} else {
			const form = await request.formData();
			email = (form.get('email') ?? form.get('id') ?? '').toString().trim().toLowerCase();
			password = (form.get('password') ?? form.get('pw') ?? '').toString();
		}

		const result = await getValue(email, password);
		return json(result.body, { status: result.ok ? 200 : result.status });
	} catch (error) {
		console.error('API get-value POST Error:', error);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}
