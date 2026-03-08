import { supabase } from '$lib/supabase/client';
import { fail } from '@sveltejs/kit';

export async function load() {
    try {
        const { data: products, error } = await supabase
            .from('product_info')
            .select('*')
            .order('required_points');

        if (error) {
            throw error;
        }

        return {
            products
        };
    } catch (err) {
        return {
            products: []
        };
    }
}

export const actions = {
    // 구매 처리 서버 액션
    purchaseProduct: async ({ request }) => {
        const formData = await request.formData();
        const userId = formData.get('userId');
        const productName2 = formData.get('productName2');
        const requiredPoints = parseInt(formData.get('requiredPoints'));
        const productName = formData.get('productName');

        try {
            // 구매 처리
            const { error: purchaseError } = await supabase
                .rpc('purchase_product', {
                    p_user_id: userId,
                    p_product_name2: productName2,
                    p_required_points: requiredPoints,
                    p_product_name: productName
                });

            if (purchaseError) throw purchaseError;

            // 추천인 보상 처리 // 현재 사용자 정보 조회
            const { data: currentUser, error: fetchError } = await supabase
                .from('user_info')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (fetchError) throw fetchError;
            
            if (currentUser.referrer_id) {
                // 추천인 정보 조회
                const { data: referrerData, error: referrerError } = await supabase
                    .from('user_info')
                    .select('email')
                    .eq('user_id', currentUser.referrer_id)
                    .single();

                if (referrerError) {
                    console.error('추천인 정보 조회 오류:', referrerError);
                    return;
                }

                const { error: rewardError } = await supabase
                    .rpc('process_referrer_reward', {
                        p_referrer_id: currentUser.referrer_id,
                        p_purchase_points: requiredPoints,
                        p_from_email: currentUser.email,
                        p_to_email: referrerData.email
                    });

                if (rewardError) {
                    console.error('추천인 보상 처리 오류:', rewardError);
                    // 추천인 보상 실패는 전체 트랜잭션을 롤백하지 않음
                }
            }

            return { success: true };
        } catch (error) {
            return fail(400, { 
                error: error.message || '구매 처리 중 오류가 발생했습니다.' 
            });
        }
    },

   

    // 선물 처리 서버 액션
    giftProduct: async ({ request }) => {
        const formData = await request.formData();
        const senderId = formData.get('senderId');
        const receiverId = formData.get('receiverId');
        const productName2 = formData.get('productName2');
        const requiredPoints = parseInt(formData.get('requiredPoints'));
        const productName = formData.get('productName');

        try {
            // 선물 처리
            const { error: giftError } = await supabase
                .rpc('gift_product', {
                    p_sender_id: senderId,
                    p_receiver_id: receiverId,
                    p_product_name2: productName2,
                    p_required_points: requiredPoints,
                    p_product_name: productName
                });

            if (giftError) throw giftError;

            // 추천인 보상 처리 // 현재 사용자 정보 조회
            const { data: senderData, error: senderError } = await supabase
                .from('user_info')
                .select('referrer_id')
                .eq('user_id', senderId)
                .single();

            if (senderError) throw senderError;

            if (senderData.referrer_id) {
                // 추천인 정보 조회
                const { data: referrerData, error: referrerError } = await supabase
                    .from('user_info')
                    .select('email')
                    .eq('user_id', senderData.referrer_id)
                    .single();

                if (referrerError) {
                    console.error('추천인 정보 조회 오류:', referrerError);
                    return;
                }

                const { error: rewardError } = await supabase
                    .rpc('process_referrer_reward', {
                        p_referrer_id: senderData.referrer_id,
                        p_purchase_points: requiredPoints,
                        p_from_email: senderData.email,
                        p_to_email: referrerData.email
                    });

                if (rewardError) {
                    console.error('추천인 보상 처리 오류:', rewardError);
                    // 추천인 보상 실패는 전체 트랜잭션을 롤백하지 않음
                }
            }

            return { success: true };
        } catch (error) {
            return fail(400, { 
                error: error.message || '선물 처리 중 오류가 발생했습니다.' 
            });
        }
    }
};
