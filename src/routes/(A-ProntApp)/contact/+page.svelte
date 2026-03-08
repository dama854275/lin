<script>
    import { user } from '$lib/stores/auth';
    import { supabase } from '$lib/supabase/client';
    import { onMount } from 'svelte';
    export let data;
    
    let isAdmin = false;
    let searchEmail = '';
    let startDate = '';
    let endDate = '';
    let statusFilter = 'all';
    let classificationFilter = 'all';
    let gameClassificationFilter = 'all';
    let filteredContacts = [];

    const classifications = [
        { value: 'all', label: '전체' },
        { value: 'game_error', label: '게임 오류 보고' },
        { value: 'billing', label: '결제 문의' },
        { value: 'suggestion', label: '개선 제안' },
        { value: 'other', label: '기타' }
    ];

    const gameClassifications = [
        { value: 'all', label: '전체' },
        { value: 'odin', label: '오딘' },
        { value: 'rom', label: 'ROM' },
        { value: 'asdal', label: '아스달 연대기' },
        { value: 'xenonia', label: '제노니아' },
        { value: 'night_crow', label: '나이트 크로우' },
        { value: 'raven2', label: '레이븐2' },
        { value: 'archeage', label: '아키에이지 워' },
        { value: 'ymir', label: '이미르' },
        { value: 'RF', label: 'RF' },
        { value: 'lodenine', label: '로드나인' }
    ];

    onMount(async () => {
        if ($user) {
            const { data, error: adminError } = await supabase
                .from('admin_users')
                .select('*')
                .eq('user_id', $user.id);
            
            isAdmin = data && data.length > 0;
        }
        filteredContacts = data.contacts;
    });
    
    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('ko-KR');
    }

    // 필터링 함수
    function filterContacts() {
        filteredContacts = data.contacts.filter(contact => {
            const emailMatch = !searchEmail || 
                contact.user_email?.toLowerCase().includes(searchEmail.toLowerCase());
            
            const contactDate = new Date(contact.created_at);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            
            // 시작일 설정
            if (start) {
                start.setHours(0, 0, 0, 0);
            }
            
            // 종료일 설정
            if (end) {
                end.setHours(23, 59, 59, 999);
            }

            const dateMatch = (!start || contactDate >= start) && 
                            (!end || contactDate <= end);

            // 상태 필터 추가
            const statusMatch = statusFilter === 'all' || contact.status === statusFilter;

            // 분류 필터 추가
            const classificationMatch = classificationFilter === 'all' || contact.classification === classificationFilter;

            // 게임 분류 필터 추가
            const gameClassificationMatch = classificationFilter !== 'game_error' || 
                                          gameClassificationFilter === 'all' || 
                                          (contact.classification === 'game_error' && contact.game_classification === gameClassificationFilter);

            return emailMatch && dateMatch && statusMatch && classificationMatch && gameClassificationMatch;
        });
    }

    // 필터 초기화
    function resetFilters() {
        searchEmail = '';
        startDate = '';
        endDate = '';
        statusFilter = 'all';
        classificationFilter = 'all';
        gameClassificationFilter = 'all';
        filteredContacts = data.contacts;
    }

    $: isLoggedIn = !!$user;
</script>

<div class="container mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">1:1 문의</h1>
        {#if isLoggedIn}
            <a href="/contact/write" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                문의하기
            </a>
        {/if}
    </div>

    <!-- 관리자용 필터 -->
    {#if isAdmin}
        <div class="bg-white rounded-lg shadow p-4 mb-6">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label 
                        for="search-email" 
                        class="block text-sm font-medium text-gray-700 mb-1"
                    >
                        작성자 이메일 검색
                    </label>
                    <input
                        id="search-email"
                        type="text"
                        bind:value={searchEmail}
                        placeholder="이메일 검색..."
                        class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label 
                        for="start-date" 
                        class="block text-sm font-medium text-gray-700 mb-1"
                    >
                        시작일
                    </label>
                    <input
                        id="start-date"
                        type="date"
                        bind:value={startDate}
                        class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label 
                        for="end-date" 
                        class="block text-sm font-medium text-gray-700 mb-1"
                    >
                        종료일
                    </label>
                    <input
                        id="end-date"
                        type="date"
                        bind:value={endDate}
                        class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label 
                        for="status-filter" 
                        class="block text-sm font-medium text-gray-700 mb-1"
                    >
                        답변 상태
                    </label>
                    <select
                        id="status-filter"
                        bind:value={statusFilter}
                        class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">전체</option>
                        <option value="pending">답변 대기중</option>
                        <option value="completed">답변 완료</option>
                    </select>
                </div>
                <div>
                    <label 
                        for="classification-filter" 
                        class="block text-sm font-medium text-gray-700 mb-1"
                    >
                        분류
                    </label>
                    <select
                        id="classification-filter"
                        bind:value={classificationFilter}
                        class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {#each classifications as option}
                            <option value={option.value}>{option.label}</option>
                        {/each}
                    </select>
                </div>
                {#if classificationFilter === 'game_error'}
                    <div>
                        <label 
                            for="game-classification-filter" 
                            class="block text-sm font-medium text-gray-700 mb-1"
                        >
                            게임 분류
                        </label>
                        <select
                            id="game-classification-filter"
                            bind:value={gameClassificationFilter}
                            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {#each gameClassifications as option}
                                <option value={option.value}>{option.label}</option>
                            {/each}
                        </select>
                    </div>
                {/if}
            </div>
            <div class="flex justify-end mt-4 gap-2">
                <button
                    on:click={resetFilters}
                    class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                    초기화
                </button>
                <button
                    on:click={filterContacts}
                    class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    검색
                </button>
            </div>
        </div>
    {/if}

    <div class="bg-white rounded-lg shadow">
        {#if !isLoggedIn}
            <div class="p-8 text-center">
                <p class="text-gray-600 mb-4">1:1 문의를 작성하려면 로그인이 필요합니다.</p>
                <a href="/login" class="inline-block bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600">
                    로그인하기
                </a>
            </div>
        {:else if filteredContacts.length === 0}
            <div class="p-4 text-center text-gray-500">
                {searchEmail || startDate || endDate ? '검색 결과가 없습니다.' : '작성한 문의가 없습니다.'}
            </div>
        {:else}
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">
                                제목
                            </th>
                            {#if isAdmin}
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                                    작성자
                                </th>
                                <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                                    분류
                                </th>
                                <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                                    게임 분류
                                </th>
                            {/if}
                            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                                작성일
                            </th>
                            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                                상태
                            </th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        {#each filteredContacts as contact}
                            <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4">
                                    <a 
                                        href="/contact/{contact.id}" 
                                        class="group flex items-center"
                                    >
                                        <span class="text-gray-900 group-hover:text-blue-600 font-medium transition-colors duration-150">
                                            {contact.title}
                                        </span>
                                        {#if contact.image_url}
                                            <span class="ml-2 text-gray-400">
                                                <i class="fas fa-image"></i>
                                            </span>
                                        {/if}
                                    </a>
                                </td>
                                {#if isAdmin}
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {contact.user_email || contact.user_id}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                                        {classifications.find(c => c.value === contact.classification)?.label || '미분류'}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                                        {contact.classification === 'game_error' 
                                            ? gameClassifications.find(c => c.value === contact.game_classification)?.label || '미분류'
                                            : '-'}
                                    </td>
                                {/if}
                                <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                                    {formatDate(contact.created_at)}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-center">
                                    <span class={`inline-flex items-center justify-center px-3 py-1.5 rounded-full text-sm font-medium ${
                                        contact.status === 'pending' 
                                            ? 'bg-orange-100 text-orange-700 border border-orange-200' 
                                            : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    }`}>
                                        {#if contact.status === 'pending'}
                                            <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            답변 대기중
                                        {:else}
                                            <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                            답변 완료
                                        {/if}
                                    </span>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </div>
</div>

<style>
    /* 추가적인 스타일 */
    .group {
        text-decoration: none;
    }
    
    .group:hover .group-hover\:text-blue-600 {
        text-decoration: none;
    }

    /* 상태 배지 호버 효과 */
    .inline-flex {
        transition: all 0.2s ease-in-out;
    }

    .inline-flex:hover {
        transform: scale(1.05);
    }

    /* 컨테이너 스타일 추가 */
    .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 1rem;
    }
</style>
