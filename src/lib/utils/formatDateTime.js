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
