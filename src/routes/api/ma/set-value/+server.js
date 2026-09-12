import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabase/server.js';
import { recordMesoEarnedFromSetValue1 } from '$lib/supabase/mesoTracking.js';

async function ensureUserExistsByEmail(email) {
	const { data, error } = await supabaseServer
		.from('user_info')
		.select('email')
		.eq('email', email)
		.limit(1);

	if (error) {
		console.error('ma/set-value email existence error:', error);
		return { ok: false, status: 500, body: { success: false, error: '사용자 확인 중 오류가 발생했습니다.' } };
	}
	if (!Array.isArray(data) || !data[0]?.email) {
		return { ok: false, status: 404, body: { success: false, error: '존재하지 않는 이메일입니다.' } };
	}
	return { ok: true };
}

/** user_info.set_value_1 에 ma 전용 문자열 저장 */
async function setValue(email, password, text) {
	if (!email) {
		return { ok: false, status: 400, body: { success: false, error: '이메일(id)이 필요합니다.' } };
	}
	if (text === undefined || text === null) {
		return { ok: false, status: 400, body: { success: false, error: 'text 값이 필요합니다.' } };
	}

	const value = typeof text === 'string' ? text.trim() : String(text).trim();

	const exists = await ensureUserExistsByEmail(email);
	if (!exists.ok) {
		return exists;
	}

	const now = new Date().toISOString();
	const { error: updateError } = await supabaseServer
		.from('user_info')
		.update({ set_value_1: value, api_at: now })
		.eq('email', email);

	if (updateError) {
		console.error('ma/set-value update error:', updateError);
		return { ok: false, status: 500, body: { success: false, error: 'set_value_1 저장 중 오류가 발생했습니다.' } };
	}

	const mesoTracking = await recordMesoEarnedFromSetValue1(supabaseServer, email, value);
	if (!mesoTracking.ok) {
		console.error('meso tracking error:', mesoTracking.error);
	}

	return {
		ok: true,
		body: {
			success: true,
			message: 'set_value_1가 반영되었습니다.',
			column: 'set_value_1',
			updated_at: now,
			meso_tracking: mesoTracking
		}
	};
}

/**
 * GET /api/ma/set-value
 * - 쿼리: email, password, text
 * - user_info.set_value_1 에 저장 (기존 /api/set-value 는 변경하지 않음)
 * - 예: ?email=test@gmail.com&password=test11&text=[설정]^g레벨=22^g직업=히어로^g아바타=있음^g펫=2개^g묘묘=30일^g보유메소=12345
 */
export async function GET({ url }) {
	try {
		const email = decodeURIComponent(url.searchParams.get('email') || url.searchParams.get('id') || '')
			.trim()
			.toLowerCase();
		// eslint-disable-next-line no-unused-vars
		const password = decodeURIComponent(url.searchParams.get('password') || url.searchParams.get('pw') || '');
		const text = url.searchParams.has('text') ? decodeURIComponent(url.searchParams.get('text') || '') : undefined;

		const result = await setValue(email, password, text);
		return json(result.body, { status: result.ok ? 200 : result.status });
	} catch (error) {
		console.error('API ma/set-value GET Error:', error);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}

/**
 * POST /api/ma/set-value
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
		console.error('API ma/set-value POST Error:', error);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}
