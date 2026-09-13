/** z_a_xxx@... 형태 계정에서 그룹 접두사(z_a) 추출 */
export function getZGroupPrefix(email) {
	if (!email) return null;
	const id = email.split('@')[0].toLowerCase();
	if (!id.startsWith('z_')) return null;
	const parts = id.split('_');
	if (parts.length >= 2 && parts[1]) {
		return `${parts[0]}_${parts[1]}`;
	}
	return null;
}

export function isZGroupAccount(email) {
	return getZGroupPrefix(email) !== null;
}

/** z_g / z_gr / z_grasdf 처럼 그룹 접두사가 완전히 같을 때만 true */
export function isSameZGroup(email, groupPrefix) {
	return !!groupPrefix && getZGroupPrefix(email) === groupPrefix;
}

/**
 * email이 `${prefix}_` 로 시작하는 범위만 조회.
 * LIKE 'z_g%' 는 SQL에서 _ 가 한글자 와일드카드라 z_gr_ 까지 잡히므로 범위 비교를 씀.
 */
export function getZGroupEmailBounds(groupPrefix) {
	if (!groupPrefix) return null;
	return {
		start: `${groupPrefix}_`,
		end: `${groupPrefix}\``
	};
}

export function isMaGroupAccount(email) {
	if (!email) return false;
	const id = email.split('@')[0].toLowerCase();
	return id.startsWith('ma_');
}
