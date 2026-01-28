import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase/client';

export const user = writable(null);

// 초기 로그인 상태 확인
if (typeof window !== 'undefined') {
	supabase.auth.getSession().then(({ data: { session } }) => {
		const currentUser = session?.user ?? null;
		user.set(currentUser);
	});

	// 인증 상태 변경 구독
	supabase.auth.onAuthStateChange((event, session) => {
		const currentUser = session?.user ?? null;
		user.set(currentUser);
	});
}
