import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase/client';
import { user } from './auth';

function createPointsStore() {
    const { subscribe, set } = writable(0);
    let initialized = false;

    return {
        subscribe,
        async fetch() {
            try {
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                if (!currentUser) return;

                const { data, error } = await supabase
                    .from('user_info')
                    .select('points')
                    .eq('user_id', currentUser.id)
                    .single();

                if (error) throw error;
                if (data) {
                    set(data.points);
                    initialized = true;
                }
            } catch (err) {
                console.error('포인트 조회 오류:', err);
            }
        },
        async updatePoints(newPoints) {
            set(newPoints);
        },
        reset() {
            set(0);
            initialized = false;
        },
        isInitialized() {
            return initialized;
        }
    };
}

export const points = createPointsStore();

// 사용자 인증 상태 변경 감지
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        points.fetch();
    } else if (event === 'SIGNED_OUT') {
        points.reset();
    }
});