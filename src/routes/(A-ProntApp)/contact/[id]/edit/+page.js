import { supabase } from '$lib/supabase/client';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            throw error(401, '로그인이 필요합니다.');
        }

        const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select('id, title, content, image_url, status, answer, created_at, user_id, classification, game_classification')
            .eq('id', params.id)
            .single();

        if (contactError) {
            throw error(500, '문의글을 불러오는데 실패했습니다.');
        }

        if (!contact) {
            throw error(404, '문의글을 찾을 수 없습니다.');
        }

        if (contact.user_id !== session.user.id) {
            throw error(403, '접근 권한이 없습니다.');
        }

        if (contact.answer) {
            throw error(403, '이미 답변이 있는 문의글은 수정할 수 없습니다.');
        }

        return {
            contact
        };
    } catch (err) {
        throw error(500, err.message);
    }
}