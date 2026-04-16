import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabase/server.js';

async function ensureUserExistsByEmail(email) {
	const { data, error } = await supabaseServer
		.from('user_info')
		.select('email')
		.eq('email', email)
		.limit(1);

	if (error) {
		console.error('user-api-value email existence error:', error);
		return { ok: false, status: 500, body: { success: false, error: '사용자 확인 중 오류가 발생했습니다.' } };
	}
	if (!Array.isArray(data) || !data[0]?.email) {
		return { ok: false, status: 404, body: { success: false, error: '존재하지 않는 이메일입니다.' } };
	}
	return { ok: true };
}

/** 공통 처리: 인증 후 user_info에 api_value, api_at 반영 */
async function updateApiValue(email, password, apiValue) {
	// 기존 호환: password 파라미터는 유지하되 서버에서는 사용하지 않음
	if (!email) {
		return { ok: false, status: 400, body: { success: false, error: '이메일(id)이 필요합니다.' } };
	}
	if (apiValue === '') {
		return { ok: false, status: 400, body: { success: false, error: 'api_value가 필요합니다.' } };
	}

	const exists = await ensureUserExistsByEmail(email);
	if (!exists.ok) {
		return exists;
	}
	const now = new Date().toISOString();
	const { error: updateError } = await supabaseServer
		.from('user_info')
		.update({ api_value: apiValue, api_at: now })
		.eq('email', email);

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
		// eslint-disable-next-line no-unused-vars
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
			password = (body.password ?? body.pw ?? '').toString(); // 유지(미사용)
			apiValue = (body.api_value ?? '').toString().trim();
		} else {
			const form = await request.formData();
			email = (form.get('email') ?? form.get('id') ?? '').toString().trim().toLowerCase();
			password = (form.get('password') ?? form.get('pw') ?? '').toString(); // 유지(미사용)
			apiValue = (form.get('api_value') ?? '').toString().trim();
		}

		const result = await updateApiValue(email, password, apiValue);
		return json(result.body, { status: result.ok ? 200 : result.status });
	} catch (error) {
		console.error('API user-api-value POST Error:', error);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}
