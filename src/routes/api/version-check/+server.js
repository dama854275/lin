import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabase/server.js';

export async function GET({ url }) {
    try {
        // URL 파라미터에서 컬럼명을 가져오고 디코딩
        const column = decodeURIComponent(url.searchParams.get('column') || '');

        if (!column) {
            return json({
                success: false,
                error: '조회할 컬럼명이 필요합니다.'
            }, { status: 400 });
        }

        // ver_control 테이블에서 해당 컬럼의 값을 조회
        const { data, error } = await supabaseServer
            .from('ver_control')
            .select(column)
            .single();

        if (error) {
            console.error('Supabase Error:', error);
            return json({
                success: false,
                error: '데이터베이스 조회 중 오류가 발생했습니다.'
            }, { status: 500 });
        }

        return json({
            success: true,
            version: data[column]
        });

    } catch (error) {
        console.error('API Error:', error);
        return json({
            success: false,
            error: '서버 오류가 발생했습니다.'
        }, { status: 500 });
    }
} 