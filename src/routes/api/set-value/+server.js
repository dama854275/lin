import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabase/server.js';

async function ensureUserExistsByEmail(email) {
	const { data, error } = await supabaseServer
		.from('user_info')
		.select('email')
		.eq('email', email)
		.limit(1);

	if (error) {
		console.error('set-value email existence error:', error);
		return { ok: false, status: 500, body: { success: false, error: '사용자 확인 중 오류가 발생했습니다.' } };
	}
	if (!Array.isArray(data) || !data[0]?.email) {
		return { ok: false, status: 404, body: { success: false, error: '존재하지 않는 이메일입니다.' } };
	}
	return { ok: true };
}

/** user_info 테이블 허용 컬럼: set_value 또는 set_value_1, set_value_2, set_value_3 등 */
function isAllowedColumn(name) {
	const col = String(name).trim().toLowerCase();
	return col === 'set_value' || /^set_value_[a-z0-9_]+$/.test(col);
}

/** 공통 처리: 인증 후 user_info의 지정 컬럼에 text 반영 */
async function setValue(email, password, text, column = 'set_value') {
	// 기존 호환: password 파라미터는 유지하되 서버에서는 사용하지 않음
	if (!email) {
		return { ok: false, status: 400, body: { success: false, error: '이메일(id)이 필요합니다.' } };
	}
	if (text === undefined || text === null) {
		return { ok: false, status: 400, body: { success: false, error: 'text 값이 필요합니다.' } };
	}

	const col = String(column).trim().toLowerCase();
	if (!isAllowedColumn(col)) {
		return {
			ok: false,
			status: 400,
			body: { success: false, error: '허용된 컬럼이 아닙니다. set_value 또는 set_value_1, set_value_2, set_value_3 형식만 가능합니다.' }
		};
	}

	const value = typeof text === 'string' ? text.trim() : String(text).trim();

	const exists = await ensureUserExistsByEmail(email);
	if (!exists.ok) {
		return exists;
	}
	const now = new Date().toISOString();
	const updatePayload = { [col]: value };
	const { error: updateError } = await supabaseServer
		.from('user_info')
		.update(updatePayload)
		.eq('email', email);

	if (updateError) {
		console.error('set-value update error:', updateError);
		return { ok: false, status: 500, body: { success: false, error: `${col} 저장 중 오류가 발생했습니다.` } };
	}
	return { ok: true, body: { success: true, message: `${col}가 반영되었습니다.`, column: col, updated_at: now } };
}

/**
 * GET /api/set-value
 * - 쿼리: email, password, text, column (선택, 기본: set_value)
 * - 예: ?email=test@gmail.com&password=test11&text=한글값
 * - 예: ?email=test@gmail.com&password=test11&text=hello&column=nickname
 */
export async function GET({ url }) {
	try {
		const email = decodeURIComponent(url.searchParams.get('email') || url.searchParams.get('id') || '').trim().toLowerCase();
		// eslint-disable-next-line no-unused-vars
		const password = decodeURIComponent(url.searchParams.get('password') || url.searchParams.get('pw') || '');
		const text = url.searchParams.has('text') ? decodeURIComponent(url.searchParams.get('text') || '') : undefined;
		const column = url.searchParams.get('column')?.trim() || 'set_value';

		const result = await setValue(email, password, text, column);
		return json(result.body, { status: result.ok ? 200 : result.status });
	} catch (error) {
		console.error('API set-value GET Error:', error);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}

/**
 * POST /api/set-value
 * - id(이메일), pw(비밀번호), text(설정할 값), column(선택)을 받아
 *   user_info의 지정 컬럼을 갱신
 * - Body: JSON { email, password, text, column } 또는 form-data
 */
export async function POST({ request }) {
	try {
		let email, password, text, column = 'set_value';

		const contentType = request.headers.get('content-type') || '';
		if (contentType.includes('application/json')) {
			const body = await request.json();
			email = (body.email ?? body.id ?? '').toString().trim().toLowerCase();
			password = (body.password ?? body.pw ?? '').toString(); // 유지(미사용)
			text = body.text !== undefined && body.text !== null ? String(body.text) : undefined;
			column = (body.column ?? 'set_value').toString().trim() || 'set_value';
		} else {
			const form = await request.formData();
			email = (form.get('email') ?? form.get('id') ?? '').toString().trim().toLowerCase();
			password = (form.get('password') ?? form.get('pw') ?? '').toString(); // 유지(미사용)
			const t = form.get('text');
			text = t !== undefined && t !== null ? String(t) : undefined;
			column = (form.get('column') ?? 'set_value').toString().trim() || 'set_value';
		}

		const result = await setValue(email, password, text, column);
		return json(result.body, { status: result.ok ? 200 : result.status });
	} catch (error) {
		console.error('API set-value POST Error:', error);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}
