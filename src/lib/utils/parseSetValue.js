/**
 * set_value 문자열 파싱
 * 예: [설정]^g레벨=22^g보관아데나=12^g보유아데나=34
 * 예: [설정]^g장착아이템= 6 크로스 보우^g 4 티셔츠^g보유아이템=순간이동 주문서 (5)^g...
 */
export function parseSetValue(str) {
	const result = {
		level: null,
		storageMoney: null,
		money: null,
		equipment: [],
		items: []
	};

	if (!str || typeof str !== 'string') return result;

	const tokens = str
		.split('^g')
		.map((t) => t.trim())
		.filter((t) => t !== '');

	let section = null;

	for (const token of tokens) {
		if (token === '[설정]' || token.startsWith('[설정]')) continue;

		const eqIdx = token.indexOf('=');
		if (eqIdx !== -1) {
			const key = token.substring(0, eqIdx).trim();
			const value = token.substring(eqIdx + 1).trim();

			if (key === '레벨') {
				result.level = value || null;
				section = null;
			} else if (key === '보관아데나') {
				result.storageMoney = value || null;
				section = null;
			} else if (key === '보유아데나') {
				result.money = value || null;
				section = null;
			} else if (key === '장착아이템') {
				section = 'equipment';
				if (value) result.equipment.push(value);
			} else if (key === '보유아이템') {
				section = 'items';
				if (value) result.items.push(value);
			} else {
				section = null;
			}
		} else if (section === 'equipment') {
			result.equipment.push(token);
		} else if (section === 'items') {
			result.items.push(token);
		}
	}

	return result;
}

/** api_value 파싱 결과와 set_value_1/2를 컬럼별로 병합 */
export function mergeMemberSetValues(apiParsed, setValue1, setValue2) {
	const s1 = parseSetValue(setValue1);
	const s2 = parseSetValue(setValue2);

	return {
		pcName: apiParsed.pcName,
		server: apiParsed.server,
		status: apiParsed.status,
		level: s1.level ?? (apiParsed.level !== '-' ? apiParsed.level : '-'),
		money: s1.money ?? (apiParsed.money !== '-' ? apiParsed.money : '-'),
		storageMoney: s1.storageMoney ?? '-',
		equipment: s2.equipment,
		items: s2.items
	};
}
