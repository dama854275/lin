<script>
    export let data;
    const { userInfos } = data;
    let searchTerm = '';
    let selectedUser = null;
    let showModal = false;
    let activeTab = '1:1문의';
    
    // 상태 변수들
    let transactions = [];
    let contacts = [];
    let loadingTransactions = false;
    let loadingContacts = false;
    let purchases = [];
    let loadingPurchases = false;
    let gifts = [];
    let loadingGifts = false;
    let receivedGifts = [];
    let loadingReceivedGifts = false;

    import { supabase } from '$lib/supabase/client';

    // 검색어에 따른 필터링
    $: filteredUsers = (userInfos || []).filter(user => 
        user && user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 검색어 초기화
    function clearSearch() {
        searchTerm = '';
    }

    // 날짜 포맷팅 함수
    function formatDate(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('ko-KR');
    }

    const tabs = ['1:1문의', '충전내역', '구매내역', '선물 받은 내역'];

    // 트랜잭션 데이터 로드 함수 추가
    async function loadTransactions(userId) {
        try {
            loadingTransactions = true;
            const { data: txData, error } = await supabase
                .from('transaction_history')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return txData || [];
        } catch (err) {
            console.error('트랜잭션 로드 오류:', err);
            return [];
        } finally {
            loadingTransactions = false;
        }
    }

    // contacts 데이터 로드 함수 추가
    async function loadContacts(userId) {
        try {
            loadingContacts = true;
            const { data: contactsData, error } = await supabase
                .from('contacts')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return contactsData || [];
        } catch (err) {
            console.error('문의내역 로드 오류:', err);
            return [];
        } finally {
            loadingContacts = false;
        }
    }

    // 구매내역 로드 함수
    async function loadPurchases(userId) {
        try {
            loadingPurchases = true;
            const { data: purchaseData, error } = await supabase
                .from('point_history')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return purchaseData || [];
        } catch (err) {
            console.error('구매내역 로드 오류:', err);
            return [];
        } finally {
            loadingPurchases = false;
        }
    }

    // 선물내역 로드 함수
    async function loadGifts(userId) {
        try {
            loadingGifts = true;
            const { data: giftData, error } = await supabase
                .from('gift_history')
                .select(`
                    *,
                    sender:sender_id(email),
                    receiver:receiver_id(email)
                `)
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return giftData || [];
        } catch (err) {
            console.error('선물내역 로드 오류:', err);
            return [];
        } finally {
            loadingGifts = false;
        }
    }

    // 선물 받은 내역 로드 함수 수정
    async function loadReceivedGifts(userId) {
        try {
            loadingReceivedGifts = true;
            
            // 1. 먼저 선물 내역을 가져옵니다
            const { data: giftData, error: giftError } = await supabase
                .from('gift_history')
                .select('*')
                .eq('receiver_id', userId)
                .order('created_at', { ascending: false });

            if (giftError) throw giftError;

            // 2. 보낸 사람들의 ID 목록을 추출합니다
            const senderIds = giftData.map(gift => gift.sender_id);

            // 3. 보낸 사람들의 이메일 정보를 가져옵니다
            const { data: senderData, error: senderError } = await supabase
                .from('user_info')
                .select('user_id, email')
                .in('user_id', senderIds);

            if (senderError) throw senderError;

            // 4. 선물 내역과 보낸 사람 정보를 결합합니다
            const enrichedGiftData = giftData.map(gift => ({
                ...gift,
                sender_email: senderData.find(sender => sender.user_id === gift.sender_id)?.email || '알 수 없음'
            }));

            return enrichedGiftData || [];
        } catch (err) {
            console.error('선물 받은 내역 로드 오류:', err);
            return [];
        } finally {
            loadingReceivedGifts = false;
        }
    }

    // 모달 열기 함수 수정
    async function openModal(user) {
        selectedUser = user;
        showModal = true;
        activeTab = '1:1문의';
        
        if (user && user.user_id) {
            // 모든 데이터 로드
            contacts = await loadContacts(user.user_id);
            transactions = await loadTransactions(user.user_id);
            purchases = await loadPurchases(user.user_id);
            receivedGifts = await loadReceivedGifts(user.user_id);
            
            selectedUser = { 
                ...selectedUser, 
                contacts,
                transactions,
                purchases,
                receivedGifts
            };
        }
    }

    function closeModal() {
        showModal = false;
        selectedUser = null;
    }
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">회원 정보 관리</h1>
    
    <!-- 검색 섹션 -->
    <div class="mb-6">
        <div class="flex gap-2 items-center max-w-md">
            <div class="relative flex-1">
                <input 
                    type="text" 
                    bind:value={searchTerm}
                    placeholder="회원 이메일 검색..."
                    class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pl-10"
                />
                <!-- 검색 아이콘 -->
                <span 
                    class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    role="img"
                    aria-label="검색 아이콘"
                >
                    <svg 
                        class="h-5 w-5" 
                        xmlns="http://www.w3.org/2000/svg" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                        aria-hidden="true"
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </span>
                
                <!-- 검색어가 있을 때만 X 버튼 표시 -->
                {#if searchTerm}
                    <button 
                        class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        on:click={clearSearch}
                        aria-label="검색 우기"
                    >
                        <svg 
                            class="h-5 w-5" 
                            xmlns="http://www.w3.org/2000/svg" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                            aria-hidden="true"
                        >
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                {/if}
            </div>
        </div>
        <!-- 검색 결과 카운트 -->
        <div class="mt-2 text-sm text-gray-600">
            총 {filteredUsers.length}명의 회원이 검색되었습니다.
        </div>
    </div>
    
    <div class="overflow-x-auto">
        <table class="min-w-full bg-white border">
            <thead>
                <tr class="bg-gray-100">
                    <th class="px-4 py-2 border">이메일</th>
                    <th class="px-4 py-2 border">가입일</th>
                    <th class="px-4 py-2 border">포인트</th>
                    <th class="px-4 py-2 border">추천인</th>
                    <th class="px-4 py-2 border">상품 정보</th>
                </tr>
            </thead>
            <tbody>
                {#each filteredUsers as user}
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-2 border">
                            <div class="flex items-center justify-between">
                                <span>{user.email}</span>
                                <button
                                    class="ml-2 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                                    on:click={() => openModal(user)}
                                >
                                    상세보기
                                </button>
                            </div>
                        </td>
                        <td class="px-4 py-2 border">{formatDate(user.created_at)}</td>
                        <td class="px-4 py-2 border text-right">{user.points?.toLocaleString() ?? 0}</td>
                        <td class="px-4 py-2 border">{user.referrer_email}</td>
                        <td class="px-4 py-2 border">
                            {#each Object.entries(user).filter(([key]) => key.startsWith('product_')) as [key, value]}
                                <div class="text-sm">
                                    {key.replace('product_', '')}: {formatDate(value)}
                                </div>
                            {/each}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</div>

<!-- 모달 -->
{#if showModal}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[80vh] overflow-hidden">
            <!-- 모달 헤더 -->
            <div class="px-6 py-4 border-b bg-gray-50">
                <div class="flex justify-between items-start">
                    <div>
                        <h2 class="text-xl font-semibold mb-1">
                            {selectedUser.email} 회원 상세정보
                        </h2>
                        <p class="text-sm text-gray-600">
                            가입일: {formatDate(selectedUser.created_at)}
                        </p>
                    </div>
                    <button 
                        class="text-gray-500 hover:text-gray-700"
                        on:click={closeModal}
                        aria-label="모달 닫기"
                    >
                        <svg 
                            class="w-6 h-6" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                        >
                            <path 
                                stroke-linecap="round" 
                                stroke-linejoin="round" 
                                stroke-width="2" 
                                d="M6 18L18 6M6 6l12 12" 
                            />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- 로딩 상태 표시 -->
            {#if loadingContacts || loadingTransactions || loadingPurchases || loadingReceivedGifts}
                <div class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                    <div class="text-center">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                        <p class="text-gray-600">데이터를 불러오는 중...</p>
                    </div>
                </div>
            {/if}

            <!-- 탭 메뉴 -->
            <div class="px-6 py-2 border-b">
                <div class="flex space-x-4">
                    {#each tabs as tab}
                        <button
                            class="px-4 py-2 rounded-t-lg {activeTab === tab ? 
                                'bg-blue-500 text-white' : 
                                'text-gray-600 hover:bg-gray-100'}"
                            on:click={() => activeTab = tab}
                        >
                            {tab}
                        </button>
                    {/each}
                </div>
            </div>

            <!-- 탭 컨텐츠 -->
            <div class="p-6 overflow-y-auto" style="max-height: calc(80vh - 160px);">
                {#if activeTab === '1:1문의'}
                    {#if loadingContacts}
                        <div class="text-center py-8">
                            <p class="text-gray-600">로딩 중...</p>
                        </div>
                    {:else if selectedUser.contacts && selectedUser.contacts.length > 0}
                        <div class="space-y-4">
                            {#each selectedUser.contacts as contact}
                                <div class="border rounded-lg p-4 hover:bg-gray-50">
                                    <div class="flex justify-between items-start">
                                        <div>
                                            <div class="flex items-center gap-2">
                                                <h3 class="font-medium text-lg">{contact.title}</h3>
                                                <span class={`px-2 py-1 rounded-full text-sm ${
                                                    contact.status === 'pending' 
                                                        ? 'bg-orange-100 text-orange-700' 
                                                        : 'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                    {contact.status === 'pending' ? '답변 대기중' : '답변 완료'}
                                                </span>
                                            </div>
                                            <p class="text-sm text-gray-600">
                                                {formatDate(contact.created_at)}
                                            </p>
                                            <p class="mt-2 text-gray-700">{contact.content}</p>
                                        </div>
                                        <span class="text-sm text-gray-500">ID: {contact.id}</span>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <div class="text-center text-gray-600 py-8">
                            <p>1:1 문의 내역이 없습니다.</p>
                            <p class="text-sm mt-2">이메일: {selectedUser.email}</p>
                        </div>
                    {/if}
                {:else if activeTab === '충전내역'}
                    {#if loadingTransactions}
                        <div class="text-center py-8">
                            <p class="text-gray-600">로딩 중...</p>
                        </div>
                    {:else if selectedUser.transactions && selectedUser.transactions.length > 0}
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">충전 포인트</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">거래 ID</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    {#each selectedUser.transactions as tx}
                                        <tr class="hover:bg-gray-50">
                                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                                                {formatDate(tx.created_at)}
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap">
                                                <span class={`px-2 py-1 text-xs rounded-full ${
                                                    tx.transaction_status 
                                                        ? 'bg-green-100 text-green-800' 
                                                        : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {tx.transaction_status ? '성공' : '실패'}
                                                </span>
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap">
                                                <span class="font-medium text-blue-600">
                                                    {tx.points_amount?.toLocaleString() ?? 0}
                                                    <span class="text-gray-500 text-sm">P</span>
                                                </span>
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div class="flex items-center gap-2">
                                                    <div class="max-w-xs truncate" title={tx.txid}>
                                                        {tx.txid}
                                                    </div>
                                                    <button
                                                        class="p-1 text-gray-400 hover:text-gray-600"
                                                        title="Tronscan에서 보기"
                                                        aria-label="Tronscan에서 거래 내역 보기"
                                                        on:click={() => window.open(`https://tronscan.org/#/transaction/${tx.txid}`, '_blank')}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    {:else}
                        <div class="text-center text-gray-600 py-8">
                            <p>충전 내역이 없습니다.</p>
                            <p class="text-sm mt-2">이메일: {selectedUser.email}</p>
                        </div>
                    {/if}
                {:else if activeTab === '구매내역'}
                    {#if loadingPurchases}
                        <div class="text-center py-8">
                            <p class="text-gray-600">로딩 중...</p>
                        </div>
                    {:else if selectedUser.purchases && selectedUser.purchases.length > 0}
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">내용</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">포인트</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    {#each selectedUser.purchases as purchase}
                                        <tr class="hover:bg-gray-50">
                                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                                                {formatDate(purchase.created_at)}
                                            </td>
                                            <td class="px-6 py-4">
                                                <span class="text-gray-900">{purchase.description}</span>
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap">
                                                <span class="font-medium text-red-600">
                                                    -{purchase.amount?.toLocaleString() ?? 0}
                                                    <span class="text-gray-500 text-sm">P</span>
                                                </span>
                                            </td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    {:else}
                        <div class="text-center text-gray-600 py-8">
                            <p>구매 내이 없습니다.</p>
                            <p class="text-sm mt-2">이메일: {selectedUser.email}</p>
                        </div>
                    {/if}
                {:else if activeTab === '선물 받은 내역'}
                    {#if loadingReceivedGifts}
                        <div class="text-center py-8">
                            <p class="text-gray-600">로딩 중...</p>
                        </div>
                    {:else if selectedUser.receivedGifts && selectedUser.receivedGifts.length > 0}
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">보낸 사람</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">포인트</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    {#each selectedUser.receivedGifts as gift}
                                        <tr class="hover:bg-gray-50">
                                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                                                {formatDate(gift.created_at)}
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap">
                                                <span class="text-gray-900">
                                                    {gift.sender_email}
                                                </span>
                                            </td>
                                            <td class="px-6 py-4">
                                                {gift.product_name}
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap">
                                                <span class="font-medium text-green-600">
                                                    +{gift.points?.toLocaleString() ?? 0}
                                                    <span class="text-gray-500 text-sm">P</span>
                                                </span>
                                            </td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    {:else}
                        <div class="text-center text-gray-600 py-8">
                            <p>선물 받은 내역이 없습니다.</p>
                            <p class="text-sm mt-2">이메일: {selectedUser.email}</p>
                        </div>
                    {/if}
                {/if}
            </div>

            <!-- 모달 푸터 -->
            <div class="px-6 py-4 border-t bg-gray-50 flex justify-end">
                <button
                    class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    on:click={closeModal}
                >
                    닫기
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    /* 모달이 열려있을 때 페이지 스크롤 방지 */
    :global(body.modal-open) {
        overflow: hidden;
    }
</style>