import { supabase } from '$lib/supabase/client';
import { error } from '@sveltejs/kit';

export const ssr = false;

export async function load({ params }) {
    try {
        // 세션 체크
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            window.location.href = '/login';
            return;
        }

        // 문의글 데이터 가져오기
        const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', params.id)
            .single();

        if (contactError) {
            console.error('Contact fetch error:', contactError);
            throw error(500, '문의글을 불러오는데 실패했습니다.');
        }

        if (!contact) {
            throw error(404, '문의글을 찾을 수 없습니다.');
        }

        // 관리자 권한 체크 수정
        const { data: adminData, error: adminError } = await supabase
            .from('admin_users')
            .select('*')
            .eq('user_id', session.user.id);

        const isAdmin = adminData && adminData.length > 0;
        const isOwner = contact.user_id === session.user.id;

        // 접근 권한 체크
        if (!isOwner && !isAdmin) {
            window.location.href = '/contact';
            return;
        }

        return {
            contact,
            isAdmin,
            isOwner
        };

    } catch (err) {
        console.error('Load error:', err);
        throw error(err.status || 500, err.message || '데이터를 불러오는데 실패했습니다.');
    }
}