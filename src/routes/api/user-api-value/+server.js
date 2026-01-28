import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabase/server.js';

/** 공통 처리: 인증 후 user_info에 api_value, api_at 반영 */
async function updateApiValue(email, password, apiValue) {
	if (!email || !password) {
		return { ok: false, status: 400, body: { success: false, error: '이메일(id)과 비밀번호(pw)가 필요합니다.' } };
	}
	if (apiValue === '') {
		return { ok: false, status: 400, body: { success: false, error: 'api_value가 필요합니다.' } };
	}

	const { data: authData, error: authError } = await supabaseServer.auth.signInWithPassword({
		email,
		password
	});
	if (authError) {
		return { ok: false, status: 401, body: { success: false, error: authError.message } };
	}

	const userEmail = authData.user.email ?? email;
	const now = new Date().toISOString();
	const { error: updateError } = await supabaseServer
		.from('user_info')
		.update({ api_value: apiValue, api_at: now })
		.eq('email', userEmail);

	if (updateError) {
		console.error('user-api-value update error:', updateError);
		return { ok: false, status: 500, body: { success: false, error: 'api_value 저장 중 오류가 발생했습니다.' } };
	}
	return { ok: true, body: { success: true, message: 'api_value와 api_at이 반영되었습니다.', api_at: now } };
}

/**
 * GET /api/user-api-value
 * - 쿼리: email, password, api_value (한글은 URL 인코딩 후 전달)
 * - 예: ?email=test@gmail.com&password=test11&api_value=한글값
 */
export async function GET({ url }) {
	try {
		const email = decodeURIComponent(url.searchParams.get('email') || url.searchParams.get('id') || '').trim().toLowerCase();
		const password = decodeURIComponent(url.searchParams.get('password') || url.searchParams.get('pw') || '');
		const apiValue = decodeURIComponent(url.searchParams.get('api_value') || '').trim();

		const result = await updateApiValue(email, password, apiValue);
		return json(result.body, { status: result.ok ? 200 : result.status });
	} catch (error) {
		console.error('API user-api-value GET Error:', error);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}

/**
 * POST /api/user-api-value
 * - id(이메일), pw(비밀번호), api_value(텍스트, 한글 가능)를 받아
 *   user_info의 api_value, api_at(현재시간)을 갱신
 * - Body: JSON { email, password, api_value } 또는 form-data
 */
export async function POST({ request }) {
	try {
		let email, password, apiValue;

		const contentType = request.headers.get('content-type') || '';
		if (contentType.includes('application/json')) {
			const body = await request.json();
			email = (body.email ?? body.id ?? '').toString().trim().toLowerCase();
			password = (body.password ?? body.pw ?? '').toString();
			apiValue = (body.api_value ?? '').toString().trim();
		} else {
			const form = await request.formData();
			email = (form.get('email') ?? form.get('id') ?? '').toString().trim().toLowerCase();
			password = (form.get('password') ?? form.get('pw') ?? '').toString();
			apiValue = (form.get('api_value') ?? '').toString().trim();
		}

		const result = await updateApiValue(email, password, apiValue);
		return json(result.body, { status: result.ok ? 200 : result.status });
	} catch (error) {
		console.error('API user-api-value POST Error:', error);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}
