<script>
    import { user } from '$lib/stores/auth';
    import { supabase } from '$lib/supabase/client';
    import { goto, beforeNavigate } from '$app/navigation';
    import { points } from '$lib/stores/points';
    import { onMount, onDestroy } from 'svelte';
    import { fade } from 'svelte/transition';

    // 서버에서 미리 로드한 데이터를 받습니다
    export let data;
    let products = data.products;
    let error = null;
    let successMessage = null;
    let activeProductsCount = 0;
    let isProcessing = false;
    let toastMessage = null;
    let toastTimeout = null;
    let showDiscountModal = false;
    let showAuthModal = false;
    
    // 토스트 메시지 표시 함수
    function showToast(message) {
        // console.log('showToast 호출됨:', message);
        
        // 이전 타이머가 있다면 제거
        if (toastTimeout) {
            clearTimeout(toastTimeout);
            toastTimeout = null;
        }
        
        // 메시지 설정
        toastMessage = message;
        // console.log('toastMessage 설정됨:', toastMessage);
        
        // 새로운 타이머 설정 (5초로 늘림)
        toastTimeout = setTimeout(() => {
            // console.log('토스트 타이머 만료, 메시지 제거');
            toastMessage = null;
            toastTimeout = null;
        }, 5000);
    }

    // 컴포넌트가 제거될 때 타이머 정리
    onDestroy(() => {
        if (toastTimeout) {
            clearTimeout(toastTimeout);
            toastTimeout = null;
        }
    });

    // points store 구독
    $: userPoints = $points;

    // 할인율 계산
    $: discountRate = activeProductsCount === 1 ? 0.05 : 
                     activeProductsCount === 2 ? 0.10 : 
                     activeProductsCount >= 3 ? 0.15 : 0;

    // 다음 할인 단계 안내 메시지 생성
    function getNextDiscountMessage() {
        if (activeProductsCount === 0) {
            return "다음 상품 구매 시 전체 상품 5% 할인!";
        } else if (activeProductsCount === 1) {
            return "다음 상품 구매 시 전체 상품 10% 할인!";
        } else if (activeProductsCount === 2) {
            return "다음 상품 구매 시 전체 상품 15% 할인!";
        } else {
            return "최대 할인율(15%) 적용 중";
        }
    }

    // 할인된 포인트 계산 함수
    function calculateDiscountedPoints(originalPoints) {
        return Math.floor(originalPoints * (1 - discountRate));
    }

    // 활성화된 상품 개수 계산 함수
    async function countActiveProducts() {
        if (!$user) return;
        
        try {
            const { data: profileData, error: profileError } = await supabase
                .from('user_info')
                .select('*')
                .eq('user_id', $user.id)
                .single();

            if (profileError) throw profileError;

            // 현재 날짜보다 만료일이 늦은 상품 개수 계산
            activeProductsCount = Object.entries(profileData)
                .filter(([key, value]) => 
                    key.startsWith('product_') && 
                    value && 
                    new Date(value) > new Date()
                ).length;

        } catch (err) {
            // console.error('Error counting active products:', err);
        }
    }

    // 페이지 진입 시 로그인 체크 및 포인트 정보 로드
    onMount(() => {
        if (!$user) {
            showAuthModal = true;
            return;
        }
        if (!points.isInitialized()) {
            points.fetch();
        }
        countActiveProducts();
    });

    // 모달이 떠 있는 동안 라우팅을 차단
    beforeNavigate((nav) => {
        if (showAuthModal) {
            nav.cancel();
        }
    });

    // 구매 처리 함수는 동일하게 유지
    async function handlePurchase(product) {
        if (!$user) {
            error = '로그인이 필요합니다.';
            return;
        }

        isProcessing = true;
        error = null;

        try {
            // 할인된 가격 계산
            const discountedPoints = calculateDiscountedPoints(product.required_points);

            if (userPoints < discountedPoints) {
                error = '포인트가 부족합니다.';
                return;
            }

            const isConfirmed = confirm(`${product.product_name}을(를) 구매하시겠습니까?\n\n할인 적용 후: ${discountedPoints.toLocaleString()}P`);
            if (!isConfirmed) {
                isProcessing = false;
                return;
            }

            // 현재 사용자 정보 조회
            const { data: currentUser, error: fetchError } = await supabase
                .from('user_info')
                .select('*')
                .eq('user_id', $user.id)
                .single();

            if (fetchError) throw fetchError;

            // product_name2 값이 있는지 확인
            if (!product.product_name2) {
                error = '상품 정보가 올바르지 않습니다.';
                return;
            }

            // Supabase 함수 호출로 구매 처리
            const formData = new FormData();
            formData.append('userId', $user.id);
            formData.append('productName2', product.product_name2);
            formData.append('requiredPoints', discountedPoints); // 할인된 가격 적용
            formData.append('productName', product.product_name);

            // console.log('구매 처리 요청 데이터:', {
            //     userId: $user.id,
            //     productName2: product.product_name2,
            //     requiredPoints: discountedPoints, // 할인된 가격 적용
            //     productName: product.product_name
            // });

            const response = await fetch('?/purchaseProduct', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            // console.log('구매 처리 응답:', result);

            // 응답 데이터 파싱
            let parsedData;
            try {
                parsedData = JSON.parse(result.data);
                // console.log('파싱된 데이터:', parsedData);
            } catch (parseError) {
                // console.error('응답 데이터 파싱 오류:', parseError);
                error = '응답 데이터 처리 중 오류가 발생했습니다.';
                return;
            }

            // 성공 여부 확인
            if (!parsedData || !parsedData[0] || !parsedData[0].success) {
                // console.error('구매 처리 실패:', parsedData);
                error = '구매 처리 중 오류가 발생했습니다.';
                return;
            }

            // points store 업데이트
            await points.fetch();
            
            // 활성화된 상품 개수 업데이트
            await countActiveProducts();
            
            error = null;
            successMessage = `구매 완료!\n구매한 상품의 다운로드는 '마이페이지'에서 가능합니다.\n${getNextDiscountMessage()}`;

        } catch (err) {
            // console.error('구매 처리 중 오류:', err);
            error = '구매 처리 중 오류가 발생했습니다. 다시 시도해주세요.';
        } finally {
            isProcessing = false;
        }
    }

    // 새로운 상태 변수 추가
    let isGiftMode = false;
    let receiverEmail = '';
    let giftError = null;

    // 그리드 레이아웃에서 좌측 상단부터 우측 하단으로 순차적 애니메이션을 위한 지연 시간 계산
    function getAnimationDelay(index) {
        // 그리드 컬럼 수 (반응형이므로 대략적인 값 사용)
        const columns = Math.floor(window.innerWidth / 320); // minmax(280px, 1fr) + gap 고려
        const row = Math.floor(index / columns);
        const col = index % columns;
        
        // 좌측 상단부터 우측 하단으로 순차적으로 나타나도록 지연 시간 계산
        return (row * columns + col) * 0.05;
    }

    // 선물하기 함수
    async function handleGift(product) {
        if (!$user) {
            error = '로그인이 필요합니다.';
            return;
        }

        isProcessing = true;
        error = null;
        giftError = null;

        try {
            // 할인된 가격 계산
            const discountedPoints = calculateDiscountedPoints(product.required_points);

            if (userPoints < discountedPoints) {
                error = '포인트가 부족합니다.';
                return;
            }

            if (!receiverEmail) {
                giftError = '받는 사람의 이메일을 입력해주세요.';
                return;
            }

            // 1. 받는 사람 정보 확인
            const { data: receiverData, error: receiverError } = await supabase
                .from('user_info')
                .select('*')
                .eq('email', receiverEmail)
                .single();

            if (receiverError || !receiverData) {
                giftError = '존재하지 않는 사용자입니다.';
                return;
            }

            if (receiverData.user_id === $user.id) {
                giftError = '자신에게는 선물할 수 없습니다.';
                return;
            }

            const isConfirmed = confirm(`${receiverEmail}님에게 ${product.product_name}을(를) 선물하시겠습니까?\n\n할인 적용 후: ${discountedPoints.toLocaleString()}P`);
            if (!isConfirmed) return;

            // 선물 처리
            const formData = new FormData();
            formData.append('senderId', $user.id);
            formData.append('receiverId', receiverData.user_id);
            formData.append('productName2', product.product_name2);
            formData.append('requiredPoints', discountedPoints); // 할인된 가격 적용
            formData.append('productName', product.product_name);

            // console.log('선물 처리 요청 데이터:', {
            //     senderId: $user.id,
            //     receiverId: receiverData.user_id,
            //     productName2: product.product_name2,
            //     requiredPoints: discountedPoints, // 할인된 가격 적용
            //     productName: product.product_name
            // });

            const response = await fetch('?/giftProduct', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            // console.log('선물 처리 응답:', result);

            // 응답 데이터 파싱
            let parsedData;
            try {
                parsedData = JSON.parse(result.data);
                // console.log('파싱된 데이터:', parsedData);
            } catch (parseError) {
                // console.error('응답 데이터 파싱 오류:', parseError);
                throw new Error('응답 데이터 처리 중 오류가 발생했습니다.');
            }

            // 성공 여부 확인
            if (!parsedData || !parsedData[0] || !parsedData[0].success) {
                // console.error('선물 처리 실패:', parsedData);
                throw new Error('선물 처리 중 오류가 발생했습니다.');
            }

            // points store 업데이트
            await points.fetch();
            
            // 활성화된 상품 개수 업데이트
            await countActiveProducts();
            
            successMessage = `선물하기 완료! ${getNextDiscountMessage()}`;
            isGiftMode = false;
            receiverEmail = '';
            error = null;
            giftError = null;
            
        } catch (err) {
            // console.error('선물하기 처리 중 오류:', err);
            error = '선물하기 처리 중 오류가 발생했습니다. 다시 시도해주세요.';
        } finally {
            isProcessing = false;
        }
    }
</script>

<div class="content-container">
    <div class="bg-image"></div>
    <div class="content-wrapper">
        <div class="container">
            <div class="header">
                <div class="header-top">
                    <h1 class="page-title">상품 구매</h1>
                    <div class="download-info-container">
                        <div class="download-info-text">
                            📥 상품 다운로드는 우측 상단 <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                            </svg> 아이콘 ▷ 마이페이지
                        </div>
                    </div>
                </div>
                <div class="points-display">
                    <button class="discount-info-btn" on:click={() => showDiscountModal = true}>
                        할인 안내
                    </button>
                    <div class="active-products">
                        <span class="active-products-label">활성화된 상품:</span>
                        <span class="active-products-value">{activeProductsCount}개</span>
                        {#if discountRate > 0}
                            <span class="discount-badge">-{discountRate * 100}% 할인</span>
                        {/if}
                    </div>
                    <span class="points-label">보유 포인트:</span>
                    <span class="points-value">{userPoints.toLocaleString()} P</span>
                </div>
            </div>

            {#if showDiscountModal}
                <div class="modal-backdrop" on:click={() => showDiscountModal = false}>
                    <div class="modal-content" on:click|stopPropagation>
                        <div class="modal-header">
                            <h2>할인 안내</h2>
                            <button class="close-btn" on:click={() => showDiscountModal = false}>×</button>
                        </div>
                        <div class="modal-body">
                            <div class="discount-info-item">
                                <span class="discount-count">기간이 활성화된 상품 1개</span>
                                <span class="discount-rate">전체 상품 5% 할인</span>
                            </div>
                            <div class="discount-info-item">
                                <span class="discount-count">기간이 활성화된 상품 2개</span>
                                <span class="discount-rate">전체 상품 10% 할인</span>
                            </div>
                            <div class="discount-info-item">
                                <span class="discount-count">기간이 활성화된 상품 3개 이상</span>
                                <span class="discount-rate">전체 상품 15% 할인</span>
                            </div>
                            <div class="current-discount">
                                <p>현재 적용 중인 할인율: <span class="highlight">{discountRate * 100}%</span></p>
                                <p>활성화된 상품: <span class="highlight">{activeProductsCount}개</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            {/if}

            {#if error}
                <div class="error-message">
                    {error}
                </div>
            {/if}

            {#if successMessage}
                <div class="success-message">
                    {#each successMessage.split('\n') as line}
                        <p>{line}</p>
                    {/each}
                </div>
            {/if}

            {#if showAuthModal}
                <div class="modal-backdrop">
                    <div class="modal-content" on:click|stopPropagation>
                        <div class="modal-header">
                            <h2>접근 제한</h2>
                            <button class="close-btn" on:click={() => showAuthModal = false}>×</button>
                        </div>
                        <div class="modal-body">
                            <p style="text-align:center; line-height:1.6;">
                                로그인이 필요한 페이지입니다.<br/>
                            </p>
                            <div style="display:flex; justify-content:center; gap:0.5rem; margin-top:1rem;">
                                <button class="btn-primary" on:click={() => showAuthModal = false}>확인</button>
                            </div>
                        </div>
                    </div>
                </div>
            {/if}

            <div class="products-grid">
                {#if products.length === 0}
                    <div class="tamagotchi-product">
                        <div class="tamagotchi-screen">
                            <p>등록된 상품이 없습니다.</p>
                        </div>
                        <div class="tamagotchi-buttons">
                            <div class="button"></div>
                            <div class="button"></div>
                            <div class="button"></div>
                        </div>
                    </div>
                {:else}
                    {#each products as product, index}
                        <div 
                            class="tamagotchi-product animate-slide-in"
                            style="animation-delay: {getAnimationDelay(index)}s;"
                        >
                            <div class="tamagotchi-screen">
                                <h2>{product.product_name}</h2>
                                <div class="product-info">
                                    {#if product.required_points === 0}
                                        <div class="event-price">
                                            <span class="event-badge">이벤트</span>
                                            <p class="points event">무료</p>
                                        </div>
                                    {:else if discountRate > 0}
                                        <div class="price-container">
                                            <p class="original-points">
                                                <span class="original-price">{product.required_points.toLocaleString()}P</span>
                                                <span class="discount-arrow">↓</span>
                                            </p>
                                            <p class="points discounted">
                                                {calculateDiscountedPoints(product.required_points).toLocaleString()}P
                                            </p>
                                        </div>
                                    {:else}
                                        <p class="points">{product.required_points.toLocaleString()}P</p>
                                    {/if}
                                    <p class="description">{product.description}</p>
                                </div>
                                {#if isGiftMode}
                                    <div class="gift-form">
                                        <input
                                            type="email"
                                            placeholder="받는 사람 이메일"
                                            bind:value={receiverEmail}
                                            class="gift-input"
                                        />
                                        {#if giftError}
                                            <p class="gift-error">{giftError}</p>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                            <div class="tamagotchi-buttons">
                                <div class="button"></div>
                                <div class="button"></div>
                                <div class="button"></div>
                            </div>
                            <div class="action-buttons">
                                {#if isGiftMode}
                                    <button
                                        class="btn-primary gift-btn"
                                        disabled={userPoints < calculateDiscountedPoints(product.required_points) || !$user || isProcessing}
                                        on:click={() => handleGift(product)}
                                    >
                                        {isProcessing ? '처리 중...' : '선물'}
                                    </button>
                                    <button
                                        class="btn-secondary"
                                        disabled={isProcessing}
                                        on:click={() => {
                                            isGiftMode = false;
                                            receiverEmail = '';
                                            giftError = null;
                                        }}
                                    >
                                        취소
                                    </button>
                                {:else}
                                    <button
                                        class="btn-primary"
                                        disabled={userPoints < calculateDiscountedPoints(product.required_points) || !$user || isProcessing}
                                        on:click={() => handlePurchase(product)}
                                    >
                                        {isProcessing ? '처리 중...' : '구매'}
                                    </button>
                                    <button
                                        class="btn-secondary"
                                        disabled={userPoints < calculateDiscountedPoints(product.required_points) || !$user || isProcessing}
                                        on:click={() => isGiftMode = true}
                                    >
                                        선물
                                    </button>
                                {/if}
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>
        </div>
    </div>
</div>

<!-- 토스트 메시지 -->
{#if toastMessage}
    <div class="toast-message" in:fade={{ duration: 300 }} out:fade={{ duration: 300 }}>
        <button class="toast-close-btn" on:click={() => {
            toastMessage = null;
            if (toastTimeout) {
                clearTimeout(toastTimeout);
                toastTimeout = null;
            }
        }}>×</button>
        {#each toastMessage.split('\n') as line}
            <p>{line}</p>
        {/each}
    </div>
{/if}

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
        padding-top: 60px;
        min-height: 100vh;
        position: relative;
    }
    
    /* 배경 이미지 설정 */
    .bg-image {
        position: fixed;
        top: 60px;
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

    .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 1rem;
        font-family: 'NeoDunggeunmo', sans-serif;
    }

    .header {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        margin-bottom: 2rem;
    }

    .header-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 2rem;
    }

    .page-title {
        font-size: clamp(1.4rem, 6vw, 3rem);
        color: #3a4566;
        font-weight: bold;
    }

    /* 다운로드 안내 텍스트 */
    .download-info-text {
        background-color: rgba(255, 255, 255, 0.9);
        padding: 0.8rem 1.5rem;
        border-radius: 8px;
        font-size: clamp(0.8rem, 2.8vw, 1.1rem);
        color: #3a4566;
        font-weight: bold;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        border: 1px solid #e2e8f0;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 0.3rem;
    }

    .download-info-text svg {
        width: 1.2rem;
        height: 1.2rem;
        color: #3a4566;
        vertical-align: middle;
    }

    .discount-info-btn {
        background-color: #4CAF50;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        cursor: pointer;
        font-size: 1rem;
        transition: background-color 0.2s;
    }

    .discount-info-btn:hover {
        background-color: #45a049;
    }

    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .modal-content {
        background-color: white;
        border-radius: 12px;
        padding: 2rem;
        width: 90%;
        max-width: 500px;
        position: relative;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    .modal-header h2 {
        margin: 0;
        color: #333;
        font-size: 1.5rem;
    }

    .close-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #666;
        padding: 0.5rem;
    }

    .modal-body {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .discount-info-item {
        display: flex;
        justify-content: space-between;
        padding: 1rem;
        background-color: #f5f5f5;
        border-radius: 8px;
    }

    .discount-count {
        font-weight: bold;
        color: #333;
    }

    .discount-rate {
        color: #4CAF50;
        font-weight: bold;
    }

    .current-discount {
        margin-top: 1rem;
        padding: 1rem;
        background-color: #e8f5e9;
        border-radius: 8px;
        text-align: center;
    }

    .current-discount p {
        margin: 0.5rem 0;
        color: #333;
    }

    .highlight {
        color: #4CAF50;
        font-weight: bold;
    }

    .points-display {
        background: rgba(255, 255, 255, 0.9);
        padding: 1rem 2rem;
        border-radius: 20px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        gap: 1.5rem;
        margin-left: auto;
        width: fit-content;
    }

    .active-products {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding-right: 1.5rem;
        border-right: 2px solid #e0e0e0;
    }

    .active-products-label {
        color: #3a4566;
        font-size: 1.3rem;
    }

    .active-products-value {
        color: #4CAF50;
        font-weight: 800;
        font-size: 1.5rem;
        font-family: initial;
    }

    .points-label {
        color: #3a4566;
        font-size: 1.3rem;
    }

    .points-value {
        color: #ff6b6b;
        font-weight: 800;
        font-size: 1.5rem;
        font-family: initial;
    }

    .error-message {
        background-color: #ffebee;
        color: #c62828;
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        text-align: center;
    }

    .success-message {
        background-color: #e8f5e9;
        color: #2e7d32;
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        text-align: center;
        border: 1px solid #4caf50;
    }

    .success-message p {
        margin: 0.3rem 0;
        font-size: 1.1rem;
        line-height: 1.4;
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
    }

    .tamagotchi-buttons .button:hover {
        background-color: #5aaab8;
    }

    .tamagotchi-buttons .button:active {
        transform: scale(0.9);
        background-color: #4a99a7;
    }

    .tamagotchi-screen h2 {
        font-size: clamp(1rem, 3.5vw, 1.6rem);
        color: #3a4566;
        font-weight: bold;
        margin-bottom: 0.1rem;
        letter-spacing: 0.5px;
    }

    .product-info {
        margin: 1.5rem 0;
    }

    .points {
        color: #3b3b3b;
        font-weight: bold;
        margin-bottom: 0.8rem;
        font-size: clamp(1rem, 4vw, 2rem);
    }

    .description {
        color: #3a4566;
        font-size: clamp(0.8rem, 3.2vw, 1.4rem);
        font-weight: bold;
    }

    .gift-form {
        width: 100%;
        margin-top: 1rem;
    }

    .gift-input {
        width: 100%;
        padding: 0.5rem;
        border: 2px solid #9db5fd;
        border-radius: 8px;
        margin-bottom: 0.5rem;
        font-family: 'NeoDunggeunmo', sans-serif;
    }

    .gift-error {
        color: #ff6b6b;
        font-size: 0.8rem;
    }

    .action-buttons {
        display: flex;
        gap: 1rem;
        margin-top: 1rem;
        width: 100%;
        justify-content: center;
    }

    .btn-primary, .btn-secondary {
        padding: 0.5rem 1rem;
        text-decoration: none;
        border-radius: 0.5rem;
        cursor: pointer;
        font-size: clamp(0.7rem, 4vw, 1.2rem);
        border: none;
        font-family: 'NeoDunggeunmo', sans-serif;
        letter-spacing: 0.5px;
        transition: all 0.2s;
        color: white;
        clip-path: polygon(
            0% 10%, 4% 0%, 96% 0%, 100% 10%,
            100% 90%, 96% 100%, 4% 100%, 0% 90%
        );
    }

    .btn-primary {
        background-color: #7b93fb;
    }

    .btn-primary:hover:not(:disabled) {
        background-color: #5a72e9;
        transform: translateY(-2px) scale(1.05);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }

    .btn-secondary {
        background-color: #ff7ba7;
    }

    .btn-secondary:hover:not(:disabled) {
        background-color: #ff5a8f;
        transform: translateY(-2px) scale(1.05);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }

    .btn-primary:disabled, .btn-secondary:disabled {
        background-color: #cccccc;
        cursor: not-allowed;
        transform: none;
    }

    .discount-badge {
        background-color: #4CAF50;
        color: white;
        padding: 0.2rem 0.5rem;
        border-radius: 12px;
        font-size: clamp(0.7rem, 2.5vw, 0.9rem);
        font-weight: bold;
    }

    .price-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.2rem;
    }

    .original-points {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #999;
        font-size: clamp(0.8rem, 2.8vw, 1.2rem);
    }

    .original-price {
        text-decoration: line-through;
    }

    .discount-arrow {
        color: #4CAF50;
        font-weight: bold;
    }

    .points.discounted {
        color: #4CAF50;
        font-size: clamp(1.1rem, 4.2vw, 2rem);
        font-weight: bold;
    }

    .event-price {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
    }

    .event-badge {
        background: linear-gradient(45deg, #ff6b6b, #ff8e8e);
        color: white;
        padding: 0.3rem 0.8rem;
        border-radius: 20px;
        font-size: clamp(0.7rem, 2.5vw, 0.9rem);
        font-weight: bold;
        box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
        animation: pulse 2s infinite;
    }

    .points.event {
        color: #ff6b6b;
        font-size: clamp(1.2rem, 4.5vw, 2.2rem);
        font-weight: bold;
        text-shadow: 2px 2px 4px rgba(255, 107, 107, 0.2);
    }

    @keyframes pulse {
        0% {
            transform: scale(1);
        }
        50% {
            transform: scale(1.05);
        }
        100% {
            transform: scale(1);
        }
    }

    /* 토스트 메시지 스타일 */
    .toast-message {
        position: fixed;
        top: 70px;
        right: 20px;
        background-color: #4CAF50;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
        position: relative;
        max-width: 400px;
    }

    .toast-close-btn {
        position: absolute;
        top: 5px;
        right: 10px;
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s;
    }

    .toast-close-btn:hover {
        background-color: rgba(255, 255, 255, 0.2);
    }

    .toast-message p {
        margin: 5px 0;
        font-size: 1.1rem;
        line-height: 1.4;
        padding-right: 20px;
    }

    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes fade {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
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

    /* 반응형 디자인 */
    /* 모바일에서도 3열 그리드 유지 및 카드/텍스트 축소 */
    @media (max-width: 640px) {
        .products-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 0.75rem;
        }

        .tamagotchi-product {
            width: 100%;
            padding: 12px;
            border-radius: 30px;
        }

        .tamagotchi-screen {
            width: 100%;
            padding: 10px;
        }

        .tamagotchi-screen h2 {
            font-size: 1rem;
            margin-bottom: 0.25rem;
        }

        .product-info {
            margin: 0.75rem 0;
        }

        .points {
            font-size: 1.2rem;
        }

        .points.discounted {
            font-size: 1.3rem;
        }

        /* 헤더 포인트 영역을 2줄(Grid)로 배치 */
        .points-display {
            display: grid;
            grid-template-columns: auto 1fr;
            column-gap: 0.75rem;
            row-gap: 0.4rem;
            justify-items: center;
            align-items: center;
            padding: 0.75rem 1rem;
            width: 100%;
        }

        /* 1행: 할인 안내 버튼(좌), 활성화된 상품(우) */
        .discount-info-btn {
            justify-self: start;
        }

        .active-products {
            justify-self: end;
            border-right: none;
            padding-right: 0;
        }

        /* 2행: 보유 포인트 라벨(좌), 값(우) */
        .points-label {
            justify-self: start;
        }

        .points-value {
            justify-self: end;
        }

        /* 모바일 전용: 버튼 텍스트 더 작게 */
        .btn-primary,
        .btn-secondary {
            font-size: clamp(0.6rem, 3.5vw, 0.9rem);
            padding: 0.45rem 0.8rem;
        }

        /* 모바일 전용: 구매/선물 버튼 가로 배치 강제 */
        .action-buttons {
            flex-wrap: nowrap;
            gap: 0.5rem;
        }

        .action-buttons .btn-primary,
        .action-buttons .btn-secondary {
            white-space: nowrap;
        }
    }

    /* 할인 안내 버튼, 활성화된 상품, 보유 포인트 텍스트를 가로 크기에 맞춰 축소 */
    .discount-info-btn {
        font-size: clamp(0.8rem, 2.5vw, 1rem);
    }

    .active-products-label,
    .points-label {
        font-size: clamp(0.8rem, 2.8vw, 1.3rem);
    }

    .active-products-value,
    .points-value {
        font-size: clamp(1rem, 3.2vw, 1.5rem);
    }

    @media (max-width: 768px) {
        .header-top {
            flex-direction: column;
            gap: 1rem;
            align-items: center;
        }

        .page-title {
            font-size: 2rem;
        }

        .tamagotchi-info {
            padding: 12px;
            border-radius: 25px;
        }

        .info-screen {
            padding: 10px;
            min-height: 50px;
        }

        .info-icon {
            font-size: 1.5rem;
            margin-right: 8px;
        }

        .info-title {
            font-size: 0.9rem;
        }

        .info-description {
            font-size: 0.75rem;
        }
    }
</style>