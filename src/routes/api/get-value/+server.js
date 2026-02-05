import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabase/server.js';

/** user_info 테이블 허용 컬럼: set_value 또는 set_value_1, set_value_2, set_value_3 등 */
function isAllowedColumn(name) {
	const col = String(name).trim().toLowerCase();
	return col === 'set_value' || /^set_value_[a-z0-9_]+$/.test(col);
}

/** 공통 처리: 인증 후 user_info에서 지정 컬럼 값 조회 */
async function getValue(email, password, column = 'set_value') {
	if (!email || !password) {
		return { ok: false, status: 400, body: { success: false, error: '이메일(id)과 비밀번호(pw)가 필요합니다.' } };
	}

	const col = String(column).trim().toLowerCase();
	if (!isAllowedColumn(col)) {
		return {
			ok: false,
			status: 400,
			body: { success: false, error: '허용된 컬럼이 아닙니다. set_value 또는 set_value_1, set_value_2, set_value_3 형식만 가능합니다.' }
		};
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
		.select(col)
		.eq('email', userEmail)
		.single();

	if (fetchError) {
		console.error('get-value fetch error:', fetchError);
		return { ok: false, status: 500, body: { success: false, error: `${col} 조회 중 오류가 발생했습니다.` } };
	}

	const value = userData?.[col] ?? '';
	return { ok: true, body: { success: true, column: col, value } };
}

/**
 * GET /api/get-value
 * - 쿼리: email, password (또는 id, pw), column (선택, 기본: set_value)
 * - 인증 후 해당 사용자의 user_info.[column] 값 반환
 * - 예: ?email=test@gmail.com&password=test11
 * - 예: ?email=test@gmail.com&password=test11&column=nickname
 */
export async function GET({ url }) {
	try {
		const email = decodeURIComponent(url.searchParams.get('email') || url.searchParams.get('id') || '').trim().toLowerCase();
		const password = decodeURIComponent(url.searchParams.get('password') || url.searchParams.get('pw') || '');
		const column = url.searchParams.get('column')?.trim() || 'set_value';

		const result = await getValue(email, password, column);
		return json(result.body, { status: result.ok ? 200 : result.status });
	} catch (error) {
		console.error('API get-value GET Error:', error);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}

/**
 * POST /api/get-value
 * - id(이메일), pw(비밀번호), column(선택)을 받아 해당 사용자의 user_info.[column] 값 반환
 * - Body: JSON { email, password, column } 또는 form-data
 */
export async function POST({ request }) {
	try {
		let email, password, column = 'set_value';

		const contentType = request.headers.get('content-type') || '';
		if (contentType.includes('application/json')) {
			const body = await request.json();
			email = (body.email ?? body.id ?? '').toString().trim().toLowerCase();
			password = (body.password ?? body.pw ?? '').toString();
			column = (body.column ?? 'set_value').toString().trim() || 'set_value';
		} else {
			const form = await request.formData();
			email = (form.get('email') ?? form.get('id') ?? '').toString().trim().toLowerCase();
			password = (form.get('password') ?? form.get('pw') ?? '').toString();
			column = (form.get('column') ?? 'set_value').toString().trim() || 'set_value';
		}

		const result = await getValue(email, password, column);
		return json(result.body, { status: result.ok ? 200 : result.status });
	} catch (error) {
		console.error('API get-value POST Error:', error);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}
