import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabase/server.js';

/**
 * GET /api/version-check
 * - LinWeb: program_version 테이블의 version(text) 컬럼 조회
 */
export async function GET() {
	try {
		const { data, error } = await supabaseServer
			.from('program_version')
			.select('version')
			.single();

		if (error) {
			console.error('version-check Supabase Error:', error);
			return json(
				{ success: false, error: '데이터베이스 조회 중 오류가 발생했습니다.' },
				{ status: 500 }
			);
		}

		return json({
			success: true,
			version: data?.version ?? null
		});
	} catch (error) {
		console.error('API version-check Error:', error);
		return json(
			{ success: false, error: '서버 오류가 발생했습니다.' },
			{ status: 500 }
		);
	}
}
