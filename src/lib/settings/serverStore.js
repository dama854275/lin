import { supabaseServer } from '$lib/supabase/server.js';
import {
	SETTINGS_BUCKET,
	SLOT_COUNT,
	defaultSlotName,
	metaObjectPath,
	normalizeSlotId,
	zipObjectPath
} from './filenameMap.js';

function emptySlots() {
	return Array.from({ length: SLOT_COUNT }, (_, i) => ({
		slot_id: i + 1,
		name: defaultSlotName(i + 1),
		size_bytes: 0,
		updated_at: null,
		has_file: false
	}));
}

export async function readMeta(email) {
	const path = metaObjectPath(email);
	const { data, error } = await supabaseServer.storage.from(SETTINGS_BUCKET).download(path);
	if (error || !data) return {};
	try {
		const text = await data.text();
		const parsed = JSON.parse(text);
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

export async function writeMeta(email, meta) {
	const path = metaObjectPath(email);
	const body = JSON.stringify(meta || {});
	const { error } = await supabaseServer.storage.from(SETTINGS_BUCKET).upload(
		path,
		new Blob([body], { type: 'application/json' }),
		{
			upsert: true,
			contentType: 'application/json'
		}
	);
	if (error) throw error;
}

export async function listSlots(email) {
	const [meta, listed] = await Promise.all([
		readMeta(email),
		supabaseServer.storage.from(SETTINGS_BUCKET).list(String(email).trim().toLowerCase())
	]);

	const files = new Set((listed.data || []).map((item) => item.name));
	const slots = emptySlots();

	for (const slot of slots) {
		const key = String(slot.slot_id);
		const saved = meta[key] || {};
		const hasFile = files.has(`${slot.slot_id}.zip`);
		const savedName = typeof saved.name === 'string' ? saved.name.trim() : '';
		slot.name = savedName && savedName !== '-' && savedName !== '메모' ? savedName : '';
		slot.size_bytes = hasFile ? Number(saved.size_bytes) || 0 : 0;
		slot.updated_at = hasFile ? saved.updated_at || null : null;
		slot.has_file = hasFile;
	}

	return slots;
}

export async function saveSlotMeta(email, slotId, patch) {
	const id = normalizeSlotId(slotId);
	if (!id) throw new Error('슬롯 번호는 1~10 입니다.');
	const meta = await readMeta(email);
	const key = String(id);
	meta[key] = {
		...(meta[key] || {}),
		...patch
	};
	await writeMeta(email, meta);
	return meta[key];
}

export async function uploadSlotZip(email, slotId, bytes, sizeBytes) {
	const id = normalizeSlotId(slotId);
	if (!id) throw new Error('슬롯 번호는 1~10 입니다.');
	const path = zipObjectPath(email, id);
	const { error } = await supabaseServer.storage.from(SETTINGS_BUCKET).upload(
		path,
		new Blob([bytes], { type: 'application/zip' }),
		{
			upsert: true,
			contentType: 'application/zip'
		}
	);
	if (error) throw error;
	const updatedAt = new Date().toISOString();
	await saveSlotMeta(email, id, {
		size_bytes: sizeBytes,
		updated_at: updatedAt
	});
	return { slot_id: id, size_bytes: sizeBytes, updated_at: updatedAt, has_file: true };
}

export async function resetSlot(email, slotId) {
	const id = normalizeSlotId(slotId);
	if (!id) throw new Error('슬롯 번호는 1~10 입니다.');
	const path = zipObjectPath(email, id);
	await supabaseServer.storage.from(SETTINGS_BUCKET).remove([path]);
	const meta = await readMeta(email);
	delete meta[String(id)];
	await writeMeta(email, meta);
	return {
		slot_id: id,
		name: defaultSlotName(id),
		size_bytes: 0,
		updated_at: null,
		has_file: false
	};
}

export async function downloadSlotZip(email, slotId) {
	const id = normalizeSlotId(slotId);
	if (!id) throw new Error('슬롯 번호는 1~10 입니다.');
	const path = zipObjectPath(email, id);
	const { data, error } = await supabaseServer.storage.from(SETTINGS_BUCKET).download(path);
	if (error || !data) {
		const err = new Error('해당 슬롯에 올린 설정이 없습니다.');
		err.status = 404;
		throw err;
	}
	return { blob: data, filename: `${id}.zip` };
}
