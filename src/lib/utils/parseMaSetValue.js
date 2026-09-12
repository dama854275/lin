/**
 * ma 전용 set_value_1 문자열 파싱
 * 예: [설정]^g레벨=22^g직업=3차^g아바타=1^g펫=3^g묘묘=260915^g보유메소=123456789
 */
export function parseMaSetValue(str) {
	const result = {
		level: '-',
		job: '-',
		avatar: '-',
		pet: '-',
		myomyo: '-',
		meso: '-'
	};

	if (!str || typeof str !== 'string') return result;

	const tokens = str
		.split('^g')
		.map((t) => t.trim())
		.filter((t) => t !== '');

	for (const token of tokens) {
		if (token === '[설정]' || token.startsWith('[설정]')) continue;

		const eqIdx = token.indexOf('=');
		if (eqIdx === -1) continue;

		const key = token.substring(0, eqIdx).trim();
		const value = token.substring(eqIdx + 1).trim();
		if (!value) continue;

		if (key === '레벨') {
			result.level = value;
		} else if (key === '직업') {
			result.job = value;
		} else if (key === '아바타') {
			result.avatar = value === '1' ? '있음' : value;
		} else if (key === '펫') {
			result.pet = value;
		} else if (key === '묘묘') {
			const n = parseInt(value, 10);
			result.myomyo = Number.isFinite(n) && n <= 0 ? '없음' : value;
		} else if (key === '보유메소' || key === '보유 메소') {
			result.meso = value;
		}
	}

	return result;
}

export function parseMesoAmount(value) {
	if (value === null || value === undefined || value === '-') return null;
	const digits = String(value).trim().replace(/[^\d]/g, '');
	if (!digits) return null;
	const n = parseInt(digits, 10);
	return !isNaN(n) && n >= 0 ? n : null;
}
