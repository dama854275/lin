/**
 * user store 구독. 이메일이 바뀔 때만 onChange를 호출합니다.
 * TOKEN_REFRESHED 등 같은 계정의 재이벤트로는 목록을 다시 읽지 않습니다.
 */
export function subscribeUserEmail(userStore, onChange) {
	let lastEmail = undefined;

	return userStore.subscribe((u) => {
		const email = u?.email ? String(u.email).trim().toLowerCase() : null;
		if (email === lastEmail) return;
		lastEmail = email;
		onChange(u);
	});
}
