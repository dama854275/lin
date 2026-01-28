import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// 환경변수 검증
if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
        'Supabase 환경변수가 설정되지 않았습니다. .env 파일에 PUBLIC_SUPABASE_URL과 PUBLIC_SUPABASE_ANON_KEY를 설정해주세요.'
    );
}

export const supabaseServer = createClient(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY,
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
