import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabase/server.js';

async function ensureUserExistsByEmail(email) {
	const { data, error } = await supabaseServer
		.from('user_info')
		.select('email')
		.eq('email', email)
		.limit(1);

	if (error) {
		console.error('ma/get-value email existence error:', error);
		return { ok: false, status: 500, body: { success: false, error: '사용자 확인 중 오류가 발생했습니다.' } };
	}
	if (!Array.isArray(data) || !data[0]?.email) {
		return { ok: false, status: 404, body: { success: false, error: '존재하지 않는 이메일입니다.' } };
	}
	return { ok: true };
}

/** user_info.set_value_1 조회 */
async function getValue(email) {
	if (!email) {
		return { ok: false, status: 400, body: { success: false, error: '이메일(id)이 필요합니다.' } };
	}

	const exists = await ensureUserExistsByEmail(email);
	if (!exists.ok) {
		return exists;
	}

	const { data: userData, error: fetchError } = await supabaseServer
		.from('user_info')
		.select('set_value_1, api_at')
		.eq('email', email)
		.single();

	if (fetchError) {
		console.error('ma/get-value fetch error:', fetchError);
		return { ok: false, status: 500, body: { success: false, error: 'set_value_1 조회 중 오류가 발생했습니다.' } };
	}

	return {
		ok: true,
		body: {
			success: true,
			column: 'set_value_1',
			value: userData?.set_value_1 ?? '',
			updated_at: userData?.api_at ?? null
		}
	};
}

/**
 * GET /api/ma/get-value
 * - 쿼리: email, password (또는 id, pw)
 * - user_info.set_value_1 반환 (기존 /api/get-value 는 변경하지 않음)
 */
export async function GET({ url }) {
	try {
		const email = decodeURIComponent(url.searchParams.get('email') || url.searchParams.get('id') || '')
			.trim()
			.toLowerCase();

		const result = await getValue(email);
		return json(result.body, { status: result.ok ? 200 : result.status });
	} catch (error) {
		console.error('API ma/get-value GET Error:', error);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}

/**
 * POST /api/ma/get-value
 * - Body: JSON { email, password } 또는 form-data
 */
export async function POST({ request }) {
	try {
		let email;

		const contentType = request.headers.get('content-type') || '';
		if (contentType.includes('application/json')) {
			const body = await request.json();
			email = (body.email ?? body.id ?? '').toString().trim().toLowerCase();
		} else {
			const form = await request.formData();
			email = (form.get('email') ?? form.get('id') ?? '').toString().trim().toLowerCase();
		}

		const result = await getValue(email);
		return json(result.body, { status: result.ok ? 200 : result.status });
	} catch (error) {
		console.error('API ma/get-value POST Error:', error);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}
