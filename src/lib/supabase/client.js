import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

function normalizeEnv(v) {
	if (!v) return v;
	const s = String(v).trim();
	if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
		return s.slice(1, -1).trim();
	}
	return s;
}

// 환경변수 검증
if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) {
	throw new Error(
		'Supabase 환경변수가 설정되지 않았습니다. .env 파일에 PUBLIC_SUPABASE_URL과 PUBLIC_SUPABASE_ANON_KEY를 설정해주세요.'
	);
}

export const supabase = createClient(
	normalizeEnv(PUBLIC_SUPABASE_URL),
	normalizeEnv(PUBLIC_SUPABASE_ANON_KEY),
	{
		auth: {
			persistSession: true
		},
		headers: {
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		}
	}
);
