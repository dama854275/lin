import { json } from '@sveltejs/kit';
import { getUserInfo, updateToken } from '$lib/server/dama/auth.js';

export async function GET({ url }) {
    try {
        // URL 파라미터에서 필요한 정보를 가져오고 디코딩
        const email = decodeURIComponent(url.searchParams.get('email') || '');
        const password = decodeURIComponent(url.searchParams.get('password') || '');
        const column = decodeURIComponent(url.searchParams.get('column') || '');
        const action = decodeURIComponent(url.searchParams.get('action') || '');

        if (!email || !password || !column) {
            return json({
                success: false,
                error: '이메일, 비밀번호, 조회할 컬럼명이 필요합니다.'
            }, { status: 400 });
        }

        // 토큰 업데이트 요청인 경우
        if (action === 'update_token') {
            const tokenColumn = `token_${column}`;
            const result = await updateToken(email, password, tokenColumn);
            if (!result.success) {
                return json(result, { status: 401 });
            }
            return json(result);
        }

        // 일반 컬럼 조회
        const productColumn = `product_${column}`;
        const result = await getUserInfo(email, password, productColumn);
        if (!result.success) {
            return json(result, { status: 401 });
        }

        return json(result);
    } catch (error) {
        console.error('API Error:', error);
        return json({
            success: false,
            error: '서버 오류가 발생했습니다.'
        }, { status: 500 });
    }
} 