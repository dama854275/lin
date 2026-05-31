/** 화면 표시용 이메일 (@gmail.com 제거) */
export function formatEmailDisplay(email) {
	if (!email) return '-';
	const suffix = '@gmail.com';
	if (email.toLowerCase().endsWith(suffix)) {
		return email.slice(0, -suffix.length);
	}
	const atIndex = email.indexOf('@');
	if (atIndex !== -1) return email.slice(0, atIndex);
	return email;
}
