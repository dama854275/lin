<script>
    import { user } from '$lib/stores/auth';
    import { supabase } from '$lib/supabase/client';
    import { onMount, onDestroy } from 'svelte';
    import { goto } from '$app/navigation';

    let userProfile = null;
    let pointHistory = [];
    let transactionHistory = [];
    let error = null;
    let loading = true;
    let subscription;
    let downloadUrls = new Map(); // 다운로드 URL을 저장할 Map

    // 페이지네이션 관련 변수
    let currentPage = 1;
    const itemsPerPage = 6;
    let totalPages = 0;

    // 섹션 표시 상태 관리
    let isHistoryExpanded = true;
    let isTransactionExpanded = false;
    let isReferrerExpanded = false;

    // 추천인 관련 변수
    let referrerId = '';
    let referrerError = null;
    let referrerSuccess = false;
    let isSubmitting = false;

    // 탭 관련 변수 추가
    let activeTab = 'purchase'; // 'purchase', 'gift', 'received', 'charge', 'referral'

    // 포인트 내역 필터링 함수
    $: filteredPointHistory = pointHistory.filter(history => {
        if (activeTab === 'purchase') {
            return history.description.includes('구매');
        } else if (activeTab === 'gift') {
            return history.description.includes('선물') && history.user_id === $user?.id;
        } else if (activeTab === 'received') {
            return history.description.includes('선물') && history.description.includes($user?.email);
        } else if (activeTab === 'referral') {
            return history.description.includes('추천인 보상') && history.from_email;
        }
        return false;
    });

    // 필터링된 포인트 내역의 페이지네이션
    $: currentPageItems = activeTab === 'charge' 
        ? transactionHistory.slice(
            (currentPage - 1) * itemsPerPage,
            currentPage * itemsPerPage
        )
        : filteredPointHistory.slice(
            (currentPage - 1) * itemsPerPage,
            currentPage * itemsPerPage
        );

    $: totalPages = Math.ceil(
        (activeTab === 'charge' ? transactionHistory.length : filteredPointHistory.length) / itemsPerPage
    );
    $: pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

    // 탭 변경 시 페이지 초기화
    $: if (activeTab) {
        currentPage = 1;
    }

    // 다운로드 URL 가져오기 함수
    async function getDownloadUrl(productName) {
        try {
            const { data, error } = await supabase.storage
                .from('products')
                .createSignedUrl(`products/game/${productName}/${productName}.zip`, 3600); // 1시간 유효

            if (error) throw error;
            return data.signedUrl;
        } catch (err) {
            console.error('Error getting download URL:', err);
            return null;
        }
    }

    // 모든 상품의 다운로드 URL을 미리 가져오기
    async function loadDownloadUrls() {
        if (!userProfile) return;
        
        for (const [key, value] of Object.entries(userProfile)) {
            if (key.startsWith('product_') && value && new Date(value) > new Date()) {
                const productName = key.replace('product_', '');
                const url = await getDownloadUrl(productName);
                downloadUrls.set(productName, url);
            }
        }
    }

    async function loadUserData() {
        try {
            if (!$user) {
                goto('/login');
                return;
            }

            const userId = $user.id;

            // 프로필 정보 가져오기
            const { data: profileData, error: profileError } = await supabase
                .from('user_info')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (profileError) throw new Error('프로필 정보를 불러오는데 실패했습니다.');

            // 포인트 내역 가져오기
            const { data: pointData, error: pointError } = await supabase
                .from('point_history')
                .select('*')
                .or(`user_id.eq.${userId},description.ilike.%${$user.email}%`)
                .order('created_at', { ascending: false });

            if (pointError) throw new Error('포인트 내역을 불러오는데 실패했습니다.');

            // 거래 내역 가져오기
            const { data: transactionData, error: transactionError } = await supabase
                .from('transaction_history')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (transactionError) throw new Error('거래 내역을 불러오는데 실패했습니다.');

            userProfile = profileData || null;
            pointHistory = pointData || [];
            transactionHistory = transactionData || [];
            totalPages = Math.ceil(pointHistory.length / itemsPerPage);
            error = null;

            // 다운로드 URL 로드
            await loadDownloadUrls();

        } catch (err) {
            console.error('Data loading error:', err);
            error = err.message || '데이터를 불러오는데 실패했습니다.';
        } finally {
            loading = false;
        }
    }

    // 페이지네이션 관련 함수들
    function changePage(page) {
        currentPage = page;
    }

    // 추천인 등록 함수
    async function handleReferrerSubmit() {
        try {
            isSubmitting = true;
            referrerError = null;
            referrerSuccess = false;

            if (!$user) {
                referrerError = '로그인이 필요합니다.';
                return;
            }

            if (!referrerId.trim()) {
                referrerError = '추천인 ID를 입력해주세요.';
                return;
            }

            if (referrerId === $user?.email) {
                referrerError = '자기 자신을 추천인으로 등록할 수 없습니다.';
                return;
            }

            const { data: allUsers, error: allUsersError } = await supabase
                .from('user_info')
                .select('user_id, email');

            const foundUser = allUsers?.find(user => 
                user.email?.toLowerCase() === referrerId.toLowerCase()
            );

            if (!foundUser) {
                referrerError = '존재하지 않는 추천인입니다.';
                return;
            }

            const { error: updateError } = await supabase
                .from('user_info')
                .update({ referrer_id: foundUser.user_id })
                .eq('user_id', $user.id);

            if (updateError) {
                referrerError = '추천인 등록에 실패했습니다.';
                return;
            }

            referrerSuccess = true;
            referrerId = '';
            await loadUserData();
        } catch (e) {
            referrerError = '추천인 등록 중 오류가 발생했습니다.';
        } finally {
            isSubmitting = false;
        }
    }

    // 실시간 업데이트 설정
    onMount(() => {
        if ($user) {
            loadUserData();
            subscription = supabase
                .channel('user_info_changes')
                .on('postgres_changes', 
                    {
                        event: '*',
                        schema: 'public',
                        table: 'user_info',
                        filter: `user_id=eq.${$user.id}`
                    },
                    async () => {
                        await loadUserData();
                    }
                )
                .subscribe();
        }
    });

    onDestroy(() => {
        if (subscription) {
            subscription.unsubscribe();
        }
    });

    // user store 구독
    $: if ($user) {
        loadUserData();
    }
</script>

<div class="container mx-auto p-6">
    <h1 class="text-3xl font-bold mb-8">마이페이지</h1>

    {#if loading}
        <div class="loading-container">
            <div class="spinner"></div>
        </div>
    {:else if error}
        <div class="text-red-500 mb-4">
            <p>{error}</p>
        </div>
    {:else if userProfile}
        <div class="bg-white rounded-lg shadow-lg p-6 space-y-4">
            <div class="border-b pb-4">
                <div class="flex items-center justify-between">
                    <p class="text-gray-600">ID: {$user.email}</p>
                    <p class="text-2xl font-bold text-yellow-600">
                        {(userProfile.points || 0).toLocaleString()}P
                    </p>
                </div>
                <div class="mt-3 pt-3 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div class="flex items-center space-x-2">
                        {#if userProfile.referrer_id}
                            <p class="text-gray-700">추천인: 
                                {#await supabase.from('user_info').select('email').eq('user_id', userProfile.referrer_id).single() then { data }}
                                    <span class="font-medium">{data?.email || '알 수 없음'}</span>
                                {/await}
                            </p>
                        {:else}
                            <p class="text-gray-700">추천인: 없음</p>
                        {/if}
                    </div>
                    <div class="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                        <input 
                            type="text" 
                            id="referrerId"
                            name="referrerId"
                            placeholder="추천인 이메일" 
                            bind:value={referrerId}
                            class="w-full sm:w-auto px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button 
                            class="w-full sm:w-auto px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                            on:click={handleReferrerSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? '등록 중...' : userProfile.referrer_id ? '변경' : '등록'}
                        </button>
                    </div>
                </div>
                {#if referrerError}
                    <p class="text-red-500 text-sm mt-2">{referrerError}</p>
                {:else if referrerSuccess}
                    <p class="text-green-500 text-sm mt-2">추천인이 성공적으로 등록되었습니다.</p>
                {/if}
            </div>

            <!-- 구매 상품 적용 기간 -->
            <div class="border-b pb-4">
                <h2 class="text-xl font-semibold mb-4">상품 사용 가능 기간</h2>
                <div class="grid gap-3">
                    {#each Object.entries(userProfile).filter(([key]) => key.startsWith('product_')) as [key, value]}
                        <div class="flex items-center bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors">
                            <div class="flex-1">
                                <span class="font-medium text-gray-700">
                                    {key.replace('product_', '')}
                                </span>
                            </div>
                            {#if value}
                                <div class="flex items-center space-x-4">
                                    <span class="text-green-500 mr-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                                        </svg>
                                    </span>
                                    <span class="text-sm text-gray-600 bg-white px-3 py-1 rounded-full border">
                                        {new Date(value).toLocaleString()}
                                    </span>
                                    {#if new Date(value) > new Date()}
                                        <a 
                                            href={downloadUrls.get(key.replace('product_', ''))}
                                            class="text-blue-500 hover:text-blue-700 flex items-center"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            ✔ 다운로드
                                        </a>
                                    {/if}
                                </div>
                            {:else}
                                <span class="text-sm text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                                    구매 이력 없음
                                </span>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>

            <!-- 포인트 내역 -->
            <div>
                <button 
                    class="w-full flex items-center justify-between text-xl font-semibold mb-4 hover:text-gray-700"
                    on:click={() => isHistoryExpanded = !isHistoryExpanded}
                >
                    <span>포인트 내역</span>
                    <svg 
                        class="w-6 h-6 transform transition-transform {isHistoryExpanded ? 'rotate-180' : ''}"
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {#if isHistoryExpanded}
                    <!-- 탭 버튼 -->
                    <div class="flex space-x-4 mb-4 border-b">
                        <button
                            class="px-4 py-2 {activeTab === 'purchase' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}"
                            on:click={() => activeTab = 'purchase'}
                        >
                            상품 구매 내역
                        </button>
                        <button
                            class="px-4 py-2 {activeTab === 'gift' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}"
                            on:click={() => activeTab = 'gift'}
                        >
                            선물 보낸 내역
                        </button>
                        <button
                            class="px-4 py-2 {activeTab === 'received' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}"
                            on:click={() => activeTab = 'received'}
                        >
                            선물 받은 내역
                        </button>
                        <button
                            class="px-4 py-2 {activeTab === 'charge' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}"
                            on:click={() => activeTab = 'charge'}
                        >
                            충전 내역
                        </button>
                        <button
                            class="px-4 py-2 {activeTab === 'referral' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}"
                            on:click={() => activeTab = 'referral'}
                        >
                            추천인 보상
                        </button>
                    </div>

                    {#if (activeTab === 'charge' ? transactionHistory.length : filteredPointHistory.length) > 0}
                        <div class="space-y-3">
                            {#each currentPageItems as history}
                                <div class="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                                    <div>
                                        {#if activeTab === 'charge'}
                                            <p class="text-sm text-gray-600 font-bold">
                                                {new Date(history.created_at).toLocaleString()}
                                            </p>
                                            <p class="text-sm text-gray-600">
                                                TXID: {history.txid}
                                            </p>
                                        {:else if activeTab === 'referral'}
                                            <p class="font-medium">{history.description}</p>
                                            <p class="text-sm text-gray-600">
                                                {new Date(history.created_at).toLocaleString()}
                                            </p>
                                            <p class="text-sm text-gray-600">
                                                {history.from_email} → {history.to_email}
                                            </p>
                                        {:else}
                                            <p class="font-medium">
                                                {#if activeTab === 'received' || activeTab === 'gift'}
                                                    {history.description.replace('님에게', '')}
                                                {:else}
                                                    {history.description}
                                                {/if}
                                            </p>
                                            <p class="text-sm text-gray-600">
                                                {new Date(history.created_at).toLocaleString()}
                                            </p>
                                        {/if}
                                    </div>
                                    <div class={activeTab === 'charge' ? 'text-green-600' : (history.amount >= 0 ? 'text-green-600' : 'text-red-600')}>
                                        {#if activeTab === 'charge'}
                                            +{history.points_amount.toLocaleString()}P
                                        {:else if activeTab !== 'received'}
                                            {history.amount >= 0 ? '+' : ''}{history.amount.toLocaleString()}P
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>

                        <!-- 페이지네이션 -->
                        <div class="flex justify-center items-center space-x-2 mt-6">
                            {#if currentPage > 1}
                                <button 
                                    class="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                                    on:click={() => changePage(currentPage - 1)}
                                >
                                    이전
                                </button>
                            {/if}

                            {#each pageNumbers as pageNum}
                                <button 
                                    class="px-3 py-1 rounded {currentPage === pageNum ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}"
                                    on:click={() => changePage(pageNum)}
                                >
                                    {pageNum}
                                </button>
                            {/each}

                            {#if currentPage < totalPages}
                                <button 
                                    class="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                                    on:click={() => changePage(currentPage + 1)}
                                >
                                    다음
                                </button>
                            {/if}
                        </div>
                    {:else}
                        <div class="text-center text-gray-600">
                            <p>
                                {#if activeTab === 'purchase'}
                                    구매 내역이 없습니다.
                                {:else if activeTab === 'gift'}
                                    선물 보낸 내역이 없습니다.
                                {:else if activeTab === 'received'}
                                    선물 받은 내역이 없습니다.
                                {:else if activeTab === 'referral'}
                                    추천인 보상 내역이 없습니다.
                                {:else}
                                    충전 내역이 없습니다.
                                {/if}
                            </p>
                        </div>
                    {/if}
                {/if}
            </div>
        </div>
    {:else}
        <div class="text-center text-gray-600">
            <p>프로필 정보가 없습니다.</p>
        </div>
    {/if}
</div>

<style>
    .container {
        max-width: 800px;
    }

    .loading-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 300px;
    }

    .spinner {
        width: 50px;
        height: 50px;
        border: 5px solid #f3f3f3;
        border-top: 5px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>