import { supabase } from '$lib/supabase/client';
import { error } from '@sveltejs/kit';

export const ssr = false;

export async function load() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            throw error(401, '로그인이 필요합니다.');
        }

        // 관리자 체크 수정
        const { data: adminData, error: adminError } = await supabase
            .from('admin_users')
            .select('*')
            .eq('user_id', session.user.id);

        const isAdmin = adminData && adminData.length > 0;

        // 문의 데이터 쿼리
        let query = supabase
            .from('contacts')
            .select('id, title, content, status, created_at, user_id, user_email, classification, game_classification')
            .order('created_at', { ascending: false });

        if (!isAdmin) {
            query = query.eq('user_id', session.user.id);
        }

        const { data: contacts, error: contactsError } = await query;

        if (contactsError) throw contactsError;

        return {
            contacts: contacts || [],
            isAdmin
        };

    } catch (err) {
        console.error('Load error:', err);
        throw error(err.status || 500, err.message || '데이터를 불러오는데 실패했습니다.');
    }
}