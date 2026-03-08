import { supabaseServer } from '$lib/supabase/server';
import { error, fail } from '@sveltejs/kit';

export const load = async () => {
    try {
        // Get all products from product_info
        const { data: products, error: productsError } = await supabaseServer
            .from('product_info')
            .select('product_name2')
            .order('product_name2');

        if (productsError) {
            console.error('상품 데이터 로드 오류:', productsError);
            return { 
                products: [],
                versionData: {},
                error: '상품 정보를 불러오는데 실패했습니다.'
            };
        }

        console.log('상품 목록:', products); // 디버깅: 상품 목록 확인

        // Get version control data (단일 행)
        const { data: versionData, error: versionError } = await supabaseServer
            .from('ver_control')
            .select('*')
            .single();

        console.log('버전 데이터 원본:', versionData); // 디버깅: 버전 데이터 원본 확인
        console.log('버전 데이터 에러:', versionError); // 디버깅: 버전 데이터 에러 확인

        // 버전 데이터가 없는 경우 새로운 행 생성
        if (versionError || !versionData) {
            console.log('버전 데이터가 없어 새로 생성을 시도합니다.');
            
            // 새로운 행 생성 시도
            const { data: newVersionData, error: insertError } = await supabaseServer
                .from('ver_control')
                .insert([{}])
                .select()
                .single();

            if (insertError) {
                console.error('새 버전 데이터 생성 실패:', insertError);
                return { 
                    products,
                    versionData: {},
                    error: null
                };
            }

            console.log('새로 생성된 버전 데이터:', newVersionData);
            return { 
                products,
                versionData: {},
                error: null
            };
        }

        // 버전 데이터를 상품별로 정리
        const versionDataByProduct = {};
        
        // 각 상품에 대해 ver_control 테이블의 해당 컬럼 값을 버전으로 사용
        products.forEach(product => {
            const productName = product.product_name2;
            versionDataByProduct[productName] = versionData[productName] || '';
            console.log(`상품 ${productName}의 버전:`, versionData[productName]); // 디버깅: 각 상품별 버전 확인
        });

        console.log('최종 버전 데이터:', versionDataByProduct);

        return {
            products,
            versionData: versionDataByProduct,
            error: null
        };
    } catch (err) {
        console.error('데이터 로드 실패:', err);
        return {
            products: [],
            versionData: {},
            error: err.message || '서버 오류가 발생했습니다.'
        };
    }
};

export const actions = {
    update: async ({ request }) => {
        try {
            const formData = await request.formData();
            const productName = formData.get('productName');
            const version = formData.get('version');

            console.log('업데이트 요청:', { productName, version }); // 디버깅

            if (!productName || !version) {
                return fail(400, {
                    error: '제품명과 버전 정보가 필요합니다.'
                });
            }

            // 현재 버전 정보 조회
            const { data: currentData, error: selectError } = await supabaseServer
                .from('ver_control')
                .select(productName)
                .eq('id', 1)
                .single();

            if (selectError) {
                console.error('현재 버전 조회 오류:', selectError);
                return fail(500, {
                    error: '현재 버전 정보를 조회하는데 실패했습니다.'
                });
            }

            // 현재 버전과 새로운 버전이 다른 경우에만 업데이트
            if (currentData[productName] !== version) {
                const { data, error: updateError } = await supabaseServer
                    .from('ver_control')
                    .update({ [productName]: version })
                    .eq('id', 1)
                    .select();

                if (updateError) {
                    console.error('버전 업데이트 오류:', updateError);
                    return fail(500, {
                        error: '버전 정보 업데이트에 실패했습니다.'
                    });
                }

                return {
                    success: true,
                    message: '버전이 성공적으로 업데이트되었습니다.'
                };
            } else {
                return {
                    success: true,
                    message: '현재 버전과 동일하여 업데이트가 필요하지 않습니다.'
                };
            }
        } catch (err) {
            console.error('업데이트 처리 오류:', err);
            return fail(500, {
                error: '서버 오류가 발생했습니다.'
            });
        }
    }
}; 