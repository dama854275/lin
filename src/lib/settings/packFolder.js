import { validateFolderSelection } from './filenameMap.js';
import { buildZipBytes, zipBytesToBlob } from './zipStore.js';

export async function packSelectedFolder(fileList) {
	const checked = validateFolderSelection(fileList);
	if (!checked.ok) {
		return { ok: false, error: checked.error };
	}

	const entries = [];
	for (const item of checked.iniFiles) {
		const data = new Uint8Array(await item.file.arrayBuffer());
		entries.push({ name: item.zipName, data });
	}

	const bytes = buildZipBytes(entries);
	return {
		ok: true,
		blob: zipBytesToBlob(bytes),
		size: bytes.length,
		count: entries.length,
		folderName: checked.folderName
	};
}
