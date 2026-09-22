import { json } from '@sveltejs/kit';
import { requirePresetSession } from '$lib/settings/auth.js';
import { normalizeSlotId } from '$lib/settings/filenameMap.js';
import { resetSlot } from '$lib/settings/serverStore.js';

export async function POST({ request }) {
	try {
		const auth = await requirePresetSession(request);
		if (!auth.ok) return json({ success: false, error: auth.error }, { status: auth.status });

		const body = await request.json();
		const slotId = normalizeSlotId(body?.slot);
		if (!slotId) {
			return json({ success: false, error: '슬롯 번호는 1~10 입니다.' }, { status: 400 });
		}

		const slot = await resetSlot(auth.email, slotId);
		return json({ success: true, slot });
	} catch (err) {
		console.error('settings reset error:', err);
		return json({ success: false, error: err.message || '초기화에 실패했습니다.' }, { status: 500 });
	}
}
