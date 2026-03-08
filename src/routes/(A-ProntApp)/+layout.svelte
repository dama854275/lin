<script>
    import "$lib/app.css";  // $lib 별칭 사용
    import { user } from '$lib/stores/auth'
    import { supabase } from '$lib/supabase/client';  // supabase 클라이언트 추가
    import { goto } from '$app/navigation';  // goto import 추가
    import { onMount, onDestroy } from 'svelte';
    import { points } from '$lib/stores/points';
    import Banner from '$lib/components/Banner.svelte'
    
    import { page } from '$app/stores';  // page 스토어 추가
    // 프론트 페이지 메뉴 상태
    let frontMenuOpen = false;
    let productMenuOpen = false;
    let pointsMenuOpen = false;
    let supportMenuOpen = false;
    let mobileMenuOpen = false;
    let accountMenuOpen = false;

    // 메뉴 토글 함수들
    function toggleFrontMenu() {
        frontMenuOpen = !frontMenuOpen;
        productMenuOpen = false;
        pointsMenuOpen = false;
        supportMenuOpen = false;
    }

    function toggleProductMenu() {
        productMenuOpen = !productMenuOpen;
        pointsMenuOpen = false;
        supportMenuOpen = false;
        accountMenuOpen = false;
    }

    function togglePointsMenu() {
        pointsMenuOpen = !pointsMenuOpen;
        productMenuOpen = false;
        supportMenuOpen = false;
        accountMenuOpen = false;
    }

    function toggleSupportMenu() {
        supportMenuOpen = !supportMenuOpen;
        productMenuOpen = false;
        pointsMenuOpen = false;
        accountMenuOpen = false;
    }

    function toggleAccountMenu() {
        accountMenuOpen = !accountMenuOpen;
        productMenuOpen = false;
        pointsMenuOpen = false;
        supportMenuOpen = false;
    }

    function toggleMobileMenu() {
        mobileMenuOpen = !mobileMenuOpen;
    }

    // 페이지 이동 함수
    async function navigateTo(path) {
        // Close all menus when navigating
        productMenuOpen = false;
        pointsMenuOpen = false;
        supportMenuOpen = false;
        mobileMenuOpen = false;
        accountMenuOpen = false;
        await goto(path);
    }


    let isLoggedIn = false;
    
    // 로그아웃 함수 수정
    async function handleLogout() {
        try {
            await supabase.auth.signOut();
            await goto('/login');  // window.location.href 대신 goto 사용
        } catch (error) {
            // console.error('로그아웃 중 오류 발생:', error);
        }
    }

    // 포인트 상태는 store에서 가져옴
    $: userPoints = $points;

    let mounted = false;
    let subscription;

    let isAdmin = false;

    // 관리자 권한 확인 함수
    async function checkAdminStatus() {
        if (!$user) return;
        
        try {
            const { data, error } = await supabase
                .from('admin_users')
                .select('*')
                .eq('user_id', $user.id);
            
            if (error) {
                console.error('Admin check error:', error);
                isAdmin = false;
                return;
            }
            
            // 데이터가 있으면 관리자
            isAdmin = data && data.length > 0;
        } catch (err) {
            console.error('Admin check failed:', err);
            isAdmin = false;
        }
    }

    // 컴포넌트 마운트 시 초기화
    onMount(async () => {
        mounted = true;
        if ($user) {
            await points.fetch();
            checkAdminStatus();
            subscription = setupRealtimeSubscription();
        }
    });

    // 실시간 구독 설정
    function setupRealtimeSubscription() {
        if (!$user) return null;

        const subscription = supabase
            .channel('user_profiles_changes')
            .on('postgres_changes', 
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_profiles',
                    filter: `user_id=eq.${$user.id}`
                },
                async () => {
                    await points.fetch();
                }
            )
            .subscribe();

        return subscription;
    }

    // user store 구독
    $: if (mounted && $user) {
        points.fetch();
        checkAdminStatus();
        if (!subscription) {
            subscription = setupRealtimeSubscription();
        }
    }

    onDestroy(() => {
        mounted = false;
        if (subscription) {
            subscription.unsubscribe();
        }
    });

    // 현재 경로와 메뉴 경로가 일치하는지 확인하는 함수
    $: isCurrentPath = (path) => {
        if (path === '/') return $page.url.pathname === '/';
        return $page.url.pathname.startsWith(path);
    };

    // 배너 노출 여부 (홈, products, purchase 에서는 제외)
    $: showBanner = !(isCurrentPath('/') || isCurrentPath('/products') || isCurrentPath('/purchase'));
</script>

<!-- Top navigation bar -->
<header class="bg-gradient-to-r from-[#eaefff] to-[#f4f7ff] fixed top-0 left-0 right-0 z-50 border-b border-[#dbe4fd] shadow-sm">
    <nav class="container mx-auto px-4 py-3 flex items-center justify-between">
        <!-- Logo -->
        <div class="flex items-center">
            <a href="/" class="text-2xl font-bold text-[#9db5fd] logo-responsive">다마고치</a>
        </div>

        <!-- Desktop Navigation -->
        <div class="hidden xl:flex items-center justify-center flex-1 px-4">
            <div class="flex items-center space-x-2 lg:space-x-4 xl:space-x-6">
            <!-- Nav Items -->
            <a href="/" class="nav-link {isCurrentPath('/') ? 'active' : ''}" title="홈">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            </a>
            
            <!-- Products Dropdown -->
            <div class="relative group">
                <button class="nav-link {isCurrentPath('/products') || isCurrentPath('/purchase') ? 'active' : ''} flex items-center" 
                    on:click={toggleProductMenu}>
                    🛍️ 상품
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1 transform {productMenuOpen ? 'rotate-180' : ''} transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {#if productMenuOpen}
                <div class="dropdown-menu">
                    <a href="/products" class="dropdown-item {isCurrentPath('/products') ? 'active' : ''}" on:click|preventDefault={() => navigateTo('/products')}>상품 안내</a>
                    <a href="/purchase" class="dropdown-item {isCurrentPath('/purchase') ? 'active' : ''}" on:click|preventDefault={() => navigateTo('/purchase')}>상품 구매</a>
                </div>
                {/if}
            </div>
            
            <a href="/settings" class="nav-link {isCurrentPath('/settings') ? 'active' : ''}">📖 사용 설명</a>
            <a href="/tip" class="nav-link {isCurrentPath('/tip') ? 'active' : ''}">💡 다마고치 TIP</a>
            
            <!-- Points Dropdown -->
            <div class="relative group">
                <button class="nav-link {isCurrentPath('/points-info') || isCurrentPath('/points-charge') ? 'active' : ''} flex items-center" 
                    on:click={togglePointsMenu}>
                    💰 포인트
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1 transform {pointsMenuOpen ? 'rotate-180' : ''} transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {#if pointsMenuOpen}
                <div class="dropdown-menu">
                    <a href="/points-info" class="dropdown-item {isCurrentPath('/points-info') ? 'active' : ''}" on:click|preventDefault={() => navigateTo('/points-info')}>📌 포인트 안내</a>
                    <a href="/points-charge" class="dropdown-item {isCurrentPath('/points-charge') ? 'active' : ''}" on:click|preventDefault={() => navigateTo('/points-charge')}>💵 포인트 충전</a>
                </div>
                {/if}
            </div>
            
            <!-- Support Dropdown -->
            <div class="relative group">
                <button class="nav-link {isCurrentPath('/notices') || isCurrentPath('/faq') || isCurrentPath('/contact') ? 'active' : ''} flex items-center" 
                    on:click={toggleSupportMenu}>
                    🎯 고객지원
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1 transform {supportMenuOpen ? 'rotate-180' : ''} transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {#if supportMenuOpen}
                <div class="dropdown-menu">
                    <a href="/notices" class="dropdown-item {isCurrentPath('/notices') ? 'active' : ''}" on:click|preventDefault={() => navigateTo('/notices')}>📢 공지사항</a>
                    <a href="/update_history" class="dropdown-item {isCurrentPath('/update_history') ? 'active' : ''}" on:click|preventDefault={() => navigateTo('/update_history')}>📝 업데이트 내역</a>
                    <a href="/faq" class="dropdown-item {isCurrentPath('/faq') ? 'active' : ''}" on:click|preventDefault={() => navigateTo('/faq')}>❓ 자주 묻는 질문</a>
                    <a href="/contact" class="dropdown-item {isCurrentPath('/contact') ? 'active' : ''}" on:click|preventDefault={() => {
                        if (!$user) {
                            goto('/login');
                        } else {
                            navigateTo('/contact');
                        }
                    }}>✉️ 1:1 문의</a>
                </div>
                {/if}
            </div>
            </div>
        </div>

        <!-- User Actions -->
        <div class="flex items-center">
            {#if $user}
                <div class="relative">
                    <button on:click={toggleAccountMenu} class="flex items-center space-x-2 text-gray-700 px-4 py-2 rounded-md bg-[#f5f7ff] hover:bg-[#9db5fd] hover:text-white transition-colors border border-[#9db5fd]">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                        </svg>
                    </button>
                    
                    {#if accountMenuOpen}
                    <div class="dropdown-menu right-0">
                        <div class="py-2 px-4 border-b border-gray-200">
                            <span class="text-sm text-[#7b93fb] font-bold">보유 포인트: {userPoints.toLocaleString()}P</span>
                        </div>
                        <a href="/mypage" class="dropdown-item" on:click|preventDefault={() => navigateTo('/mypage')}>마이페이지</a>
                        {#if isAdmin}
                            <a href="/admin" class="dropdown-item" on:click|preventDefault={() => navigateTo('/admin')}>관리자 페이지</a>
                        {/if}
                        <button class="dropdown-item text-left w-full" on:click={handleLogout}>로그아웃</button>
                    </div>
                    {/if}
                </div>
            {:else}
                <a href="/login" class="login-button" on:click|preventDefault={() => navigateTo('/login')}>
                    로그인
                </a>
            {/if}
            
            <!-- Mobile menu button -->
            <button class="ml-4 xl:hidden text-gray-700 focus:outline-none" on:click={toggleMobileMenu}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>
        </div>
    </nav>
    
    <!-- Mobile Navigation Menu -->
    {#if mobileMenuOpen}
    <div class="xl:hidden bg-gradient-to-b from-[#eaefff] to-[#f4f7ff] shadow-lg border-t border-[#dbe4fd]">
        <div class="px-4 py-3 space-y-2">
            <a href="/" class="mobile-nav-item {isCurrentPath('/') ? 'active' : ''}" on:click|preventDefault={() => navigateTo('/')} title="홈">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            </a>
            
            <!-- Products -->
            <div class="border-t border-[#dbe4fd] my-2">
                <button class="mobile-nav-item flex justify-between items-center w-full {isCurrentPath('/products') || isCurrentPath('/purchase') ? 'active' : ''}" on:click={toggleProductMenu}>
                    🛍️ 상품
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-1 transform {productMenuOpen ? 'rotate-180' : ''} transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {#if productMenuOpen}
                <div class="pl-4 space-y-1 bg-white p-2 rounded-lg border border-[#e2e8f0]">
                    <a href="/products" class="mobile-nav-subitem {isCurrentPath('/products') ? 'active' : ''}" on:click|preventDefault={() => navigateTo('/products')}>📋 상품 안내</a>
                    <a href="/purchase" class="mobile-nav-subitem {isCurrentPath('/purchase') ? 'active' : ''}" on:click|preventDefault={() => navigateTo('/purchase')}>💳 상품 구매</a>
                </div>
                {/if}
            </div>
            
            <a href="/settings" class="mobile-nav-item {isCurrentPath('/settings') ? 'active' : ''}" on:click|preventDefault={() => navigateTo('/settings')}>📖 사용 설명</a>
            <a href="/tip" class="mobile-nav-item {isCurrentPath('/tip') ? 'active' : ''}" on:click|preventDefault={() => navigateTo('/tip')}>💡 다마고치 TIP</a>
            
            <!-- Points -->
            <div class="border-t border-[#dbe4fd] my-2">
                <button class="mobile-nav-item flex justify-between items-center w-full {isCurrentPath('/points-info') || isCurrentPath('/points-charge') ? 'active' : ''}" on:click={togglePointsMenu}>
                    💰 포인트
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-1 transform {pointsMenuOpen ? 'rotate-180' : ''} transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {#if pointsMenuOpen}
                <div class="pl-4 space-y-1 bg-white p-2 rounded-lg border border-[#e2e8f0]">
                    <a href="/points-info" class="mobile-nav-subitem {isCurrentPath('/points-info') ? 'active' : ''}" on:click|preventDefault={() => navigateTo('/points-info')}>ℹ️ 포인트 안내</a>
                    <a href="/points-charge" class="mobile-nav-subitem {isCurrentPath('/points-charge') ? 'active' : ''}" on:click|preventDefault={() => navigateTo('/points-charge')}>💵 포인트 충전</a>
                </div>
                {/if}
            </div>
            
            <!-- Support -->
            <div class="border-t border-[#dbe4fd] my-2">
                <button class="mobile-nav-item flex justify-between items-center w-full {isCurrentPath('/notices') || isCurrentPath('/faq') || isCurrentPath('/contact') ? 'active' : ''}" on:click={toggleSupportMenu}>
                    🎯 고객지원
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-1 transform {supportMenuOpen ? 'rotate-180' : ''} transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {#if supportMenuOpen}
                <div class="pl-4 space-y-1 bg-white p-2 rounded-lg border border-[#e2e8f0]">
                    <a href="/notices" class="mobile-nav-subitem {isCurrentPath('/notices') ? 'active' : ''}" on:click|preventDefault={() => navigateTo('/notices')}>📢 공지사항</a>
                    <a href="/update_history" class="mobile-nav-subitem {isCurrentPath('/update_history') ? 'active' : ''}" on:click|preventDefault={() => navigateTo('/update_history')}>📝 업데이트 내역</a>
                    <a href="/faq" class="mobile-nav-subitem {isCurrentPath('/faq') ? 'active' : ''}" on:click|preventDefault={() => navigateTo('/faq')}>❓ 자주 묻는 질문</a>
                    <a href="/contact" class="mobile-nav-subitem {isCurrentPath('/contact') ? 'active' : ''}" on:click|preventDefault={() => {
                        if (!$user) {
                            goto('/login');
                        } else {
                            navigateTo('/contact');
                        }
                    }}>✉️ 1:1 문의</a>
                </div>
                {/if}
            </div>
        </div>
    </div>
    {/if}
</header>

<!-- Main Content -->
<main class="pt-16 min-h-screen bg-gradient-to-b from-[#f5f5ff] to-[#efeffc]">
    <div class="container mx-auto px-4 py-6">
        {#if showBanner}
        <div class="banner-row">
            <div class="banner-cell">
                <div class="banner-box"><Banner /></div>
            </div>
            <div class="banner-cell placeholder"><div class="placeholder-box"></div></div>
            <div class="banner-cell placeholder"><div class="placeholder-box"></div></div>
        </div>
        {/if}
        <div class="content-wrapper py-2">
            <slot />
        </div>
    </div>
    
</main>

<style>
    /* Neo 둥근모 폰트 임포트 */
    @font-face {
        font-family: 'NeoDunggeunmo';
        src: url('https://cdn.jsdelivr.net/gh/neodgm/neodgm-webfont@latest/neodgm_code/neodgm_code.woff2') format('woff2'),
             url('https://cdn.jsdelivr.net/gh/neodgm/neodgm-webfont@latest/neodgm_code/neodgm_code.woff') format('woff');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
    }
    
    /* 네비게이션 스타일링 */
    .nav-link {
        font-family: 'NeoDunggeunmo', sans-serif;
        font-size: 1.25rem;
        color: #4a5568;
        padding: 0.5rem 0.75rem;
        border-radius: 0.25rem;
        font-weight: 500;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        letter-spacing: 0.5px;
        position: relative;
        border: 2px solid transparent;
        white-space: nowrap;
    }
    
    /* 반응형 간격 조정 */
    @media (min-width: 1110px) and (max-width: 1279px) {
        .nav-link {
            padding: 0.5rem 0.75rem;
            font-size: 1.2rem;
        }
    }
    
    @media (min-width: 1280px) {
        .nav-link {
            padding: 0.5rem 1rem;
            font-size: 1.25rem;
        }
    }
    
    .nav-link:hover {
        color: #1a202c;
        background-color: rgba(157, 181, 253, 0.1);
        border-color: #9db5fd;
        box-shadow: 0 1px 3px rgba(157, 181, 253, 0.1);
    }
    
    .nav-link.active {
        color: #1a202c;
        background-color: rgba(157, 181, 253, 0.15);
        border-color: #9db5fd;
        border-bottom-width: 3px;
    }
    
    /* 로그인 버튼 */
    .login-button {
        font-family: 'NeoDunggeunmo', sans-serif;
        font-size: 1.1rem;
        color: white;
        background-color: #4060e0;
        padding: 0.5rem 1.25rem;
        border-radius: 0.5rem;
        transition: all 0.2s;
        letter-spacing: 1px;
        border: 2px solid #4060e0;
        box-shadow: 0 2px 4px rgba(157, 181, 253, 0.2);
        clip-path: polygon(
            0% 10%, 4% 0%, 96% 0%, 100% 10%,
            100% 90%, 96% 100%, 4% 100%, 0% 90%
        );
        position: relative;
        overflow: hidden;
    }
    
    .login-button:hover {
        background-color: #3050d0;
        border-color: #3050d0;
        transform: translateY(-1px);
        box-shadow: 0 4px 6px rgba(48, 80, 208, 0.3);
    }
    
    /* 반짝이는 효과 추가 */
    .login-button::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.3) 50%,
            rgba(255, 255, 255, 0) 100%
        );
        transform: rotate(30deg);
        animation: shimmer 3s infinite;
    }
    
    @keyframes shimmer {
        0% {
            transform: translateX(-100%) rotate(30deg);
        }
        100% {
            transform: translateX(100%) rotate(30deg);
        }
    }
    
    /* 드롭다운 메뉴 */
    .dropdown-menu {
        position: absolute;
        top: 100%;
        min-width: 220px;
        background-color: #f8f9ff;
        border-radius: 0.5rem;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        z-index: 50;
        margin-top: 0.5rem;
        border: 1px solid #e2e8f0;
        border-top: 3px solid #9db5fd;
    }
    
    .dropdown-item {
        font-family: 'NeoDunggeunmo', sans-serif;
        font-size: 1.125rem;
        display: block;
        padding: 0.75rem 1rem;
        color: #4a5568;
        transition: all 0.2s;
        letter-spacing: 0.3px;
        border-left: 3px solid transparent;
    }
    
    .dropdown-item:hover {
        background-color: #eef0ff;
        color: #1a202c;
        border-left-color: #9db5fd;
    }
    
    .dropdown-item.active {
        background-color: #e8ecff;
        color: #1a202c;
        border-left-color: #9db5fd;
    }
    
    /* 모바일 네비게이션 */
    .mobile-nav-item {
        font-family: 'NeoDunggeunmo', sans-serif;
        font-size: 1.2rem;
        display: flex;
        align-items: center;
        padding: 0.75rem 1rem;
        color: #2d3748;
        font-weight: 500;
        transition: all 0.2s;
        border-radius: 0.5rem;
        background-color: rgba(255, 255, 255, 0.5);
        border: 1px solid rgba(157, 181, 253, 0.2);
    }
    
    .mobile-nav-item:hover {
        color: #1a202c;
        background-color: rgba(157, 181, 253, 0.15);
        border-color: #9db5fd;
        transform: translateX(4px);
    }
    
    .mobile-nav-item.active {
        color: #1a202c;
        font-weight: 600;
        background-color: rgba(157, 181, 253, 0.2);
        border-color: #9db5fd;
        border-left-width: 4px;
    }
    
    .mobile-nav-subitem {
        font-family: 'NeoDunggeunmo', sans-serif;
        font-size: 1.1rem;
        display: block;
        padding: 0.6rem 1rem;
        color: #2d3748;
        transition: all 0.2s;
        border-radius: 0.5rem;
        margin-top: 0.25rem;
        background-color: rgba(255, 255, 255, 0.8);
        border: 1px solid rgba(157, 181, 253, 0.2);
    }
    
    .mobile-nav-subitem:hover {
        color: #1a202c;
        background-color: rgba(157, 181, 253, 0.15);
        border-color: #9db5fd;
        transform: translateX(4px);
    }
    
    .mobile-nav-subitem.active {
        color: #1a202c;
        font-weight: 500;
        background-color: rgba(157, 181, 253, 0.2);
        border-color: #9db5fd;
        border-left-width: 4px;
    }
    
    /* 트랜지션과 애니메이션 */
    button, a {
        transition: all 0.2s;
    }

    /* 로고 스타일에도 동일한 폰트 적용 */
    header a.text-2xl {
        font-family: 'NeoDunggeunmo', sans-serif;
        font-size: 1.75rem;
        letter-spacing: 1px;
        padding: 0 0.5rem;
        text-shadow: 1px 1px 0 rgba(157, 181, 253, 0.3);
        color: #8095ec;
    }
    
    /* 로고 반응형 숨김 처리 */
    .logo-responsive {
        display: block;
    }
    
    @media (min-width: 1111px) and (max-width: 1541px) {
        .logo-responsive {
            display: none;
        }
    }

    /* 공통 배너 그리드 */
    .banner-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
        max-width: 1000px;
        margin: 0 auto 1rem auto;
        align-items: stretch;
    }

    .banner-cell {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .placeholder-box {
        width: 100%;
        aspect-ratio: 2 / 1; /* 1280:640 */
        border: 2px dashed #92aff8;
        border-radius: 8px;
        background-color: rgba(255, 255, 255, 0.6);
    }

    /* 실제 배너도 동일한 비율 유지 */
    .banner-box {
        width: 100%;
        aspect-ratio: 2 / 1; /* 1280:640 */
        border-radius: 8px;
        overflow: hidden;
        background-color: #ffffff;
    }

    /* 배너 이미지가 프레임을 가득 채우도록 강제 */
    :global(.banner-image) {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    /* 모바일에서도 항상 3열 유지 */
    @media (max-width: 768px) {
        .banner-row {
            grid-template-columns: repeat(3, 1fr);
            overflow-x: auto;
        }
    }
</style>