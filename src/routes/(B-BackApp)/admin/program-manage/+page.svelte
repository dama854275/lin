<script>
    import { enhance } from '$app/forms';
    import { supabase } from '$lib/supabase/client';
    export let data;
    let message = '';
    let loading = false;
    let editingProduct = null;
    let uploadLoading = {};
    let uploadMessage = {};

    // 버전 데이터 초기화
    let versionData = {};
    $: if (data.versionData) {
        versionData = { ...data.versionData };
    }

    // 버전 수정 함수
    function startEdit(productName) {
        editingProduct = productName;
    }

    // 버전 수정 취소
    function cancelEdit() {
        editingProduct = null;
    }

    // 파일 업로드 함수
    async function handleFileUpload(event, productName) {
        const file = event.target.files[0];
        if (!file) return;

        uploadLoading[productName] = true;
        uploadMessage[productName] = '';

        try {
            const filePath = `products/game/${productName}/${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('products')
                .upload(filePath, file, {
                    upsert: true
                });

            if (uploadError) {
                throw uploadError;
            }

            uploadMessage[productName] = '파일이 성공적으로 업로드되었습니다.';
            setTimeout(() => {
                uploadMessage[productName] = '';
            }, 3000);
        } catch (error) {
            console.error('파일 업로드 오류:', error);
            uploadMessage[productName] = '파일 업로드에 실패했습니다.';
        } finally {
            uploadLoading[productName] = false;
            // 파일 입력 초기화
            event.target.value = '';
        }
    }
</script>

<div class="container mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-6">프로그램 버전 관리</h1>

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

    <!-- 버전 관리 테이블 -->
    <div class="bg-white rounded-lg shadow overflow-hidden mb-8">
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        상품명
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        버전
                    </th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        작업
                    </th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                {#each data.products as product}
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {product.product_name2}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {#if editingProduct === product.product_name2}
                                <form 
                                    method="POST" 
                                    action="?/update"
                                    class="flex items-center space-x-2"
                                    use:enhance={({ formElement }) => {
                                        loading = true;
                                        return async ({ result }) => {
                                            loading = false;
                                            if (result.type === 'success') {
                                                message = result.data.message;
                                                editingProduct = null;
                                                // 데이터 새로고침
                                                window.location.reload();
                                            } else {
                                                message = result.data?.error || '업데이트에 실패했습니다.';
                                                setTimeout(() => {
                                                    message = '';
                                                }, 3000);
                                            }
                                        };
                                    }}
                                >
                                    <input type="hidden" name="productName" value={product.product_name2} />
                                    <input
                                        type="text"
                                        name="version"
                                        value={versionData[product.product_name2] || ''}
                                        class="border rounded px-2 py-1 text-sm w-32"
                                        placeholder="예: 1.0.0"
                                        required
                                    />
                                    <button
                                        type="submit"
                                        class="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600"
                                        disabled={loading}
                                    >
                                        저장
                                    </button>
                                    <button
                                        type="button"
                                        class="bg-gray-500 text-white px-2 py-1 rounded text-sm hover:bg-gray-600"
                                        on:click={cancelEdit}
                                    >
                                        취소
                                    </button>
                                </form>
                            {:else}
                                <span class="text-gray-900">{versionData[product.product_name2] || '버전 없음'}</span>
                            {/if}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {#if editingProduct !== product.product_name2}
                                <button
                                    class="text-blue-600 hover:text-blue-900"
                                    on:click={() => startEdit(product.product_name2)}
                                >
                                    수정
                                </button>
                            {/if}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>

    <!-- 파일 업로드 섹션 -->
    <h2 class="text-xl font-bold mb-4">프로그램 파일 관리</h2>
    <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        상품명
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        파일 업로드
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        상태
                    </th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                {#each data.products as product}
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {product.product_name2}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div class="flex items-center space-x-2">
                                <input
                                    type="file"
                                    class="text-sm text-gray-500
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-blue-50 file:text-blue-700
                                        hover:file:bg-blue-100"
                                    on:change={(e) => handleFileUpload(e, product.product_name2)}
                                    disabled={uploadLoading[product.product_name2]}
                                />
                            </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {#if uploadLoading[product.product_name2]}
                                <span class="text-blue-600">업로드 중...</span>
                            {:else if uploadMessage[product.product_name2]}
                                <span class={uploadMessage[product.product_name2].includes('성공') ? 'text-green-600' : 'text-red-600'}>
                                    {uploadMessage[product.product_name2]}
                                </span>
                            {/if}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</div> 