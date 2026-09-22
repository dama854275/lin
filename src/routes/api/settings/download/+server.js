import { json } from '@sveltejs/kit';
import { requirePresetEmail } from '$lib/settings/auth.js';
import { normalizeSlotId } from '$lib/settings/filenameMap.js';
import { downloadSlotZip } from '$lib/settings/serverStore.js';

/**
 * GET /api/settings/download?email=z_a_1_01@gmail.com&slot=3
 * 다른 프로그램은 이 URL로 zip 하나만 받으면 된다.
 */
export async function GET({ url }) {
	try {
		const emailCheck = requirePresetEmail(url.searchParams.get('email') || url.searchParams.get('id'));
		if (!emailCheck.ok) {
			return json({ success: false, error: emailCheck.error }, { status: emailCheck.status });
		}

		const slotId = normalizeSlotId(url.searchParams.get('slot'));
		if (!slotId) {
			return json({ success: false, error: '슬롯 번호는 1~10 입니다.' }, { status: 400 });
		}

		const { blob, filename } = await downloadSlotZip(emailCheck.email, slotId);
		return new Response(blob, {
			status: 200,
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		});
	} catch (err) {
		const status = err.status || 500;
		console.error('settings download error:', err);
		return json({ success: false, error: err.message || '다운로드에 실패했습니다.' }, { status });
	}
}
