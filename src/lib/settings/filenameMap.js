export const SETTINGS_BUCKET = 'user-settings';
export const SLOT_COUNT = 10;
export const MAX_SETTINGS_BYTES = 10 * 1024 * 1024;
export const ALLOWED_FOLDER_NAMES = new Set(['1', '2']);

export const ALLOWED_INI_NAMES = new Set([
	'설정.ini',
	'개인창고보관list.ini',
	'혈맹창고보관list.ini',
	'무기상인list.ini',
	'방어구상인list.ini',
	'잡화상인list.ini',
	'소모품list.ini',
	'줍기제외list.ini',
	'사냥제외list.ini',
	'사냥우선list.ini',
	'사냥경계list.ini'
]);

export function defaultSlotName(_slotId) {
	return '';
}

export function isDefaultSlotName(name) {
	const value = String(name || '').trim();
	return value === '' || value === '-' || value === '메모';
}

export function normalizeSlotId(value) {
	const n = Number(value);
	if (!Number.isInteger(n) || n < 1 || n > SLOT_COUNT) return null;
	return n;
}

export function zipObjectPath(email, slotId) {
	return `${String(email).trim().toLowerCase()}/${slotId}.zip`;
}

export function metaObjectPath(email) {
	return `${String(email).trim().toLowerCase()}/meta.json`;
}

export function toZipEntryName(file) {
	const parts = splitRelativePath(file);
	if (!parts.length) return null;
	if (ALLOWED_FOLDER_NAMES.has(parts[0]) && parts.length > 1) {
		return parts.slice(1).join('/');
	}
	return parts.join('/');
}

function splitRelativePath(file) {
	const raw = String(file.webkitRelativePath || file.name || '').replace(/\\/g, '/');
	return raw.split('/').filter(Boolean);
}

/**
 * webkitdirectory 로 고른 파일이 폴더 1 또는 2 인지 검사한다.
 * 부모 `설정` 을 고르면 거절한다.
 */
export function validateFolderSelection(fileList) {
	const files = Array.from(fileList || []).filter((f) => f && f.size >= 0);
	if (!files.length) {
		return { ok: false, error: '폴더를 선택해 주세요.' };
	}

	const paths = files.map((file) => splitRelativePath(file));
	const hasNestedNumbered = paths.some(
		(parts) => parts.length >= 3 && ALLOWED_FOLDER_NAMES.has(parts[1])
	);
	const roots = new Set(paths.map((parts) => parts[0]).filter(Boolean));
	const rootName = [...roots][0] || '';

	const flatFilesOnly = paths.every((parts) => parts.length === 1);
	if (hasNestedNumbered || rootName === '설정') {
		return { ok: false, error: '설정 폴더가 아니라 숫자 폴더 1 또는 2를 선택해 주세요.' };
	}
	if (!flatFilesOnly && (roots.size !== 1 || !ALLOWED_FOLDER_NAMES.has(rootName))) {
		return { ok: false, error: '숫자 폴더 1 또는 2를 선택해 주세요.' };
	}

	const packFiles = [];
	let totalBytes = 0;
	for (const file of files) {
		if (file.size <= 0) continue;
		const zipName = toZipEntryName(file);
		if (!zipName || zipName.endsWith('/')) continue;
		totalBytes += file.size;
		packFiles.push({ file, zipName });
	}

	if (!packFiles.length) {
		return { ok: false, error: '선택한 폴더에 올릴 파일이 없습니다.' };
	}
	if (totalBytes > MAX_SETTINGS_BYTES) {
		return { ok: false, error: '최대 10MB까지 올릴 수 있습니다.' };
	}

	return {
		ok: true,
		folderName: ALLOWED_FOLDER_NAMES.has(rootName) ? rootName : '선택 폴더',
		iniFiles: packFiles,
		totalBytes
	};
}
