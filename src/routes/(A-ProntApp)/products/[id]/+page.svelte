<script>
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { supabase } from '$lib/supabase/client';

    const productID = $page.params.id;
    let product = null;
    let isAdmin = false;

    onMount(async () => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError) {
                console.error('세션 에러:', sessionError);
                return;
            }

            const currentUserId = session?.user?.id;

            // 관리자 체크 (비로그인 상태면 건너뜀)
            if (currentUserId) {
                const { data: adminData } = await supabase
                    .from('admin_users')
                    .select('user_id')
                    .eq('user_id', currentUserId);
                isAdmin = Array.isArray(adminData) && adminData.length > 0;
            } else {
                isAdmin = false;
            }

            // 제품 정보 로딩
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', productID)
                .single();

            if (error) {
                console.error('상품 로딩 에러:', error);
                return;
            }

            product = data;
        } catch (error) {
            console.error('오류 발생:', error);
        }
    });

    async function handleDelete() {
        if (confirm('정말로 이 상품을 삭제하시겠습니까?')) {
            try {
                const { error } = await supabase
                    .from('products')
                    .delete()
                    .eq('id', productID);

                if (error) {
                    console.error('삭제 에러:', error);
                    return;
                }

                goto('/products');
            } catch (error) {
                console.error('삭제 중 오류 발생:', error);
            }
        }
    }
</script>

{#if product}
    {#if isAdmin || !['서비스 소개', '포인트 안내', '사용 설명', 'TIP'].includes(product.title)}
        <div class="container">
            <!-- <h1>{product.title}</h1>
            {#if product.image_url}
                <img src={product.image_url} alt={product.title} />
            {/if} -->
            <div class="content ck-content">
                {@html product.content}
            </div>
            
            <div class="actions">
                <a href="/products" class="button">목록으로</a>
                {#if isAdmin}
                    <a href={`/products/${productID}/edit`} class="button edit">수정</a>
                    <button class="delete" on:click={handleDelete}>삭제</button>
                {/if}
            </div>
        </div>
    {:else}
        <p>접근 권한이 없습니다.</p>
    {/if}
{:else}
    <div class="loading-container">
        <div class="spinner"></div>
    </div>
{/if}

<style>
    .container {
        max-width: 800px;
        margin: 0 auto;
        padding: 1rem;
    }

    .content {
        margin: 2rem 0;
    }

    /* CKEditor 컨텐츠 스타일링 */
    :global(.ck-content) {
        /* 기본 텍스트 스타일 */
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
        line-height: 1.6;
        color: #333;
    }

    :global(.ck-content h1) {
        font-size: 2em;
        margin: 1em 0;
    }

    :global(.ck-content h2) {
        font-size: 1.5em;
        margin: 0.83em 0;
    }

    :global(.ck-content h3) {
        font-size: 1.17em;
        margin: 1em 0;
    }

    /* 표 스타일링 */
    :global(.ck-content table) {
        border-collapse: collapse;
        width: 100%;
        margin: 1em 0;
    }

    :global(.ck-content table td, .ck-content table th) {
        border: 1px solid #ddd;
        padding: 8px;
    }

    :global(.ck-content table th) {
        background-color: #f5f5f5;
    }

    /* 이미지 스타일링 */
    :global(.ck-content img) {
        max-width: 100%;
        height: auto;
        margin: 1em 0;
    }

    /* 텍스트 ���렬 */
    :global(.ck-content .text-align-left) {
        text-align: left;
    }

    :global(.ck-content .text-align-center) {
        text-align: center;
    }

    :global(.ck-content .text-align-right) {
        text-align: right;
    }

    :global(.ck-content .text-align-justify) {
        text-align: justify;
    }

    /* 리스트 스타일링 */
    :global(.ck-content ul, .ck-content ol) {
        padding-left: 40px;
        margin: 1em 0;
    }

    :global(.ck-content li) {
        margin: 0.5em 0;
    }

    /* 인용구 스타일링 */
    :global(.ck-content blockquote) {
        margin: 1em 0;
        padding-left: 1em;
        border-left: 4px solid #ddd;
        color: #666;
    }

    /* 코드 블록 스타일링 */
    :global(.ck-content pre) {
        background-color: #f5f5f5;
        padding: 1em;
        border-radius: 4px;
        overflow-x: auto;
    }

    .actions {
        display: flex;
        gap: 1rem;
        margin-top: 2rem;
    }

    .button {
        padding: 0.5rem 1rem;
        text-decoration: none;
        border-radius: 4px;
        color: white;
        background-color: #4CAF50;
    }

    .edit {
        background-color: #2196F3;
    }

    .delete {
        background-color: #f44336;
        border: none;
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
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