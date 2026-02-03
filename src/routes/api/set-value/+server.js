import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabase/server.js';

/** 공통 처리: 인증 후 user_info의 set_value 컬럼에 text 반영 */
async function setValue(email, password, text) {
	if (!email || !password) {
		return { ok: false, status: 400, body: { success: false, error: '이메일(id)과 비밀번호(pw)가 필요합니다.' } };
	}
	if (text === undefined || text === null) {
		return { ok: false, status: 400, body: { success: false, error: 'text 값이 필요합니다.' } };
	}

	const value = typeof text === 'string' ? text.trim() : String(text).trim();

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
		.update({ set_value: value })
		.eq('email', userEmail);

	if (updateError) {
		console.error('set-value update error:', updateError);
		return { ok: false, status: 500, body: { success: false, error: 'set_value 저장 중 오류가 발생했습니다.' } };
	}
	return { ok: true, body: { success: true, message: 'set_value가 반영되었습니다.', updated_at: now } };
}

/**
 * GET /api/set-value
 * - 쿼리: email, password, text (한글은 URL 인코딩 후 전달)
 * - 예: ?email=test@gmail.com&password=test11&text=한글값
 */
export async function GET({ url }) {
	try {
		const email = decodeURIComponent(url.searchParams.get('email') || url.searchParams.get('id') || '').trim().toLowerCase();
		const password = decodeURIComponent(url.searchParams.get('password') || url.searchParams.get('pw') || '');
		const text = url.searchParams.has('text') ? decodeURIComponent(url.searchParams.get('text') || '') : undefined;

		const result = await setValue(email, password, text);
		return json(result.body, { status: result.ok ? 200 : result.status });
	} catch (error) {
		console.error('API set-value GET Error:', error);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}

/**
 * POST /api/set-value
 * - id(이메일), pw(비밀번호), text(설정할 값, 한글 가능)를 받아
 *   user_info의 set_value 컬럼을 갱신
 * - Body: JSON { email, password, text } 또는 form-data
 */
export async function POST({ request }) {
	try {
		let email, password, text;

		const contentType = request.headers.get('content-type') || '';
		if (contentType.includes('application/json')) {
			const body = await request.json();
			email = (body.email ?? body.id ?? '').toString().trim().toLowerCase();
			password = (body.password ?? body.pw ?? '').toString();
			text = body.text !== undefined && body.text !== null ? String(body.text) : undefined;
		} else {
			const form = await request.formData();
			email = (form.get('email') ?? form.get('id') ?? '').toString().trim().toLowerCase();
			password = (form.get('password') ?? form.get('pw') ?? '').toString();
			const t = form.get('text');
			text = t !== undefined && t !== null ? String(t) : undefined;
		}

		const result = await setValue(email, password, text);
		return json(result.body, { status: result.ok ? 200 : result.status });
	} catch (error) {
		console.error('API set-value POST Error:', error);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}
