import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase/client';

export const user = writable(null);
/** getSession/onAuthStateChange 첫 확인이 끝나기 전에는 false */
export const authReady = writable(false);

if (typeof window !== 'undefined') {
	const applySession = (session) => {
		user.set(session?.user ?? null);
		authReady.set(true);
	};

	supabase.auth.getSession()
		.then(({ data: { session } }) => {
			applySession(session);
		})
		.catch(() => {
			applySession(null);
		});

	supabase.auth.onAuthStateChange((_event, session) => {
		applySession(session);
	});
}
