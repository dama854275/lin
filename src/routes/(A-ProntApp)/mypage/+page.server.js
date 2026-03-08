import { supabaseServer } from '$lib/supabase/server';

export const load = async ({ locals }) => {
    try {
        const session = await locals.getSession();
        
        if (!session) {
            return {
                userInfo: null,
                error: null
            };
        }

        const { data: userInfo, error: userError } = await supabaseServer
            .from('user_info')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

        if (userError) {
            console.error('User info fetch error:', userError);
            return {
                userInfo: null,
                error: '사용자 정보를 불러오는데 실패했습니다.'
            };
        }

        return {
            userInfo,
            error: null
        };
    } catch (err) {
        console.error('Server load error:', err);
        return {
            userInfo: null,
            error: '서버 오류가 발생했습니다.'
        };
    }
};