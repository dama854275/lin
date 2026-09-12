import { get } from 'svelte/store';
import { authReady } from '$lib/stores/auth';

/**
 * 세션 확인이 끝난 뒤에만 onChange를 호출합니다.
 * 이메일이 바뀔 때만 다시 호출하고, TOKEN_REFRESHED 재조회는 하지 않습니다.
 */
export function subscribeUserEmail(userStore, onChange) {
	let lastEmail = undefined;
	let started = false;

	const emit = (u) => {
		const email = u?.email ? String(u.email).trim().toLowerCase() : null;
		if (email === lastEmail) return;
		lastEmail = email;
		onChange(u);
	};

	const unsubReady = authReady.subscribe((ready) => {
		if (!ready || started) return;
		started = true;
		emit(get(userStore));
	});

	const unsubUser = userStore.subscribe((u) => {
		if (!get(authReady)) return;
		if (!started) started = true;
		emit(u);
	});

	return () => {
		unsubReady();
		unsubUser();
	};
}
