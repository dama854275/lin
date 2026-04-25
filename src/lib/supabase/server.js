import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

function normalizeEnv(v) {
	if (!v) return v;
	const s = String(v).trim();
	// Vercel/CI 환경에서 따옴표를 포함해 넣는 실수를 방지
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

const supabaseKey = normalizeEnv(SUPABASE_SERVICE_ROLE_KEY) || normalizeEnv(PUBLIC_SUPABASE_ANON_KEY);

export const supabaseServer = createClient(
    normalizeEnv(PUBLIC_SUPABASE_URL),
    supabaseKey,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        },
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    }
);
