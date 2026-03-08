<script>
    import { enhance } from '$app/forms';
    export let data;
    let editingDate = null;
    let message = '';
    let searchTerm = '';
    let users = data.users || [];

    // 검색어에 따른 필터링
    $: filteredUsers = users.filter(user => 
        user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    function formatDate(dateString) {
        if (!dateString) return '기간 없음';
        return new Date(dateString).toLocaleDateString('ko-KR');
    }

    function getProductName(columnName) {
        return columnName.replace('product_', '').toUpperCase();
    }

    // 검색어 초기화
    function clearSearch() {
        searchTerm = '';
    }

    let selectedProduct = null;
    let daysToAdd = 1;
    let activeUsersCount = 0;

    // 선택된 상품의 활성 사용자 수 계산
    function updateActiveUsersCount(productColumn) {
        if (!productColumn || !users || users.length === 0) {
            activeUsersCount = 0;
            return;
        }
        
        activeUsersCount = users.filter(user => 
            user?.products?.[productColumn] && 
            new Date(user.products[productColumn]) > new Date()
        ).length;
    }
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-6">회원 상품 관리</h1>

    {#if data.error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {data.error}
        </div>
    {/if}

    {#if message}
        <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {message}
        </div>
    {/if}

    

    <!-- 일괄 수정 섹션 수정 -->
    <div class="bg-white rounded-lg shadow p-4 mb-6">
        <h2 class="text-lg font-semibold mb-4">상품 보유 회원 기간 일괄 수정</h2>
        <p class="text-sm text-gray-600 mb-4">
            선택한 상품을 보유한 회원들의 기간을 일괄 수정합니다.
        </p>
        <form 
            method="POST" 
            action="?/updateAllDates"
            class="flex gap-4 items-end"
            use:enhance={({ form }) => {
                return async ({ result }) => {
                    if (result.type === 'success') {
                        message = result.data.message;
                        window.location.reload();
                    } else {
                        message = result.data?.message || '일괄 수정에 실패했습니다.';
                    }
                };
            }}
        >
            <div class="flex-1">
                <label for="productColumn" class="block text-sm font-medium mb-1">상품 선택</label>
                <select 
                    id="productColumn"
                    name="productColumn" 
                    class="w-full border rounded px-3 py-2"
                    required
                    on:change={(e) => {
                        selectedProduct = e.target.value;
                        updateActiveUsersCount(e.target.value);
                    }}
                >
                    <option value="">선택하세요</option>
                    {#each users.length > 0 ? Object.keys(users[0]?.products || {}) : [] as productColumn}
                        <option value={productColumn}>{getProductName(productColumn)}</option>
                    {/each}
                </select>
                {#if selectedProduct}
                    <p class="mt-2 text-sm text-gray-600">
                        현재 {getProductName(selectedProduct)} 상품을 보유한 
                        <span class="font-semibold text-blue-600">{activeUsersCount}명</span>의 
                        회원이 수정 대상입니다.
                    </p>
                {/if}
            </div>
            <div>
                <label for="daysToAdd" class="block text-sm font-medium mb-1">추가할 일수</label>
                <input 
                    id="daysToAdd"
                    type="number" 
                    name="daysToAdd"
                    bind:value={daysToAdd}
                    class="border rounded px-3 py-2 w-32"
                    required
                />
            </div>
            <button
                type="submit"
                class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                disabled={!selectedProduct || activeUsersCount === 0}
            >
                일괄 수정
            </button>
        </form>
    </div>

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
                <button 
                    class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    aria-label="검색"
                >
                    <svg 
                        class="h-5 w-5" 
                        xmlns="http://www.w3.org/2000/svg" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </button>
                
                <!-- 검색어가 있을 때만 X 버튼 표시 -->
                {#if searchTerm}
                    <button 
                        class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        on:click={clearSearch}
                        aria-label="검색어 지우기"
                    >
                        <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

    <div class="bg-white rounded-lg shadow overflow-x-auto">
        <table class="min-w-full">
            <thead>
                <tr class="bg-gray-100">
                    <th class="px-4 py-2 text-left">이메일</th>
                    <th class="px-4 py-2 text-left">상품</th>
                </tr>
            </thead>
            <tbody>
                {#each filteredUsers as user}
                    <tr class="border-t">
                        <td class="px-4 py-2 align-top">{user?.email || 'N/A'}</td>
                        <td class="px-4 py-2">
                            <div class="space-y-2">
                                {#each (data.productColumns || []) as productColumn}
                                    <div class="flex items-center justify-between bg-gray-50 p-2 rounded">
                                        <span class="font-medium">{getProductName(productColumn)}</span>
                                        <div class="flex items-center gap-2">
                                            {#if editingDate === `${user?.user_id}-${productColumn}`}
                                                <form 
                                                    method="POST" 
                                                    action="?/updateDate"
                                                    class="flex items-center gap-2"
                                                    use:enhance={({ form }) => {
                                                        return async ({ result }) => {
                                                            if (result.type === 'success') {
                                                                message = result.data.message;
                                                                editingDate = null;
                                                                
                                                                // 데이터 새로고침
                                                                window.location.reload();
                                                            } else {
                                                                message = result.data?.message || '업데이트에 실패했습니다.';
                                                                setTimeout(() => {
                                                                    message = '';
                                                                }, 3000);
                                                            }
                                                        };
                                                    }}
                                                >
                                                    <input type="hidden" name="userId" value={user?.user_id} />
                                                    <input type="hidden" name="productColumn" value={productColumn} />
                                                    <input 
                                                        type="date" 
                                                        name="newDate"
                                                        value={user?.products?.[productColumn] ? user.products[productColumn].split('T')[0] : ''}
                                                        class="border rounded px-2 py-1 text-sm"
                                                        required
                                                    />
                                                    <button
                                                        type="submit"
                                                        class="bg-green-500 text-white px-2 py-1 rounded text-sm hover:bg-green-600"
                                                    >
                                                        저장
                                                    </button>
                                                    <button
                                                        type="button"
                                                        class="bg-gray-500 text-white px-2 py-1 rounded text-sm hover:bg-gray-600"
                                                        on:click={() => editingDate = null}
                                                    >
                                                        취소
                                                    </button>
                                                </form>
                                            {:else}
                                                <span class="text-gray-600">{formatDate(user?.products?.[productColumn])}</span>
                                                <div class="flex gap-2">
                                                    <button
                                                        class="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600"
                                                        on:click={() => editingDate = `${user?.user_id}-${productColumn}`}
                                                    >
                                                        수정
                                                    </button>
                                                    {#if user?.products?.[productColumn]}
                                                        <form 
                                                            method="POST" 
                                                            action="?/resetDate"
                                                            use:enhance={({ form }) => {
                                                                return async ({ result }) => {
                                                                    if (result.type === 'success') {
                                                                        message = result.data.message;
                                                                        window.location.reload();
                                                                    }
                                                                };
                                                            }}
                                                        >
                                                            <input type="hidden" name="userId" value={user?.user_id} />
                                                            <input type="hidden" name="productColumn" value={productColumn} />
                                                            <button
                                                                type="submit"
                                                                class="bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-600"
                                                            >
                                                                초기화
                                                            </button>
                                                        </form>
                                                    {/if}
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</div>

<style>
    .container {
        max-width: 1200px;
    }
</style>