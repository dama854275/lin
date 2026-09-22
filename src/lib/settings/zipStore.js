const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
	let c = i;
	for (let k = 0; k < 8; k += 1) {
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	}
	CRC_TABLE[i] = c >>> 0;
}

function crc32(data) {
	let crc = 0xffffffff;
	for (let i = 0; i < data.length; i += 1) {
		crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function u16(n) {
	return Uint8Array.of(n & 0xff, (n >>> 8) & 0xff);
}

function u32(n) {
	return Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
}

function concat(parts) {
	const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

/** STORE(무압축) zip. 한글 파일명은 UTF-8 플래그로 넣는다. */
export function buildZipBytes(entries) {
	const locals = [];
	const centrals = [];
	let offset = 0;
	const utf8Flag = 0x0800;

	for (const entry of entries) {
		const nameBytes = new TextEncoder().encode(entry.name);
		const data = entry.data;
		const crc = crc32(data);
		const local = concat([
			u32(0x04034b50),
			u16(20),
			u16(utf8Flag),
			u16(0),
			u16(0),
			u16(0),
			u32(crc),
			u32(data.length),
			u32(data.length),
			u16(nameBytes.length),
			u16(0),
			nameBytes,
			data
		]);
		const central = concat([
			u32(0x02014b50),
			u16(20),
			u16(20),
			u16(utf8Flag),
			u16(0),
			u16(0),
			u16(0),
			u32(crc),
			u32(data.length),
			u32(data.length),
			u16(nameBytes.length),
			u16(0),
			u16(0),
			u16(0),
			u16(0),
			u32(0),
			u32(offset),
			nameBytes
		]);
		locals.push(local);
		centrals.push(central);
		offset += local.length;
	}

	const centralDir = concat(centrals);
	const eocd = concat([
		u32(0x06054b50),
		u16(0),
		u16(0),
		u16(entries.length),
		u16(entries.length),
		u32(centralDir.length),
		u32(offset),
		u16(0)
	]);

	return concat([...locals, centralDir, eocd]);
}

export function zipBytesToBlob(bytes) {
	return new Blob([bytes], { type: 'application/zip' });
}
