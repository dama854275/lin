import { writable } from 'svelte/store'
import { supabase } from '$lib/supabase/client'

export const user = writable(null)
export const isAdmin = writable(false)

// 관리자 권한 체크 함수
async function checkAdminStatus(userId) {
    if (!userId) {
        isAdmin.set(false);
        return;
    }

    try {
        const { data, error } = await supabase
            .from('admin_users')
            .select('*')
            .eq('user_id', userId);

        if (error) {
            console.error('Admin check error:', error);
            isAdmin.set(false);
            return;
        }

        isAdmin.set(data && data.length > 0);
    } catch (err) {
        console.error('Admin check failed:', err);
        isAdmin.set(false);
    }
}

// 초기 로그인 상태 확인
supabase.auth.getSession().then(({ data: { session } }) => {
    const currentUser = session?.user ?? null;
    user.set(currentUser);
    if (currentUser) {
        checkAdminStatus(currentUser.id);
    }
});

// 인증 상태 변경 구독
supabase.auth.onAuthStateChange((event, session) => {
    const currentUser = session?.user ?? null;
    user.set(currentUser);
    if (currentUser) {
        checkAdminStatus(currentUser.id);
    } else {
        isAdmin.set(false);
    }
});