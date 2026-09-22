import { json } from '@sveltejs/kit';
import { requirePresetSession } from '$lib/settings/auth.js';
import { defaultSlotName, normalizeSlotId } from '$lib/settings/filenameMap.js';
import { listSlots, saveSlotMeta } from '$lib/settings/serverStore.js';

export async function GET({ request }) {
	try {
		const auth = await requirePresetSession(request);
		if (!auth.ok) return json({ success: false, error: auth.error }, { status: auth.status });

		const slots = await listSlots(auth.email);
		return json({ success: true, email: auth.email, slots });
	} catch (err) {
		console.error('settings slots GET error:', err);
		return json({ success: false, error: '슬롯 목록을 불러오지 못했습니다.' }, { status: 500 });
	}
}

export async function POST({ request }) {
	try {
		const auth = await requirePresetSession(request);
		if (!auth.ok) return json({ success: false, error: auth.error }, { status: auth.status });

		const body = await request.json();
		const slotId = normalizeSlotId(body?.slot);
		const name = String(body?.name ?? '').trim();
		if (!slotId) {
			return json({ success: false, error: '슬롯 번호는 1~10 입니다.' }, { status: 400 });
		}

		const savedName = name || defaultSlotName(slotId);
		await saveSlotMeta(auth.email, slotId, { name: savedName });
		return json({ success: true, slot_id: slotId, name: savedName });
	} catch (err) {
		console.error('settings slots POST error:', err);
		return json({ success: false, error: '이름을 저장하지 못했습니다.' }, { status: 500 });
	}
}
