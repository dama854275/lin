import { supabase } from '$lib/supabase/client';

export async function load() {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('title', '사용 설명')
            .single();

        if (error) {
            console.error('사용 설명 로딩 에러:', error);
            return {
                manual: null
            };
        }

        return {
            manual: data
        };
    } catch (error) {
        console.error('사용 설명 로딩 중 오류 발생:', error);
        return {
            manual: null
        };
    }
} 