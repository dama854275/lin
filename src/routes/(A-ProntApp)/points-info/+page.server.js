import { supabase } from '$lib/supabase/client';

export async function load() {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('title', '포인트 안내')
            .single();

        if (error) {
            console.error('포인트 안내 로딩 에러:', error);
            return {
                pointInfo: null
            };
        }

        return {
            pointInfo: data
        };
    } catch (error) {
        console.error('포인트 안내 로딩 중 오류 발생:', error);
        return {
            pointInfo: null
        };
    }
} 