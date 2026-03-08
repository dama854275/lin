<script>
    import "$lib/app.css";
    import { goto } from '$app/navigation';
    import { user, isAdmin } from '$lib/stores/auth';
    import { supabase } from '$lib/supabase/client';
    import { onMount } from 'svelte';
    import { page } from '$app/stores';

    let mounted = false;
    let loading = true;

    // 현재 경로와 메뉴 경로가 일치하는지 확인하는 함수
    $: isCurrentPath = (path) => {
        if (path === '/') return $page.url.pathname === '/';
        return $page.url.pathname.startsWith(path);
    };

    onMount(async () => {
        try {
            // 현재 세션 확인
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
                // admin_users 테이블에서 현재 사용자가 관리자인지 확인
                const { data: adminData } = await supabase
                    .from('admin_users')
                    .select('user_id')
                    .eq('user_id', session.user.id)
                    .single();

                if (!adminData) {
                    await goto('/');
                }
            } else {
                await goto('/login');
            }
        } catch (error) {
            console.error('인증 확인 중 오류 발생:', error);
            await goto('/login');
        } finally {
            mounted = true;
            loading = false;
        }
    });

    // 페이지 이동 함수
    async function navigateTo(path) {
        await goto(path);
    }

    // 로그아웃 함수
    async function handleLogout() {
        try {
            await supabase.auth.signOut();
            await goto('/login');
        } catch (error) {
            console.error('로그아웃 중 오류 발생:', error);
        }
    }
</script>

{#if loading}
    <div class="loading-screen">
        <div class="loading-spinner"></div>
    </div>
{:else if mounted}
    <div class="admin-layout">
        <div class="sidebar">
            <div class="logo-section mb-8">
                <h1 class="text-2xl font-bold text-white px-4">관리자 대시보드</h1>
            </div>
            
            <ul class="menu space-y-2">
                {#if $user}
                    <li>
                        <div class="auth-menu px-4 py-2">
                            <span class="text-white mb-2 block">{$user.email}</span>
                            <button class="menu-item hover:text-blue-400 transition-colors" on:click={handleLogout}>
                                로그아웃
                            </button>
                        </div>
                    </li>
                    <div class="border-t border-gray-700 my-4"></div>
                {/if}

                <li>
                    <button 
                        class="menu-item {isCurrentPath('/') ? 'active' : ''}" 
                        on:click={() => navigateTo('/')}
                    >
                    HOME
                    </button>
                </li>
                
                <li>
                    <button 
                        class="menu-item {isCurrentPath('/admin/user_info') ? 'active' : ''}" 
                        on:click={() => navigateTo('/admin/user_info')}
                    >
                        회원 정보 보기
                    </button>
                </li>

                <li>
                    <button 
                        class="menu-item {isCurrentPath('/admin/transactions') ? 'active' : ''}" 
                        on:click={() => navigateTo('/admin/transactions')}
                    >
                        포인트 충전 내역
                    </button>
                </li>
                
                <li>
                    <button 
                        class="menu-item {isCurrentPath('/admin/purchases') ? 'active' : ''}" 
                        on:click={() => navigateTo('/admin/purchases')}
                    >
                        상품 구매내역
                    </button>
                </li>

                <li>
                    <button 
                        class="menu-item {isCurrentPath('/admin/products-manage') ? 'active' : ''}" 
                        on:click={() => navigateTo('/admin/products-manage')}
                    >
                        회원 상품 관리
                    </button>
                </li>

                <li>
                    <button 
                        class="menu-item {isCurrentPath('/admin/points') ? 'active' : ''}" 
                        on:click={() => navigateTo('/admin/points')}
                    >
                        포인트 지급 / 회수
                    </button>
                </li>

                <li>
                    <button 
                        class="menu-item {isCurrentPath('/admin/program-manage') ? 'active' : ''}" 
                        on:click={() => navigateTo('/admin/program-manage')}
                    >
                        프로그램 관리
                    </button>
                </li>

                <li>
                    <button 
                        class="menu-item {isCurrentPath('/contact') ? 'active' : ''}" 
                        on:click={() => navigateTo('/contact')}
                    >
                        1:1 문의
                    </button>
                </li>
            </ul>
        </div>

        <div class="content bg-gray-50">
            <slot />
        </div>
    </div>
{/if}

<style>
    :global(.admin-layout) {
        display: flex;
        min-height: 100vh;
    }

    :global(.sidebar) {
        position: fixed;
        top: 0;
        left: 0;
        width: 250px;
        height: 100%;
        background: linear-gradient(to bottom, #1a202c, #2d3748);
        color: white;
        padding: 20px;
        overflow-y: auto;
    }

    :global(.auth-menu) {
        margin-bottom: 10px;
    }

    :global(.menu) {
        list-style: none;
        padding: 0;
    }

    :global(.menu-item) {
        padding: 10px 15px;
        margin: 5px 0;
        cursor: pointer;
        background: none;
        border: none;
        color: white;
        text-align: left;
        width: 100%;
        font-size: 16px;
        transition: all 0.3s;
        border-radius: 6px;
    }

    :global(.menu-item:hover) {
        background-color: rgba(255, 255, 255, 0.1);
    }

    :global(.menu-item.active) {
        background-color: rgba(59, 130, 246, 0.5);  /* 파란색 배경 */
        color: white;
        font-weight: 600;
    }

    :global(.content) {
        margin-left: 250px;
        padding: 20px;
        width: calc(100% - 250px);
        background-color: #f9fafb;
    }

    :global(.loading-screen) {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background-color: #f3f4f6;
    }

    :global(.loading-spinner) {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f4f6;
        border-top: 4px solid #3b82f6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>