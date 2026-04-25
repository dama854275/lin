import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

function normalizeEnv(v) {
	if (!v) return v;
	const s = String(v).trim();
	if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
		return s.slice(1, -1).trim();
	}
	return s;
}

const supabaseUrl = normalizeEnv(PUBLIC_SUPABASE_URL);
const supabaseAnonKey = normalizeEnv(PUBLIC_SUPABASE_ANON_KEY);
const supabaseServiceRoleKey = normalizeEnv(SUPABASE_SERVICE_ROLE_KEY);

function getProjectRefFromUrl(url) {
	try {
		const u = new URL(url);
		const host = u.hostname || '';
		// <ref>.supabase.co
		return host.split('.')[0] || '';
	} catch {
		return '';
	}
}

function decodeJwtPayloadUnsafe(token) {
	// 서명 검증 없이 payload만 디코딩 (디버깅 목적)
	try {
		const parts = String(token || '').split('.');
		if (parts.length < 2) return null;
		const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
		const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
		const jsonStr = Buffer.from(b64 + pad, 'base64').toString('utf8');
		return JSON.parse(jsonStr);
	} catch {
		return null;
	}
}

function getProjectRefFromJwtPayload(payload) {
	try {
		const iss = String(payload?.iss || '');
		// e.g. https://<ref>.supabase.co/auth/v1
		const m = iss.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
		return m?.[1] || '';
	} catch {
		return '';
	}
}

// 토큰 검증(요청자 확인)은 anon 키로 수행 (서비스 롤 키/정책 이슈와 분리)
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
	auth: { autoRefreshToken: false, persistSession: false }
});

// 실제 계정 생성/DB 반영은 서비스 롤 키로 수행
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
	auth: { autoRefreshToken: false, persistSession: false }
});

function getBearerToken(request) {
	const auth = request.headers.get('authorization') || '';
	const m = auth.match(/^Bearer\s+(.+)$/i);
	return m?.[1]?.trim() || '';
}

async function requireAdminOrManager(request) {
	const token = getBearerToken(request);
	if (!token) {
		return { ok: false, status: 401, body: { success: false, error: '인증 토큰이 필요합니다.' } };
	}

	const { data, error } = await supabaseAuth.auth.getUser(token);
	if (error || !data?.user?.email) {
		const serverRef = getProjectRefFromUrl(supabaseUrl);
		const payload = decodeJwtPayloadUnsafe(token);
		const tokenRef = getProjectRefFromJwtPayload(payload);
		return {
			ok: false,
			status: 401,
			body: {
				success: false,
				error: '인증에 실패했습니다. (토큰 프로젝트와 서버 Supabase 프로젝트가 다를 수 있습니다.)',
				debug: {
					serverProjectRef: serverRef || null,
					tokenProjectRef: tokenRef || null,
					tokenAud: payload?.aud ?? null,
					tokenIss: payload?.iss ?? null
				}
			}
		};
	}

	const email = data.user.email.toLowerCase();
	const { data: userInfo, error: infoErr } = await supabaseAdmin
		.from('user_info')
		.select('level')
		.eq('email', email)
		.maybeSingle();

	if (infoErr) {
		console.error('admin auth level fetch error:', infoErr);
		return { ok: false, status: 500, body: { success: false, error: '권한 확인 중 오류가 발생했습니다.' } };
	}

	const level = String(userInfo?.level ?? '').trim();
	if (level !== '1' && level !== '2') {
		return { ok: false, status: 403, body: { success: false, error: '권한이 없습니다.' } };
	}

	return { ok: true, requesterEmail: email, requesterLevel: level };
}

/**
 * POST /api/admin/create-user
 * - 서비스 롤 키로 Auth 사용자 생성 + user_info upsert
 * - Body: { email, password, level, referrer_email }
 * - Authorization: Bearer <access_token> (요청자: level 1 또는 2)
 */
export async function POST({ request }) {
	try {
		const authz = await requireAdminOrManager(request);
		if (!authz.ok) return json(authz.body, { status: authz.status });

		const body = await request.json();
		const email = String(body?.email || '').trim().toLowerCase();
		const password = String(body?.password || '');
		const level = String(body?.level || '').trim();
		const referrer_email =
			body?.referrer_email === null || body?.referrer_email === undefined
				? null
				: String(body?.referrer_email || '').trim().toLowerCase();

		if (!email || !email.includes('@')) {
			return json({ success: false, error: '올바른 이메일이 필요합니다.' }, { status: 400 });
		}
		if (!password || password.length < 6) {
			return json({ success: false, error: '비밀번호는 최소 6자 이상이어야 합니다.' }, { status: 400 });
		}
		if (!['2', '3'].includes(level)) {
			return json({ success: false, error: 'level 값이 올바르지 않습니다.' }, { status: 400 });
		}
		if (level === '3' && (!referrer_email || !referrer_email.includes('@'))) {
			return json({ success: false, error: '상위 이메일(referrer_email)이 필요합니다.' }, { status: 400 });
		}

		// 1) Auth 사용자 생성 (이미 있으면 계속 진행)
		let alreadyExists = false;
		const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
			email,
			password,
			email_confirm: true
		});

		if (createErr) {
			const msg = createErr.message || '';
			alreadyExists = /already registered|already exists|User already registered/i.test(msg);
			if (!alreadyExists) {
				console.error('admin createUser error:', createErr);
				return json(
					{ success: false, error: `Auth 계정 생성 실패: ${createErr.message || '알 수 없음'}` },
					{ status: 500 }
				);
			}
		}

		// 2) user_info upsert (email 기준)
		const row = {
			email,
			referrer_email: level === '3' ? referrer_email : null,
			product_period: null,
			product_token: null,
			level
		};

		const { error: upsertErr } = await supabaseAdmin
			.from('user_info')
			.upsert([row], { onConflict: 'email' });

		if (upsertErr) {
			console.error('user_info upsert error:', upsertErr);
			return json(
				{ success: false, error: `user_info 저장 실패: ${upsertErr.message || '알 수 없음'}` },
				{ status: 500 }
			);
		}

		return json({
			success: true,
			alreadyExists,
			createdUserId: created?.user?.id ?? null
		});
	} catch (error) {
		console.error('API admin/create-user Error:', error);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}

