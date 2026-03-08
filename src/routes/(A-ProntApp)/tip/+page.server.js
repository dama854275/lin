import { supabase } from '$lib/supabase/client';

export async function load() {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('title', 'TIP')
            .single();

        if (error) {
            console.error('TIP 로딩 에러:', error);
            return {
                manual: null
            };
        }

        return {
            manual: data
        };
    } catch (error) {
        console.error('TIP 로딩 중 오류 발생:', error);
        return {
            manual: null
        };
    }
} 