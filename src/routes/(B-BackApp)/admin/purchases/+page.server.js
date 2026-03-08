import { supabase } from '$lib/supabase/client';

export async function load({ locals: { supabase } }) {
    try {
        const { data: historyData, error: historyError } = await supabase
            .from('point_history')
            .select('*')
            .order('created_at', { ascending: false });

        if (historyError) throw historyError;

        // 사용자 정보 별도 조회
        const { data: userData, error: userError } = await supabase
            .from('user_info')
            .select('user_id, email');

        if (userError) throw userError;

        // 사용자 정보를 Map으로 변환하여 빠른 조회 가능하게 함
        const userMap = new Map(userData.map(user => [user.user_id, user]));

        // 구매 내역에 사용자 정보 추가
        const purchaseHistory = historyData.map(history => ({
            ...history,
            user_email: userMap.get(history.user_id)?.email || 'Unknown'
        }));

        return {
            purchases: purchaseHistory
        };
    } catch (error) {
        console.error('구매내역 로드 중 오류:', error);
        return {
            purchases: []
        };
    }
}