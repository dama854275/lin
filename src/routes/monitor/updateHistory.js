const DAY = 86400000;
const KST = 9 * 3600000;

// 각 계정의 마지막 갱신 시각을 한국 날짜로 집계한다. 갱신 횟수가 아니다.
export function buildUpdateHistory(members, now = new Date()) {
	const today = Math.floor((now.getTime() + KST) / DAY);
	const start = today - 29;
	const days = Array.from({ length: 30 }, (_, index) => {
		const date = new Date((start + index) * DAY).toISOString().slice(0, 10);
		return { date, label: String(Number(date.slice(8))), count: 0, groups: {} };
	});
	for (const member of members || []) {
		const expiresAt = member?.product_period ? new Date(member.product_period).getTime() : NaN;
		if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) continue;
		if (!member?.api_at) continue;
		const time = new Date(member.api_at).getTime();
		if (!Number.isFinite(time)) continue;
		const index = Math.floor((time + KST) / DAY) - start;
		if (index < 0 || index >= days.length) continue;
		const id = String(member.email || '').trim().toLowerCase().split('@')[0].split('_').slice(0, 2).join('_');
		days[index].count++;
		days[index].groups[id] = (days[index].groups[id] || 0) + 1;
	}
	return days;
}
