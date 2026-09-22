import { supabaseServer } from '$lib/supabase/server.js';
import { isSettingsPresetAccount } from '$lib/utils/groupPrefix.js';

export function normalizeEmail(value) {
	return String(value || '').trim().toLowerCase();
}

export async function requirePresetSession(request) {
	const auth = request.headers.get('authorization') || '';
	const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
	if (!token) {
		return { ok: false, status: 401, error: '로그인이 필요합니다.' };
	}

	const { data, error } = await supabaseServer.auth.getUser(token);
	const email = normalizeEmail(data?.user?.email);
	if (error || !email) {
		return { ok: false, status: 401, error: '로그인이 필요합니다.' };
	}
	if (!isSettingsPresetAccount(email)) {
		return { ok: false, status: 403, error: '이 기능은 아이디가 _01 로 끝나는 계정만 사용할 수 있습니다.' };
	}
	return { ok: true, email };
}

export function requirePresetEmail(email) {
	const normalized = normalizeEmail(email);
	if (!normalized) {
		return { ok: false, status: 400, error: '이메일이 필요합니다.' };
	}
	if (!isSettingsPresetAccount(normalized)) {
		return { ok: false, status: 403, error: '이 기능은 아이디가 _01 로 끝나는 계정만 사용할 수 있습니다.' };
	}
	return { ok: true, email: normalized };
}
