/**
 * set_value 문자열 파싱
 * 예(set_value_1): [설정]^g레벨=22^g보관아데나=12^g보유아데나=34^g1시간킬=666^g1시간아데나=77777
 * 예(set_value_2): [설정]^g장착아이템= 6 크로스 보우^g 4 티셔츠^g보유아이템=순간이동 주문서 (5)^g...
 * 예(set_value_3): [설정]^g사냥터=글던 1층
 */
function takeRemainPeriodFromToken(token) {
	const match = String(token).match(/^(.*?)(?:\^?g)?남은기간=(.*)$/);
	if (!match || !String(token).includes('남은기간=')) {
		return { token, remainPeriod: null };
	}
	return { token: match[1].trim(), remainPeriod: match[2].trim() };
}

export function parseSetValue(str) {
	const result = {
		level: null,
		storageMoney: null,
		money: null,
		hourlyKill: null,
		hourlyAdena: null,
		huntingGround: null,
		remainPeriod: null,
		equipment: [],
		items: []
	};

	if (!str || typeof str !== 'string') return result;

	const normalized = str.replace(/([^\^])g남은기간=/g, '$1^g남은기간=');
	const tokens = normalized
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
			} else if (key === '1시간킬' || key === '1시간 킬') {
				result.hourlyKill = value || null;
				section = null;
			} else if (key === '1시간아데나' || key === '1시간 아데나') {
				result.hourlyAdena = value || null;
				section = null;
			} else if (key === '사냥터') {
				result.huntingGround = value || null;
				section = null;
			} else if (key === '장착아이템') {
				section = 'equipment';
				const item = takeRemainPeriodFromToken(value);
				if (item.remainPeriod != null) result.remainPeriod = item.remainPeriod;
				if (item.token) result.equipment.push(item.token);
			} else if (key === '보유아이템') {
				section = 'items';
				const item = takeRemainPeriodFromToken(value);
				if (item.remainPeriod != null) result.remainPeriod = item.remainPeriod;
				if (item.token) result.items.push(item.token);
			} else if (key === '남은기간') {
				result.remainPeriod = value;
				section = null;
			} else {
				section = null;
			}
		} else if (section === 'equipment') {
			const item = takeRemainPeriodFromToken(token);
			if (item.remainPeriod != null) result.remainPeriod = item.remainPeriod;
			if (item.token) result.equipment.push(item.token);
		} else if (section === 'items') {
			const item = takeRemainPeriodFromToken(token);
			if (item.remainPeriod != null) result.remainPeriod = item.remainPeriod;
			if (item.token) result.items.push(item.token);
		}
	}

	return result;
}

/** api_value 파싱 결과와 set_value_1/2/3를 컬럼별로 병합 */
export function mergeMemberSetValues(apiParsed, setValue1, setValue2, setValue3) {
	const s1 = parseSetValue(setValue1);
	const s2 = parseSetValue(setValue2);
	const s3 = parseSetValue(setValue3);

	return {
		pcName: apiParsed.pcName,
		server: apiParsed.server,
		status: apiParsed.status,
		level: s1.level ?? (apiParsed.level !== '-' ? apiParsed.level : '-'),
		money: s1.money ?? (apiParsed.money !== '-' ? apiParsed.money : '-'),
		storageMoney: s1.storageMoney ?? '-',
		hourlyKill: s1.hourlyKill ?? '-',
		hourlyAdena: s1.hourlyAdena ?? '-',
		huntingGround: s3.huntingGround ?? '-',
		remainPeriod: s2.remainPeriod ?? '',
		equipment: s2.equipment,
		items: s2.items
	};
}
