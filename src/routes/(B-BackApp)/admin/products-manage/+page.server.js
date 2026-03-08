import { supabaseServer } from '$lib/supabase/server';
import { error, fail } from '@sveltejs/kit';

export const load = async () => {
    try {
        const { data: sampleUser, error: sampleError } = await supabaseServer
            .from('user_info')
            .select('*')
            .limit(1)
            .single();

        if (sampleError) {
            console.error('샘플 데이터 로드 오류:', sampleError);
            return { 
                users: [],
                error: '테이블 정보를 불러오는데 실패했습니다.'
            };
        }

        const productColumns = Object.keys(sampleUser)
            .filter(key => key.startsWith('product_'));

        const selectQuery = ['user_id', 'email', ...productColumns].join(', ');

        const { data: users, error: userError } = await supabaseServer
            .from('user_info')
            .select(selectQuery)
            .order('email');

        if (userError) {
            console.error('사용자 데이터 로드 오류:', userError);
            return { 
                users: [],
                error: '데이터를 불러오는데 실패했습니다.'
            };
        }

        const processedUsers = users.map(user => {
            const products = {};
            productColumns.forEach(column => {
                products[column] = user[column];
            });

            return {
                email: user.email,
                user_id: user.user_id,
                products: products
            };
        });

        return {
            users: processedUsers,
            productColumns: productColumns,
            error: null
        };
    } catch (err) {
        console.error('사용자 데이터 로드 실패:', err);
        return {
            users: [],
            productColumns: [],
            error: err.message || '서버 오류가 발생했습니다.'
        };
    }
};

export const actions = {
    updateDate: async ({ request }) => {
        try {
            const formData = await request.formData();
            const userId = formData.get('userId');
            const productColumn = formData.get('productColumn');
            const newDate = formData.get('newDate');

            if (!userId || !productColumn || !newDate) {
                return fail(400, { 
                    success: false, 
                    message: '필수 데이터가 누락되었습니다.' 
                });
            }

            // RPC 함수 호출
            const { data: result, error: updateError } = await supabaseServer.rpc(
                'admin_update_product_period',
                {
                    user_id_input: userId,
                    product_column: productColumn,
                    new_date: newDate
                }
            );

            if (updateError || !result?.success) {
                console.error('업데이트 오류:', updateError || result?.error);
                return fail(500, {
                    success: false,
                    message: '날짜 업데이트에 실패했습니다.'
                });
            }

            // 거래 내역 기록
            const { error: historyError } = await supabaseServer
                .from('transaction_history')
                .insert({
                    user_id: userId,
                    action: 'admin_update',
                    product_column: productColumn,
                    new_date: newDate
                });

            if (historyError) {
                console.error('거래 내역 기록 오류:', historyError);
            }

            return {
                success: true,
                message: '날짜가 성공적으로 업데이트되었습니다.',
                data: result
            };
        } catch (err) {
            console.error('날짜 업데이트 실패:', err);
            return fail(500, {
                success: false,
                message: '날짜 업데이트에 실패했습니다.'
            });
        }
    },

    resetDate: async ({ request }) => {
        try {
            const formData = await request.formData();
            const userId = formData.get('userId');
            const productColumn = formData.get('productColumn');

            const { data: result, error: resetError } = await supabaseServer.rpc(
                'admin_reset_product_period',
                {
                    user_id_input: userId,
                    product_column: productColumn
                }
            );

            if (resetError || !result?.success) {
                return fail(500, {
                    success: false,
                    message: '날짜 초기화에 실패했습니다.'
                });
            }

            return {
                success: true,
                message: '날짜가 초기화되었습니다.'
            };
        } catch (err) {
            console.error('날짜 초기화 실패:', err);
            return fail(500, {
                success: false,
                message: '날짜 초기화에 실패했습니다.'
            });
        }
    },

    updateAllDates: async ({ request }) => {
        try {
            const formData = await request.formData();
            const productColumn = formData.get('productColumn');
            const daysToAdd = parseInt(formData.get('daysToAdd'));

            if (!productColumn || isNaN(daysToAdd)) {
                return fail(400, {
                    success: false,
                    message: '필수 데이터가 누락되었습니다.'
                });
            }

            const { data: result, error: updateError } = await supabaseServer.rpc(
                'admin_update_product_period_for_active_users',
                {
                    product_column: productColumn,
                    days_to_add: daysToAdd
                }
            );

            if (updateError || !result?.success) {
                console.error('일괄 수정 오류:', updateError || result?.error);
                return fail(500, {
                    success: false,
                    message: '일괄 수정에 실패했습니다.'
                });
            }

            return {
                success: true,
                message: `${result.updated_count}명의 사용자 기간이 수정되었습니다.`
            };
        } catch (err) {
            console.error('일괄 수정 실패:', err);
            return fail(500, {
                success: false,
                message: '일괄 수정에 실패했습니다.'
            });
        }
    }
};