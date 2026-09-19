const EXPIRE_SOON_MS = (23 * 60 + 59) * 60 * 1000;
const EXPIRE_STALE_AFTER_MS = 48 * 60 * 60 * 1000;

function parseAccountExpireDate(raw) {
	if (raw == null) return null;
	const text = String(raw).trim();
	if (!text) return null;

	const n = Number(text);
	if (!Number.isFinite(n) || n === 0) return null;

	const date = new Date(n > 1e12 ? n : n * 1000);
	if (isNaN(date.getTime())) return null;
	if (Date.now() - date.getTime() >= EXPIRE_STALE_AFTER_MS) return null;
	return date;
}

/** KST 기준 갱신 시간 표시: "6월 5일 18:25" */
export function formatKstMonitorDateTime(dateTime) {
	if (!dateTime) return '-';
	try {
		const date = new Date(dateTime);
		if (isNaN(date.getTime())) return '-';

		const parts = new Intl.DateTimeFormat('en-CA', {
			timeZone: 'Asia/Seoul',
			month: 'numeric',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		}).formatToParts(date);

		const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
		const month = get('month');
		const day = get('day');
		const hour = get('hour');
		const minute = get('minute');

		return `${month}월 ${day}일 ${hour}:${minute}`;
	} catch (e) {
		return '-';
	}
}

/** 만료까지 23시간 59분 이내(이미 지난 시간 포함, 48시간 이상 지난 값은 제외)이면 true */
export function isAccountExpireSoon(raw) {
	const date = parseAccountExpireDate(raw);
	if (!date) return false;
	return date.getTime() - Date.now() <= EXPIRE_SOON_MS;
}

/** set_value_2 남은기간(unix 초/밀리초) → KST 월/일 시:분. 없거나 0이면 확인불가 */
export function formatAccountExpireDate(raw) {
	const date = parseAccountExpireDate(raw);
	if (!date) return '확인불가';

	try {

		const parts = new Intl.DateTimeFormat('en-CA', {
			timeZone: 'Asia/Seoul',
			month: 'numeric',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		}).formatToParts(date);

		const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
		const month = String(Number(get('month')));
		const day = String(Number(get('day')));
		const hour = get('hour');
		const minute = get('minute');
		if (!month || month === 'NaN' || !day || day === 'NaN' || !hour || !minute) return '확인불가';
		return `${month}월 ${day}일 ${hour}:${minute}`;
	} catch (e) {
		return '확인불가';
	}
}
