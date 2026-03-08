<script>
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase/client';
    import { user } from '$lib/stores/auth';

    let transactions = [];
    let loading = true;
    let error = null;

    // 필터 상태
    let emailFilter = '';
    let startDate = '';
    let endDate = '';

    // 월 선택을 위한 변수 추가
    let selectedMonth = new Date().toISOString().slice(0, 7); // 현재 년월을 기본값으로 (YYYY-MM 형식)

    // 통계 데이터 상태를 더 안전하게 초기화
    let statistics = {
        today: 0,
        last30Days: 0,
        thisMonth: 0,
        selectedMonth: 0
    };

    // 날짜 포맷팅 함수
    function formatDate(dateString) {
        return new Date(dateString).toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }

    // 상태에 따른 배지 스타일
    function getStatusBadgeClass(status) {
        if (status === true) {
            return 'bg-green-100 text-green-800';
        } else {
            return 'bg-red-100 text-red-800';
        }
    }

    // 선택한 월의 충전 포인트 계산 함수 수정
    async function calculateSelectedMonthStatistics(monthStr) {
        if (!monthStr) return;
        
        try {
            const [year, month] = monthStr.split('-');
            const startDate = new Date(year, month - 1, 1).toISOString();
            const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

            const { data, error } = await supabase
                .from('transaction_history')
                .select('points_amount')
                .eq('transaction_status', true)
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            if (error) throw error;

            // 통계 업데이트를 더 안전하게 처리
            statistics = {
                ...statistics,
                selectedMonth: data?.reduce((sum, tx) => sum + (parseInt(tx.points_amount) || 0), 0) || 0
            };
        } catch (err) {
            console.error('선택한 월 통계 계산 중 오류:', err);
            statistics = {
                ...statistics,
                selectedMonth: 0
            };
        }
    }

    // selectedMonth가 변경될 때마다 통계 다시 계산
    $: {
        if (selectedMonth) {
            calculateSelectedMonthStatistics(selectedMonth);
        }
    }

    // 통계 계산 함수 수정
    async function calculateStatistics() {
        try {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            // 성공한 거래만 필터링하여 통계 계산
            const { data: allData, error: fetchError } = await supabase
                .from('transaction_history')
                .select('*')
                .eq('transaction_status', true);

            if (fetchError) throw fetchError;

            const todayData = allData.filter(tx => new Date(tx.created_at) >= new Date(todayStart));
            const last30DaysData = allData.filter(tx => new Date(tx.created_at) >= thirtyDaysAgo);
            const thisMonthData = allData.filter(tx => new Date(tx.created_at) >= new Date(monthStart));

            // 통계 업데이트를 더 안전하게 처리
            const newStats = {
                today: todayData?.reduce((sum, tx) => sum + (parseInt(tx.points_amount) || 0), 0) || 0,
                last30Days: last30DaysData?.reduce((sum, tx) => sum + (parseInt(tx.points_amount) || 0), 0) || 0,
                thisMonth: thisMonthData?.reduce((sum, tx) => sum + (parseInt(tx.points_amount) || 0), 0) || 0,
                selectedMonth: statistics.selectedMonth // 기존 selectedMonth 값 유지
            };

            statistics = newStats;
        } catch (err) {
            console.error('통계 계산 중 오류:', err);
            error = '통계 데이터를 불러오는 중 오류가 발생했습니다.';
        }
    }

    // 안전한 값 표시를 위한 헬퍼 함수
    function formatStatValue(value) {
        return (value || 0).toLocaleString();
    }

    // 트랜잭션 데이터 로드 함수 수정
    async function loadTransactions() {
        try {
            loading = true;
            
            // 트랜잭션 데이터 가져오기
            let { data: transactionData, error: transactionError } = await supabase
                .from('transaction_history')
                .select('*')
                .order('created_at', { ascending: false });

            if (transactionError) throw transactionError;

            // 모든 user_id 추출
            const userIds = [...new Set(transactionData.map(tx => tx.user_id))];

            // user_info 데이터 가져오기
            const { data: userData, error: userError } = await supabase
                .from('user_info')
                .select('user_id, email')
                .in('user_id', userIds);

            if (userError) throw userError;

            // 데이터 결합
            transactions = transactionData.map(tx => ({
                ...tx,
                email: userData.find(user => user.user_id === tx.user_id)?.email || '알 수 없음'
            }));

            // 필터 적용
            if (emailFilter.trim()) {
                transactions = transactions.filter(tx => 
                    tx.email.toLowerCase().includes(emailFilter.toLowerCase())
                );
            }

            if (startDate) {
                transactions = transactions.filter(tx => 
                    new Date(tx.created_at) >= new Date(startDate + 'T00:00:00')
                );
            }

            if (endDate) {
                transactions = transactions.filter(tx => 
                    new Date(tx.created_at) <= new Date(endDate + 'T23:59:59')
                );
            }

            // 통계 업데이트
            await calculateStatistics();

        } catch (err) {
            console.error('Error loading transactions:', err);
            error = '거래 내역을 불러오는 중 오류가 발생했습니다.';
            transactions = [];
        } finally {
            loading = false;
        }
    }

    // 필터 초기화
    function resetFilters() {
        emailFilter = '';
        startDate = '';
        endDate = '';
        loadTransactions();
    }

    // 복사 함수 수정
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            alert('거래 ID가 클립보드에 복사되었습니다.');
        } catch (err) {
            console.error('복사 실패:', err);
            alert('복사에 실패했습니다.');
        }
    }

    // Tronscan 링크 열기 함수 추가
    function openTronscan(txid) {
        window.open(`https://tronscan.org/#/transaction/${txid}`, '_blank');
    }

    onMount(() => {
        loadTransactions();
    });
</script>

<div class="container mx-auto p-6">
    <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-800">포인트 충전 내역</h1>
    </div>

    <!-- 수정된 필터 섹션 -->
    <div class="bg-white rounded-lg shadow p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label 
                    for="email-filter" 
                    class="block text-sm font-medium text-gray-700 mb-1"
                >
                    이메일 검색
                </label>
                <input
                    id="email-filter"
                    type="text"
                    bind:value={emailFilter}
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
        </div>
        <div class="flex justify-end mt-4 gap-2">
            <button
                on:click={resetFilters}
                class="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 min-w-[120px]"
            >
                초기화
            </button>
            <button
                on:click={loadTransactions}
                class="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 min-w-[120px]"
            >
                검색
            </button>
        </div>
    </div>

    <!-- 통계 섹션 수정 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <!-- 금일 충전 포인트 -->
        <div class="bg-white rounded-lg shadow p-4">
            <h3 class="text-sm font-medium text-gray-500 mb-2">금일 충전 포인트</h3>
            <p class="text-2xl font-bold text-blue-600">
                {formatStatValue(statistics.today)}
                <span class="text-lg font-medium text-gray-500">P</span>
            </p>
        </div>

        <!-- 최근 30일 충전 포인트 -->
        <div class="bg-white rounded-lg shadow p-4">
            <h3 class="text-sm font-medium text-gray-500 mb-2">최근 30일 충전 포인트</h3>
            <p class="text-2xl font-bold text-blue-600">
                {formatStatValue(statistics.last30Days)}
                <span class="text-lg font-medium text-gray-500">P</span>
            </p>
        </div>

        <!-- 월별 충전 포인트 -->
        <div class="bg-white rounded-lg shadow p-4">
            <div class="flex flex-col">
                <h3 class="text-sm font-medium text-gray-500 mb-2">월별 충전 포인트</h3>
                <div class="flex items-center gap-2 mb-2">
                    <input
                        type="month"
                        bind:value={selectedMonth}
                        class="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                    />
                </div>
                <p class="text-2xl font-bold text-blue-600">
                    {formatStatValue(statistics.selectedMonth)}
                    <span class="text-lg font-medium text-gray-500">P</span>
                </p>
            </div>
        </div>
    </div>

    <!-- 테이블 섹션 -->
    {#if loading}
        <div class="flex justify-center items-center h-32">
            <p class="text-gray-600">로딩 중...</p>
        </div>
    {:else if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p>{error}</p>
        </div>
    {:else}
        <div class="overflow-x-auto bg-white rounded-lg shadow">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이메일</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">날짜</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">충전 포인트</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">거래 ID</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    {#each transactions as tx}
                        <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tx.email}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(tx.created_at)}</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full {getStatusBadgeClass(tx.transaction_status)}">
                                    {tx.transaction_status ? '성공' : '실패'}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="points-amount">
                                    {tx.points_amount != null ? tx.points_amount.toLocaleString() : '0'}
                                    <span class="points-unit">P</span>
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div class="flex items-center gap-2">
                                    <div class="max-w-xs truncate" title={tx.txid}>
                                        {tx.txid}
                                    </div>
                                    <div class="flex gap-1">
                                        <button
                                            class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                            title="거래 ID 복사"
                                            aria-label="거래 ID 복사"
                                            on:click={() => copyToClipboard(tx.txid)}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </button>
                                        <button
                                            class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                            title="Tronscan에서 보기"
                                            aria-label="Tronscan에서 거래 내역 보기"
                                            on:click={() => openTronscan(tx.txid)}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>

<style>
    .container {
        max-width: 1400px;
    }

    .points-amount {
        font-size: 1.1rem;
        font-weight: 600;
        color: #2563eb; /* blue-600 */
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
    }

    .points-unit {
        font-size: 0.9rem;
        font-weight: 500;
        color: #4b5563; /* gray-600 */
    }

    /* 입력 필 포커스 효과 */
    input:focus {
        outline: none;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }
</style>
