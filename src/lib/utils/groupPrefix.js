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
