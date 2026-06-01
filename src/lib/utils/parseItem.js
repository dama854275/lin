/** 괄호 숫자와 무관하게 항상 1개로 취급하는 아이템 */
const SINGLE_COUNT_ITEM_NAMES = new Set(['말하는 두루마리', '등잔']);

export function isSingleCountItem(name) {
	const trimmed = (name || '').trim();
	if (!trimmed) return false;
	if (SINGLE_COUNT_ITEM_NAMES.has(trimmed)) return true;
	return trimmed.includes('편지') || trimmed.includes('양초');
}

/** "순간이동 주문서 (5)" → { name, count } */
export function parseItemEntry(itemStr) {
	if (!itemStr || typeof itemStr !== 'string') return null;
	const trimmed = itemStr.trim();
	if (!trimmed || trimmed === '-') return null;

	const match = trimmed.match(/^(.+?)\s*\((\d+)\)\s*$/);
	if (match) {
		const name = match[1].trim();
		if (isSingleCountItem(name)) {
			return { name, count: 1 };
		}
		const count = parseInt(match[2], 10);
		return { name, count: !isNaN(count) && count >= 0 ? count : 1 };
	}

	const name = trimmed;
	if (isSingleCountItem(name)) {
		return { name, count: 1 };
	}

	return { name, count: 1 };
}

export function getDisplayItems(items) {
	if (!items || !Array.isArray(items)) return [];
	return items
		.map((item) => (item && typeof item === 'string' ? item.trim() : ''))
		.filter((item) => item !== '' && item !== '-');
}

/** 팝업 표시용 문자열 (단일 개수 아이템은 항상 (1)로 표시) */
export function formatItemForDisplay(itemStr) {
	const parsed = parseItemEntry(itemStr);
	if (!parsed) return null;
	if (isSingleCountItem(parsed.name)) {
		return `${parsed.name} (1)`;
	}
	const trimmed = itemStr.trim();
	if (/^.+?\s*\(\d+\)\s*$/.test(trimmed)) {
		return trimmed;
	}
	return parsed.count > 1 ? `${parsed.name} (${parsed.count})` : parsed.name;
}

export function getPopupDisplayItems(items) {
	return getDisplayItems(items)
		.map((item) => formatItemForDisplay(item))
		.filter(Boolean);
}

export function hasDisplayList(items) {
	return getDisplayItems(items).length > 0;
}

/** 단일 계정 아이템 목록 → { [이름]: 개수 } */
export function aggregateItemCounts(items) {
	const counts = {};
	const singleCountSeen = new Set();

	for (const item of getDisplayItems(items)) {
		const parsed = parseItemEntry(item);
		if (!parsed) continue;

		if (isSingleCountItem(parsed.name)) {
			if (singleCountSeen.has(parsed.name)) continue;
			singleCountSeen.add(parsed.name);
			counts[parsed.name] = 1;
			continue;
		}

		counts[parsed.name] = (counts[parsed.name] || 0) + parsed.count;
	}

	return counts;
}

/** 여러 counts 객체 병합 */
export function mergeItemCountMaps(...maps) {
	const merged = {};
	for (const map of maps) {
		if (!map) continue;
		for (const [name, count] of Object.entries(map)) {
			merged[name] = (merged[name] || 0) + count;
		}
	}
	return merged;
}
