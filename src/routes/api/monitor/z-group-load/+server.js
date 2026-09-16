import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabase/server.js';

function normalizeBound(value) {
	return String(value || '').trim().toLowerCase();
}

function normalizeStatDate(value) {
	const s = String(value || '').trim();
	return s.length >= 10 ? s.slice(0, 10) : s;
}

function parseRpcJson(value) {
	if (value == null) return null;
	if (typeof value === 'string') {
		try {
			return JSON.parse(value);
		} catch {
			return null;
		}
	}
	return value;
}

/**
 * POST /api/monitor/z-group-load
 * z_ 그룹 모니터 첫 로드: user_info + adena 묶음 RPC 병렬 조회
 */
export async function POST({ request }) {
	try {
		const body = await request.json();
		const emailStart = normalizeBound(body?.emailStart);
		const emailEnd = String(body?.emailEnd || '').trim().toLowerCase();
		const dateFrom = normalizeStatDate(body?.dateFrom);
		const dateTo = normalizeStatDate(body?.dateTo);
		const today = normalizeStatDate(body?.today);
		const yesterday = normalizeStatDate(body?.yesterday);

		if (!emailStart || !emailEnd || !dateFrom || !dateTo || !today || !yesterday) {
			return json({ success: false, error: '조회 인자가 올바르지 않습니다.' }, { status: 400 });
		}

		const [userInfoResult, adenaResult] = await Promise.all([
			supabaseServer.rpc('user_info_by_email_range', {
				p_email_start: emailStart,
				p_email_end: emailEnd
			}),
			supabaseServer.rpc('adena_monitor_bundle', {
				p_email_start: emailStart,
				p_email_end: emailEnd,
				p_date_from: dateFrom,
				p_date_to: dateTo,
				p_today: today,
				p_yesterday: yesterday
			})
		]);

		if (userInfoResult.error) {
			console.error('user_info_by_email_range rpc error:', userInfoResult.error);
			return json({ success: false, error: '회원 목록을 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
		}
		if (adenaResult.error) {
			console.error('adena_monitor_bundle rpc error:', adenaResult.error);
			return json({ success: false, error: '획득 아데나 정보를 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
		}

		const membersRaw = parseRpcJson(userInfoResult.data);
		const bundle = parseRpcJson(adenaResult.data) || {};
		const members = Array.isArray(membersRaw) ? membersRaw : [];
		const chart = Array.isArray(bundle.chart) ? bundle.chart : [];
		const memberEarned = Array.isArray(bundle.members) ? bundle.members : [];

		return json({
			success: true,
			members,
			chart,
			memberEarned
		});
	} catch (e) {
		console.error('API monitor z-group-load POST Error:', e);
		return json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
	}
}
