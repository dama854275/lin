<script>
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase/client';

    let purchases = [];
    let loading = true;
    let error = null;

    // 필터 상태
    let emailFilter = '';
    let startDate = '';
    let endDate = '';

    // 페이지네이션 관련 변수
    let currentPage = 1;
    const itemsPerPage = 10;
    let totalPages = 0;

    // 새로운 필터 상태 추가
    let productFilter = 'all';
    let uniqueProducts = [];
    let totalPoints = 0;
    let filteredTotalPoints = 0;

    // 원본 데이터 저장을 위한 변수 추가
    let originalPurchases = [];

    // 월 선택을 위한 변수 추가
    let selectedMonth = new Date().toISOString().slice(0, 7); // 현재 년월을 기본값으로 (YYYY-MM 형식)

    // 날짜 포맷팅 함수
    function formatDate(dateString) {
        return new Date(dateString).toLocaleString('ko-KR');
    }

    // 고유한 상품 목록 추출 함수 수정
    function extractUniqueProducts(data) {
        // 구매 내역만 필터링하고 게임 이름 추출
        const purchaseOnly = data.filter(p => p.description.includes('구매'));
        const gameNames = purchaseOnly.map(p => {
            return p.description.replace(' 구매', '');
        });
        return [...new Set(gameNames)];
    }

    // 구매내역 로드 함수 수정
    async function loadPurchases() {
        try {
            loading = true;
            
            const { data: pointHistoryData, error: pointError } = await supabase
                .from('point_history')
                .select('*')
                .lt('amount', 0)
                .order('created_at', { ascending: false });

            if (pointError) throw pointError;

            if (pointHistoryData && pointHistoryData.length > 0) {
                const userIds = [...new Set(pointHistoryData.map(p => p.user_id))];
                const { data: userData, error: userError } = await supabase
                    .from('user_info')
                    .select('user_id, email')
                    .in('user_id', userIds);

                if (userError) throw userError;

                // 원본 데이터 저장
                originalPurchases = pointHistoryData.map(purchase => ({
                    ...purchase,
                    user_info: userData.find(user => user.user_id === purchase.user_id)
                }));

                // 고유한 게임 이름 목록 추출 (선물 제외)
                uniqueProducts = extractUniqueProducts(originalPurchases);
                
                // 초기 데이터 설정
                purchases = [...originalPurchases];
                totalPoints = Math.abs(purchases.reduce((sum, p) => sum + p.amount, 0));
            } else {
                originalPurchases = [];
                purchases = [];
                uniqueProducts = [];
                totalPoints = 0;
            }

            applyFilters();

        } catch (err) {
            console.error('구매내역 로드 중 오류:', err);
            error = '구매내역을 불러오는 중 오류가 발생했습니다.';
        } finally {
            loading = false;
        }
    }

    // 필터 적용 함수 수정
    function applyFilters() {
        // 항상 원본 데이터로부터 시작
        let filtered = [...originalPurchases];

        if (emailFilter) {
            filtered = filtered.filter(purchase => 
                purchase.user_info?.email?.toLowerCase().includes(emailFilter.toLowerCase())
            );
        }

        if (startDate) {
            filtered = filtered.filter(purchase => 
                new Date(purchase.created_at) >= new Date(startDate)
            );
        }

        if (endDate) {
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
            filtered = filtered.filter(purchase => 
                new Date(purchase.created_at) <= endDateTime
            );
        }

        if (productFilter !== 'all') {
            filtered = filtered.filter(purchase => {
                const desc = purchase.description;
                const gameName = productFilter;
                return desc.includes(gameName);
            });
        }

        filteredTotalPoints = Math.abs(filtered.reduce((sum, p) => sum + p.amount, 0));
        purchases = filtered;
        totalPages = Math.ceil(purchases.length / itemsPerPage);
        currentPage = 1;
    }

    // 페이지네이션 관련 함수들
    $: currentPageItems = purchases.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    function changePage(page) {
        currentPage = page;
    }

    $: pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

    // 필터 초기화 함수 수정
    function resetFilters() {
        emailFilter = '';
        startDate = '';
        endDate = '';
        productFilter = 'all';
        purchases = [...originalPurchases];
        applyFilters();
    }

    // 게임별 누적 포인트를 계산하는 함수 수정
    function calculateGameTotalPoints(data, monthFilter) {
        const gameTotals = {};
        const gameNames = new Set();
        
        // 선택된 월의 시작일과 종료일 계산
        const [year, month] = monthFilter.split('-');
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        
        // 먼저 구매 내역에서 게임 이름 추출 (해당 월의 데이터만)
        data.forEach(purchase => {
            const purchaseDate = new Date(purchase.created_at);
            if (purchase.description.includes('구매') && 
                purchaseDate >= startDate && 
                purchaseDate <= endDate) {
                const gameName = purchase.description.replace(' 구매', '');
                gameNames.add(gameName);
            }
        });

        // 각 게임별로 구매와 선물 포인트 합산 및 구매 횟수 계산
        gameNames.forEach(gameName => {
            gameTotals[gameName] = {
                points: 0,
                count: 0,
                uniqueUsers: new Set()
            };
            
            data.forEach(purchase => {
                const purchaseDate = new Date(purchase.created_at);
                if (purchase.description.includes(gameName) && 
                    purchaseDate >= startDate && 
                    purchaseDate <= endDate) {
                    gameTotals[gameName].points += Math.abs(purchase.amount);
                    gameTotals[gameName].count += 1;
                    gameTotals[gameName].uniqueUsers.add(purchase.user_id);
                }
            });
        });

        // 포인트 기준 내림차순 정렬
        return Object.entries(gameTotals)
            .sort(([, a], [, b]) => b.points - a.points)
            .map(([game, stats]) => ({ 
                game, 
                points: stats.points,
                count: stats.count,
                uniqueUsers: stats.uniqueUsers.size
            }));
    }

    // 게임별 통계를 저장할 반응형 변수 수정
    $: gameStats = calculateGameTotalPoints(originalPurchases, selectedMonth);

    // 선택된 월의 총 포인트를 계산하는 함수 추가
    function calculateMonthlyTotalPoints(data, monthFilter) {
        const [year, month] = monthFilter.split('-');
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        
        return Math.abs(data
            .filter(purchase => {
                const purchaseDate = new Date(purchase.created_at);
                return purchaseDate >= startDate && purchaseDate <= endDate;
            })
            .reduce((sum, p) => sum + p.amount, 0));
    }

    // 월별 총 포인트를 계산하는 반응형 변수 추가
    $: monthlyTotalPoints = calculateMonthlyTotalPoints(originalPurchases, selectedMonth);

    // 월 선택 변경 시 호출될 함수
    function handleMonthChange(event) {
        selectedMonth = event.target.value;
    }

    onMount(() => {
        loadPurchases();
    });
</script>

<div class="container mx-auto p-6">
    <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-800">상품 구매내역</h1>
    </div>

    <!-- 필터 섹션 -->
    <div class="bg-white rounded-lg shadow p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
                <label for="email-filter" class="block text-sm font-medium text-gray-700 mb-1">
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
                <label for="product-filter" class="block text-sm font-medium text-gray-700 mb-1">
                    상품 선택
                </label>
                <select
                    id="product-filter"
                    bind:value={productFilter}
                    class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">전체 상품</option>
                    {#each uniqueProducts as product}
                        <option value={product}>{product}</option>
                    {/each}
                </select>
            </div>
            <div>
                <label for="start-date" class="block text-sm font-medium text-gray-700 mb-1">
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
                <label for="end-date" class="block text-sm font-medium text-gray-700 mb-1">
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
        <div class="flex justify-end items-center mt-4">
            <div class="flex gap-2">
                <button
                    on:click={resetFilters}
                    class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors duration-200"
                >
                    초기화
                </button>
                <button
                    on:click={() => applyFilters()}
                    class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors duration-200"
                >
                    검색
                </button>
            </div>
        </div>
    </div>

    <!-- 게임별 누적 포인트 섹션 -->
    <div class="bg-white rounded-lg shadow p-4 mb-6">
        <div class="flex flex-col gap-4">
            <div class="flex justify-between items-center">
                <h2 class="text-lg font-semibold text-gray-800">게임별 누적 포인트 (구매 + 선물)</h2>
                <div class="flex items-center gap-4">
                    <div class="text-lg font-semibold text-gray-600">
                        누적 사용 포인트: <span class="text-blue-600">{monthlyTotalPoints.toLocaleString()} P</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <label for="month-select" class="text-sm font-medium text-gray-700">월 선택:</label>
                        <input
                            id="month-select"
                            type="month"
                            bind:value={selectedMonth}
                            class="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {#each gameStats as { game, points, count, uniqueUsers }}
                    <div class="bg-gray-50 rounded-lg p-4">
                        <div class="flex justify-between items-center mb-2">
                            <span class="font-medium text-gray-700">{game}</span>
                            <span class="text-blue-600 font-semibold">{points.toLocaleString()} P</span>
                        </div>
                        <div class="text-sm text-gray-500 text-right">
                            <div>구매 횟수: {count}회</div>
                            <div>구매 계정: {uniqueUsers}개</div>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    </div>

    <!-- 구매내역 테이블 -->
    {#if loading}
        <div class="flex justify-center items-center h-32">
            <p class="text-gray-600">로딩 중...</p>
        </div>
    {:else if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p>{error}</p>
        </div>
    {:else if currentPageItems.length === 0}
        <div class="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            <p>구매내역이 없습니다.</p>
        </div>
    {:else}
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이메일</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">구매내역</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사용 포인트</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">구매일시</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        {#each currentPageItems as purchase}
                            <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {purchase.user_info?.email}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {purchase.description}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {Math.abs(purchase.amount).toLocaleString()} P
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {formatDate(purchase.created_at)}
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>

            <!-- 페이지네이션 -->
            <div class="flex justify-center items-center space-x-2 p-4 bg-gray-50">
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
        </div>
    {/if}
</div>

<style>
    .container {
        max-width: 1400px;  /* 컨테이너 최대 너비 증가 */
    }
</style>
