<script>
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase/client';

    let products = [];
    let isAdmin = false;
    let loading = true;
    let session = null;

    onMount(async () => {
        try {
            // 현재 로그인한 사용자 세션 가져오기
            const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError) {
                console.error('세션 에러:', sessionError);
                return;
            }

            session = currentSession;
            const currentUserId = session?.user?.id;

            // 관리자 체크 (로그아웃 상태면 건너뜀)
            if (currentUserId) {
                const { data: adminData } = await supabase
                    .from('admin_users')
                    .select('user_id')
                    .eq('user_id', currentUserId);
                isAdmin = Array.isArray(adminData) && adminData.length > 0;
            } else {
                isAdmin = false;
            }

            // 제품 목록 로딩
            const { data, error } = await supabase
                .from('products')
                .select('*');

            if (error) {
                console.error('상품 목록 로딩 에러:', error);
                return;
            }

            // 관리자만 볼 수 있는 제품 필터링
            products = data.filter(product => 
                isAdmin || !['서비스 소개', '포인트 안내', '사용 설명', 'TIP'].includes(product.title)
            );
        } catch (error) {
            console.error('오류 발생:', error);
        } finally {
            loading = false;
        }
    });

    async function handleDelete(id) {
        if (!confirm('정말 삭제하시겠습니까?')) return;

        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', id);

            if (error) throw error;

            products = products.filter(product => product.id !== id);
        } catch (error) {
            console.error('제품 삭제 실패:', error);
            alert('제품 삭제에 실패했습니다.');
        }
    }

    function handleProductClick(productId) {
        window.location.href = `/products/${productId}`;
    }

    // 그리드 레이아웃에서 좌측 상단부터 우측 하단으로 순차적 애니메이션을 위한 지연 시간 계산
    function getAnimationDelay(index) {
        // 그리드 컬럼 수 (반응형이므로 대략적인 값 사용)
        const columns = Math.floor(window.innerWidth / 320); // minmax(280px, 1fr) + gap 고려
        const row = Math.floor(index / columns);
        const col = index % columns;
        
        // 좌측 상단부터 우측 하단으로 순차적으로 나타나도록 지연 시간 계산
        return (row * columns + col) * 0.05;
    }
</script>

<div class="content-container">
    
    <div class="bg-image"></div>
    <div class="content-wrapper">
        <div class="container">
            {#if loading}
                <div class="tamagotchi-loader">
                    <div class="tamagotchi-screen loader-screen">
                        <div class="spinner"></div>
                        <p>로딩중...</p>
                    </div>
                    <div class="tamagotchi-buttons">
                        <div class="button"></div>
                        <div class="button"></div>
                        <div class="button"></div>
                    </div>
                </div>
            {:else}
                <div class="header">
                    <div class="actions">
                        {#if isAdmin}
                            <a href="/products/new" class="btn-primary">새 상품 추가</a>
                        {/if}
                    </div>
                </div>

                <div class="products-grid">
                    {#each products as product, index (product.id)}
                        <div
                            class="tamagotchi-product animate-slide-in"
                            style="animation-delay: {getAnimationDelay(index)}s;"
                            on:click={() => handleProductClick(product.id)}
                            on:keydown={e => e.key === 'Enter' && handleProductClick(product.id)}
                            role="button"
                            tabindex="0"
                        >
                            <div class="tamagotchi-screen product-screen">
                                <h2>{product.title}</h2>
                                {#if product.image_url}
                                    <div class="image-container">
                                        <img src={product.image_url} alt={product.title} />
                                    </div>
                                {:else}
                                    <div class="no-image">이미지 없음</div>
                                {/if}
                            </div>
                            <div class="tamagotchi-buttons">
                                <div class="button"></div>
                                <div class="button"></div>
                                <div class="button"></div>
                            </div>
                            {#if isAdmin}
                                <div class="admin-actions">
                                    <a href={`/products/${product.id}/edit`} class="btn-edit" on:click|stopPropagation>수정</a>
                                    <button class="btn-delete" on:click|stopPropagation={() => handleDelete(product.id)}>삭제</button>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</div>

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
    
    /* 전체 컨테이너 */
    .content-container {
        width: 100%;
        padding-top: 60px; /* 네비게이션 높이만큼 패딩 추가 */
        min-height: 100vh;
        position: relative;
    }
    
    /* 배경 이미지 설정 */
    .bg-image {
        position: fixed;
        top: 60px; /* 네비게이션 높이와 동일하게 설정 */
        left: 0;
        right: 0;
        bottom: 0;
        background-image: url('/back.png');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        z-index: 0;
    }
    
    /* 콘텐츠 래퍼 */
    .content-wrapper {
        position: relative;
        width: 100%;
        min-height: calc(100vh - 60px);
        background-color: rgba(255, 255, 255, 0.4);
        z-index: 1;
    }

    /* 전역 폰트 적용 */
    .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 1rem;
        font-family: 'NeoDunggeunmo', sans-serif;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
    }

    .products-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 2rem;
    }

    /* 다마고치 스타일 상품 카드 */
    .tamagotchi-product {
        position: relative;
        width: 100%;
        background-color: #ffd3e1;
        border-radius: 50px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15);
        transition: all 0.3s;
        border: 8px solid #ff9dbd;
        cursor: pointer;
        opacity: 0;
        transform: translateY(40px) scale(0.8);
        animation-fill-mode: forwards;
    }

    .tamagotchi-product:nth-child(3n+1) {
        background-color: #d3e0ff;
        border-color: #9db5fd;
    }

    .tamagotchi-product:nth-child(3n+2) {
        background-color: #ffd3e1;
        border-color: #ff9dbd;
    }

    .tamagotchi-product:nth-child(3n+3) {
        background-color: #d3ffe0;
        border-color: #9dfdbf;
    }

    .tamagotchi-product:hover {
        transform: translateY(-5px);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    }

    .product-screen {
        aspect-ratio: 4/3;
        position: relative;
    }

    .tamagotchi-screen {
        width: 90%;
        background-image: radial-gradient(#e0e0e0 1px, transparent 1px);
        background-size: 10px 10px;
        background-color: rgba(255, 255, 255, 0.9);
        border-radius: 10px;
        padding: 15px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        margin-bottom: 15px;
        box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.1);
        border: 3px solid #dddddd;
    }

    .tamagotchi-buttons {
        display: flex;
        gap: 15px;
        margin-top: 5px;
    }

    .tamagotchi-buttons .button {
        width: 20px;
        height: 20px;
        background-color: #6dbbc9;
        border-radius: 50%;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        border: 2px solid #5aaab8;
        cursor: pointer;
    }

    .tamagotchi-buttons .button:hover {
        background-color: #5aaab8;
    }

    .tamagotchi-buttons .button:active {
        transform: scale(0.9);
        background-color: #4a99a7;
    }

    .tamagotchi-product h2 {
        font-size: 1.4rem;
        font-weight: bold;
        margin-bottom: 1rem;
        color: #3a4566;
        letter-spacing: 0.5px;
    }

    .image-container {
        width: 70%;
        aspect-ratio: 1/1;
        overflow: hidden;
        border-radius: 8px;
        border: 2px solid #e2e8f0;
    }

    .tamagotchi-product img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .no-image {
        width: 70%;
        aspect-ratio: 1/1;
        background: rgba(214, 222, 255, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #6c84e0;
        border-radius: 8px;
        font-size: 1.1rem;
        border: 2px dashed #b0c4ff;
    }

    .admin-actions {
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin-top: 1rem;
        width: 100%;
    }

    .btn-primary, .btn-edit, .btn-delete {
        padding: 0.5rem 1rem;
        text-decoration: none;
        border-radius: 0.5rem;
        cursor: pointer;
        font-size: 0.9rem;
        border: none;
        font-family: 'NeoDunggeunmo', sans-serif;
        letter-spacing: 0.5px;
        transition: all 0.2s;
        color: white;
        /* 모서리가 둥글면서 각진 형태 */
        clip-path: polygon(
            0% 10%, 4% 0%, 96% 0%, 100% 10%,
            100% 90%, 96% 100%, 4% 100%, 0% 90%
        );
    }

    .btn-primary {
        background-color: #9db5fd;
    }

    .btn-primary:hover {
        background-color: #7b93fb;
        transform: translateY(-2px);
    }

    .btn-edit {
        background-color: #9db5fd;
    }

    .btn-edit:hover {
        background-color: #7b93fb;
        transform: translateY(-2px);
    }

    .btn-delete {
        background-color: #fd9d9d;
    }

    .btn-delete:hover {
        background-color: #fb7b7b;
        transform: translateY(-2px);
    }

    /* 로딩 다마고치 */
    .tamagotchi-loader {
        position: relative;
        width: 100%;
        max-width: 300px;
        margin: 5rem auto;
        background-color: #d3e0ff;
        border-radius: 50px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15);
        border: 8px solid #9db5fd;
    }

    .loader-screen {
        aspect-ratio: 1/1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    .spinner {
        width: 50px;
        height: 50px;
        border: 5px solid #d6deff;
        border-top: 5px solid #7b93fb;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 10px;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    

    /* 상품 카드 순차 등장 애니메이션 */
    @keyframes slideInUp {
        0% {
            opacity: 0;
            transform: translateY(40px) scale(0.8);
        }
        60% {
            opacity: 0.8;
            transform: translateY(-8px) scale(1.05);
        }
        100% {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }

    .animate-slide-in {
        animation: slideInUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    }

	/* 모바일에서도 3열 그리드 유지 */
	@media (max-width: 640px) {
		.products-grid {
			grid-template-columns: repeat(3, 1fr);
			gap: 0.75rem;
		}

		/* 카드가 그리드 셀을 꽉 채우도록 */
		.tamagotchi-product {
			width: 100%;
			padding: 12px;
			border-radius: 30px;
		}

		/* 내부 화면과 이미지도 좁은 칸에 맞춤 */
		.tamagotchi-screen {
			width: 100%;
			padding: 10px;
		}

		.image-container,
		.no-image {
			width: 100%;
		}

		.tamagotchi-product h2 {
			font-size: 1rem;
			margin-bottom: 0.5rem;
		}
	}
</style>
