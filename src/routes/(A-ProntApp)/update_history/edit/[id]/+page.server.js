import { supabase } from '$lib/supabase/client';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
    const { data, error: err } = await supabase
        .from('update_history')
        .select('*')
        .eq('id', params.id)
        .single();

    if (err) {
        throw error(404, '업데이트 내역을 찾을 수 없습니다.');
    }

    return {
        update: data
    };
}