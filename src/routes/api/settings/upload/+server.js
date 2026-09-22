import { json } from '@sveltejs/kit';
import { requirePresetSession } from '$lib/settings/auth.js';
import { MAX_SETTINGS_BYTES, normalizeSlotId } from '$lib/settings/filenameMap.js';
import { uploadSlotZip } from '$lib/settings/serverStore.js';

export async function POST({ request }) {
	try {
		const auth = await requirePresetSession(request);
		if (!auth.ok) return json({ success: false, error: auth.error }, { status: auth.status });

		const form = await request.formData();
		const slotId = normalizeSlotId(form.get('slot'));
		const file = form.get('file');
		if (!slotId) {
			return json({ success: false, error: '슬롯 번호는 1~10 입니다.' }, { status: 400 });
		}
		if (!file || typeof file.arrayBuffer !== 'function') {
			return json({ success: false, error: 'zip 파일이 필요합니다.' }, { status: 400 });
		}
		if (file.size > MAX_SETTINGS_BYTES) {
			return json({ success: false, error: '최대 10MB까지 올릴 수 있습니다.' }, { status: 400 });
		}

		const bytes = new Uint8Array(await file.arrayBuffer());
		const result = await uploadSlotZip(auth.email, slotId, bytes, file.size);
		return json({ success: true, ...result });
	} catch (err) {
		console.error('settings upload error:', err);
		return json({ success: false, error: err.message || '업로드에 실패했습니다.' }, { status: 500 });
	}
}
