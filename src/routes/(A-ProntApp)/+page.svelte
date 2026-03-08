<script>
    import { goto } from '$app/navigation';
    import { onMount, onDestroy } from 'svelte';

    // 페이지 이동 함수
    function navigateTo(path) {
        goto(path);
    }

    // smallbanner 이미지 파일명 배열 (실제 파일명에 맞게 추가)
    let bannerImages = [
        'b_1_이미르.png',
        'b_11_뱀피르.png',
        'b_2_레이븐2.png',
        'b_3_RF.png',
        'b_4_오딘.png',
        'b_5_로드나인.png',
        'b_6_나이트 크로우.png',
        'b_7_ROM.png',
        'b_8_아키에이지 워.png',
        'b_9_아스달 연대기.png',
        'b_10_제노니아.png',
    ];

    // 파일명에서 순서와 이름 추출
    let sortedBanners = bannerImages
        .map(filename => {
            const match = filename.match(/^b_(\d+)_(.+)\.png$/);
            return match
                ? { order: Number(match[1]), name: match[2], src: `/smallbanner/${filename}` }
                : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.order - b.order);

    // 슬라이드 상태
    let currentIndex = 0;
    let interval;
    let isTransitioning = true;
    let isMobile = false;
    let isSmallMobile = false;

    function nextSlide() {
        isTransitioning = true;
        currentIndex = currentIndex + 1;
        
        // 첫 번째 세트가 끝나면 두 번째 세트의 시작점으로 즉시 이동
        if (currentIndex >= sortedBanners.length) {
            setTimeout(() => {
                isTransitioning = false;
                currentIndex = sortedBanners.length;
            }, 700);
        }
    }

    // 자동 슬라이드
    onMount(() => {
        // 모바일 감지
        const checkMobile = () => {
            isMobile = window.innerWidth <= 768;
            isSmallMobile = window.innerWidth <= 480;
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        
        interval = setInterval(nextSlide, 2500);
        
        return () => {
            window.removeEventListener('resize', checkMobile);
        };
    });
    onDestroy(() => clearInterval(interval));
</script>

<div class="content-container">
    <div class="mobile-warning">PC 환경에 최적화된 사이트입니다</div>
    <div class="bg-image"></div>
    <div class="content-wrapper">
        <div class="max-w-6xl mx-auto px-4 py-8">
            <!-- Hero Section -->
            <div class="flex items-center justify-between mb-16 space-x-8">
                <!-- Left Content -->
                <div class="space-y-6">
                    <h1 class="text-6xl font-bold text-gray-900 tracking-in-expand">
                        Welcome to TAMAGOTCHI
                    </h1>
                </div>
            </div>

            <!-- Banner Image -->
            <div class="mb-16 w-full relative" style="aspect-ratio: 16/9;">
                <img 
                    src="/full.png" 
                    alt="다마고치 메인 배너" 
                    class="w-full h-full object-cover rounded-2xl"
                />
            </div>

            <!-- Slide Banner -->
            <div class="slide-banner-container">
                <div
                    class="slide-banner-track"
                    style="transform: translateX({-currentIndex * (isSmallMobile ? 156 : isMobile ? 190 : 216)}px); transition: {isTransitioning ? 'transform 0.7s cubic-bezier(0.4,0,0.2,1)' : 'none'};"
                >
                    {#each [...sortedBanners, ...sortedBanners, ...sortedBanners] as banner, i (i)}
                        <div class="slide-banner-item">
                            <img src={banner.src} alt={banner.name} />
                            <div class="slide-banner-caption">{banner.name}</div>
                        </div>
                    {/each}
                </div>
            </div>

            <!-- Target Users Section -->
            <div class="mb-16 tamagotchi-section target-users">
                <div class="tamagotchi-border">
                    <h2 class="text-3xl font-bold text-center mb-8 pixel-heading">게이머를 위한</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div class="feature-card pixel-border">
                            <div class="icon-container">
                                <i class="fas fa-briefcase"></i>
                            </div>
                            <h3 class="text-gray-800 text-xl font-semibold mb-4 text-center">바쁜 현대인</h3>
                            <p class="text-gray-600 text-center">내가 지켜보기 힘들때도 계속<br>캐릭터를 성장시켜보세요</p>
                        </div>
                        <div class="feature-card pixel-border">
                            <div class="icon-container">
                                <i class="fas fa-gamepad"></i>
                            </div>
                            <h3 class="text-gray-800 text-xl font-semibold mb-4 text-center">추억의 내 캐릭터</h3>
                            <p class="text-gray-600 text-center">더이상 플레이하지 않지만<br>정성들여 키웠던 캐릭터를 다시<br>성장시킬 수 있습니다</p>
                        </div>
                        <div class="feature-card pixel-border">
                            <div class="icon-container">
                                <i class="fas fa-desktop"></i>
                            </div>
                            <h3 class="text-gray-800 text-xl font-semibold mb-4 text-center">하나의 PC에서 전부</h3>
                            <p class="text-gray-600 text-center">하나의 PC에서 여러게임을<br>실행하고 관리할 수 있습니다</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- User Experience Section -->
            <div class="mb-16 tamagotchi-section user-experience">
                <div class="tamagotchi-border">
                    <h2 class="text-3xl font-bold text-center mb-8 pixel-heading">사용자 경험</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div class="feature-card pixel-border">
                            <div class="icon-container">
                                <i class="fas fa-random"></i>
                            </div>
                            <h3 class="text-gray-800 text-xl font-semibold mb-4 text-center">모든 동작 랜덤화</h3>
                            <p class="text-gray-600 text-center">안전한 이미지 인식 방식<br/>매번, 매 시간 랜덤한 동작들을 통해<br/>행동이 패턴화 되지 않음</p>
                        </div>
                        <div class="feature-card pixel-border">
                            <div class="icon-container">
                                <i class="fas fa-mouse-pointer"></i>
                            </div>
                            <h3 class="text-gray-800 text-xl font-semibold mb-4 text-center">마우스 키보드 직접 제어</h3>
                            <p class="text-gray-600 text-center">마우스와 키보드를 직접 제어하여<br/>내가 직접 플레이하는것과 같은<br/>신호를 생성합니다</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Benefits Section -->
            <div class="mb-16 tamagotchi-section benefits">
                <div class="tamagotchi-border">
                    <h2 class="text-3xl font-bold text-center mb-8 pixel-heading">다마고치와 함께하면</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div class="feature-card benefit-card pixel-border">
                            <div class="icon-container">
                                <i class="fas fa-clock"></i>
                            </div>
                            <h3 class="text-gray-800 text-xl font-semibold mb-4 text-center">시간 절약</h3>
                            <p class="text-gray-600 text-center">반복적인 작업을 자동화하여<br>내가 직접 해야 할 시간을 절약할 수 있습니다</p>
                        </div>
                        <div class="feature-card benefit-card pixel-border">
                            <div class="icon-container">
                                <i class="fas fa-user-shield"></i>
                            </div>
                            <h3 class="text-gray-800 text-xl font-semibold mb-4 text-center">캐릭터 관리</h3>
                            <p class="text-gray-600 text-center">24시간 관리 가능하여<br>캐릭터를 꾸준히 성장시킬 수 있습니다</p>
                        </div>
                        <div class="feature-card benefit-card pixel-border">
                            <div class="icon-container">
                                <i class="fas fa-smile"></i>
                            </div>
                            <h3 class="text-gray-800 text-xl font-semibold mb-4 text-center">스트레스 없는 경험</h3>
                            <p class="text-gray-600 text-center">반복적인 작업은 이제 그만<br>게임의 주요 재미에 집중할 수 있습니다.</p>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>
</div>

<style>
    /* 전체 컨테이너 */
    .content-container {
        width: 100%;
        padding-top: 60px; /* 네비게이션 높이만큼 패딩 추가 */
        min-height: 100vh;
        position: relative;
    }
    
    /* 모바일 경고 배너 */
    .mobile-warning {
        display: none;
        background-color: #fff9b3;
        color: #666;
        text-align: center;
        padding: 8px;
        font-family: 'NeoDunggeunmo', sans-serif;
        font-size: 0.9rem;
        position: fixed;
        top: 60px;
        left: 0;
        right: 0;
        z-index: 2;
    }

    @media (max-width: 768px) {
        .mobile-warning {
            display: block;
        }
        .content-container {
            padding-top: 80px; /* 네비게이션 + 경고 배너 높이 */
        }
        .bg-image {
            top: 80px; /* 네비게이션 + 경고 배너 높이 */
        }
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
    
    /* 현재 이미지에 어울리도록 카드 스타일 조정 */
    .feature-card {
        background-color: rgba(255, 255, 255, 0.85);
        border-radius: 1rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        padding: 2rem;
        transition: all 0.3s;
        backdrop-filter: blur(5px);
        border: 1px solid rgba(243, 244, 246, 0.6);
        position: relative;
        overflow: hidden;
    }

    .feature-card:hover {
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        background-color: rgba(255, 255, 255, 0.95);
        transform: translateY(-5px);
    }

    .feature-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 100px;
        background: linear-gradient(135deg, rgba(255, 211, 225, 0.1), rgba(169, 228, 239, 0.1));
        z-index: 0;
    }

    .feature-card > * {
        position: relative;
        z-index: 1;
    }

    /* 다마고치 스타일 카드 */
    .tamagotchi-card {
        position: relative;
        width: 100%;
        max-width: 300px;
        margin: 0 auto;
        background-color: #d3e1ff;
        border-radius: 50px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15);
        transition: all 0.3s;
        border: 8px solid #9dbdff;
    }

    .tamagotchi-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    }

    .tamagotchi-screen {
        width: 85%;
        aspect-ratio: 1/1;
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

    .btn-primary {
        padding: 0.75rem 1.5rem;
        background-color: #9db5fd;
        color: white;
        border-radius: 0.5rem;
        transition: all 0.2s;
        font-family: 'NeoDunggeunmo', sans-serif;
        clip-path: polygon(
            0% 10%, 4% 0%, 96% 0%, 100% 10%,
            100% 90%, 96% 100%, 4% 100%, 0% 90%
        );
    }

    .btn-primary:hover {
        background-color: #7b93fb;
        transform: translateY(-2px);
    }

    .notice-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        border-radius: 0.5rem;
        transition: background-color 0.2s;
    }

    .notice-item:hover {
        background-color: #f9fafb;
    }

    /* Neo 둥근모 폰트 임포트 */
    @font-face {
        font-family: 'NeoDunggeunmo';
        src: url('https://cdn.jsdelivr.net/gh/neodgm/neodgm-webfont@latest/neodgm_code/neodgm_code.woff2') format('woff2'),
             url('https://cdn.jsdelivr.net/gh/neodgm/neodgm-webfont@latest/neodgm_code/neodgm_code.woff') format('woff');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
    }
    
    /* 폰트 적용 */
    h1, h2, button, .notice-item {
        font-family: 'NeoDunggeunmo', sans-serif;
    }

    h3 {
        font-family: inherit;
        font-size: 1.5rem;
        font-weight: 600;
    }

    /* 애니메이션 코드 유지 */
    .tracking-in-expand {
        -webkit-animation: tracking-in-expand 0.7s cubic-bezier(0.215, 0.610, 0.355, 1.000) both;
                animation: tracking-in-expand 0.7s cubic-bezier(0.215, 0.610, 0.355, 1.000) both;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @keyframes slideDown {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }

    :global(.animate-fadeIn) {
        animation: fadeIn 0.5s ease-out;
    }

    :global(.animate-slideDown) {
        animation: slideDown 0.5s ease-out;
    }

    @-webkit-keyframes tracking-in-expand {
        0% {
            letter-spacing: -0.5em;
            opacity: 0;
        }
        40% {
            opacity: 0.6;
        }
        100% {
            opacity: 1;
        }
    }

    @keyframes tracking-in-expand {
        0% {
            letter-spacing: -0.5em;
            opacity: 0;
        }
        40% {
            opacity: 0.6;
        }
        100% {
            opacity: 1;
        }
    }

    .bg-pan-left {
        -webkit-animation: bg-pan-left 8s both;
                animation: bg-pan-left 8s both;
        background-size: 200% 100%;
    }

    @-webkit-keyframes bg-pan-left {
        0% {
            background-position: 100% 50%;
        }
        100% {
            background-position: 0% 50%;
        }
    }

    @keyframes bg-pan-left {
        0% {
            background-position: 100% 50%;
        }
        100% {
            background-position: 0% 50%;
        }
    }

    /* 공지사항 다마고치 스타일 */
    .tamagotchi-notice {
        position: relative;
        width: 100%;
        max-width: 500px;
        margin: 0 auto;
        background-color: #a9e4ef;
        border-radius: 50px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15);
        transition: all 0.3s;
        border: 8px solid #7fd1e0;
    }

    .tamagotchi-notice:hover {
        transform: translateY(-5px);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    }
    
    .notice-screen {
        width: 90%;
        aspect-ratio: 16/9;
    }
    
    .notice-badge {
        display: inline-block;
        background-color: #ff9dbd;
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: bold;
    }

    .notice-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.5rem;
        border-radius: 0.5rem;
        transition: background-color 0.2s;
        background-color: rgba(255, 255, 255, 0.7);
        margin-bottom: 0.5rem;
    }

    .notice-item:hover {
        background-color: rgba(255, 255, 255, 1);
    }

    /* 아이콘 배경 효과 */
    .feature-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 100px;
        background: linear-gradient(135deg, rgba(255, 211, 225, 0.1), rgba(169, 228, 239, 0.1));
        z-index: 0;
    }

    .feature-card > * {
        position: relative;
        z-index: 1;
    }

    /* 아이콘 컨테이너 스타일 */
    .icon-container {
        width: 64px;
        height: 64px;
        margin: 0 auto 1.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(255, 255, 255, 0.9);
        border-radius: 50%;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .icon-container i {
        font-size: 2rem;
        color: #585858;
    }

    /* 섹션별 아이콘 색상 테마 */
    .target-users .icon-container {
        border-color: #9dbdff;
    }

    .user-experience .icon-container {
        border-color: #a9e4ef;
    }

    .benefits .icon-container {
        border-color: #ff9dbd;
    }

    .product-icon {
        background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAABEElEQVR4nGNgoBAwQmlGKM3ACFVkhAqAadT1kCAog+5J5AZgACCM1RCYg4G24QfCICvwqUe3AKcr0A3AawmyBfhsxakJZgHcAKAicDD9DzMEiBmg/P+4DMAVwsgGYGgEGgALAmwORvcKugGMaIbjNQSmGWg4IxQzQi1Bt+R/UlIS2ID/2AwAYmz+ZIJZANOMTTMMIFuAbjhBA9DNg+H/QUFBYBeAnMAIdQUufwExyICgoCAmCP+/t7c30AAUl8AAExQz/g8JCUFxBQwzMeFQj24JuguIMgCfolGwECshQRxCRABCXQELRpAF2Fzy399/wn9MADYEGYPUoRuAEQcEAXo8AFMhzBCYS4CCMALZAABMD3XdgMzJiQAAAABJRU5ErkJggg==");
    }

    .point-icon {
        background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA9ElEQVR4nGNgoBAwYsOMMIyiEF0xTA0TugJ0xTCa0c3NDWwATDFMM0wzEzZDkA1AtxhmCBNMA7oCbIphmJubG1MxDKArhmFkw5mwKUY2hBGbJqgBcAyzhAlZAS7F6JphmAnZZejqmdAV4FIMw0xQlzLhUgwDTLgUwzATLsUwzIRLMQwz4VKMDiB5gxKUYhplwKYZhJlyKYZgJl2IYZsKlGIaZcCmGYSZcimGYCZdiGGbCpRiGmXAphkVMMB7F6IaA0wkwjqHpABg/0LQLVM+ETTEyZkI2CMkSRpAaXIqRvQI3gAkkiEsxsgVwl8AUwzAA2Ok+muhJZOAAAAAASUVORK5CYII=");
    }

    .notice-icon {
        background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA7klEQVR4nGNgoBAwQmlGKM2IrgCmGF0zE7oCdMUwmtHNzQ1sAEwxTDNMMxM2Q5ANQLcYZggTTAO6AmyKYZibmxtTMQygK4ZhZMOZsClGNoQRmyaoAXAMs4QJWQEuxeiaYZgJ2WXo6pnQFeBSDMNMUJcy4VIMw0y4FMMwEy7FMMyESzEMM+FSDMNMuBSjA0geYMSlGIaZcCmGYSZcimGYCZdiGGbCpRiGmXAphgFGIO3v748zHBmZoJqxYyYYZkLTDHMJNJqYoAbBFGJVjE0TshfgBsAsYWRkAqYDJmjahilgwqYY2QVwA6CaMTRiUwwDAFOWkUDyfNvTAAAAAElFTkSuQmCC");
    }

    /* 새로운 스타일 추가 */
    .pixel-heading {
        text-shadow: 2px 2px 0 #ffd3e1;
        position: relative;
        display: inline-block;
    }
    
    .pixel-heading::after {
        content: '';
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        width: 100px;
        height: 3px;
        background: linear-gradient(to right, transparent, #ffd3e1, transparent);
    }
    
    .pixel-border {
        border: 1.5px solid #e5e7eb;
        box-shadow: 0 6px 0 #ffd3e1;
        transition: all 0.3s;
    }
    
    .pixel-border:hover {
        transform: translateY(-8px);
        box-shadow: 0 12px 0 #ffd3e1;
    }
    
    .tamagotchi-section {
        position: relative;
        padding: 20px;
    }
    
    .tamagotchi-border {
        border: 4px solid #9dbdff;
        border-radius: 20px;
        padding: 20px;
        background-color: rgba(255, 255, 255, 0.4);
    }
    
    .benefit-card {
        background-color: rgba(255, 255, 255, 0.9);
        transition: all 0.3s;
    }
    
    .benefit-card:hover {
        background-color: white;
    }
    
    /* 픽셀 아이콘 추가 */
    .user-icon-1 {
        background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAhGVYSWZNTQAqAAAACAAFARIAAwAAAAEAAQAAARoABQAAAAEAAABKARsABQAAAAEAAABSASgAAwAAAAEAAgAAh2kABAAAAAEAAABaAAAAAAAAAEgAAAABAAAASAAAAAEAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAEKADAAQAAAABAAAAEAAAAADGIWiXAAAACXBIWXMAAAsTAAALEwEAmpwYAAABWWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyI+CiAgICAgICAgIDx0aWZmOk9yaWVudGF0aW9uPjE8L3RpZmY6T3JpZW50YXRpb24+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgoZXuEHAAABlklEQVQ4EYVSQWsCMRB90Y9Y6KKgN8GT4L0/wqP/zIPgTfDgreChtLL0T3QzmWQz2W11YDOZ5OW9vEmiC/Acp1arRbfbjXK5LK9ms0nH45FutxsVCgVZI57NZpTNZuXdaDTo9XrJ9/V6pclkIjFBgYjNZmOz2cyGw6EdjUa22+1svV7bdru1/X5vsXt0XdcGbq7XaxsMBvZ8Ptt+v7fL5dJWKhXvIQBFZN7v90Qvx4QnhUIhWSHXqVQqtNvtJHY+n4WnWq0q6UTgJyxCyPP5bLF7tFwuLeYt3tfr1XI17B+NxwKFfD4f5gCsVqsJhB+6DIdDcaYEcJI1gAAH3JBLJBK3Wi6XE05wqBZCzOfzorXHkCdEIMCBcTlMlIK/B1yCTU+nk8T1ej0plBBoEJ+gBBD3+51yuVwSlP9MnE4nc7lcLDQTAnAGgYjwHkOV2+12tN/vE78gN/IWi0XBDWGm0yn1er2EMNIgCBSN6RwMpFHEAkNUDEHqfr8LDEVQcOAk+Q1KAEYkHg8OdAbvqQMnQnN+/gDZ3XeAkp1KHAAAAABJRU5ErkJggg==");
    }
    
    .user-icon-2 {
        background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAhGVYSWZNTQAqAAAACAAFARIAAwAAAAEAAQAAARoABQAAAAEAAABKARsABQAAAAEAAABSASgAAwAAAAEAAgAAh2kABAAAAAEAAABaAAAAAAAAAEgAAAABAAAASAAAAAEAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAEKADAAQAAAABAAAAEAAAAADGIWiXAAAACXBIWXMAAAsTAAALEwEAmpwYAAABWWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyI+CiAgICAgICAgIDx0aWZmOk9yaWVudGF0aW9uPjE8L3RpZmY6T3JpZW50YXRpb24+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgoZXuEHAAABnElEQVQ4EXVSMWsUURC+b++9JJvL3YbspbFTwTsUC1Ow8g/kfoJgZWEhiKVYWYuVlaVgZ6GFlWBlYZtCCMnFCBKTy+aSbC57u+/NjN+83Uo8GGbezHzfffPNvBA+cZ/Pp1guk7quSY9sNiPqFwgcwlKtqyuZ2a1z89OUJf7GrfNxHCt5m6YRiGmaNhL1UQDuELVE7XabiLNCoYA+0N/tduX5TzM8Pz8Xx66+dRAw1BBSMEg1vN7Z0ePpVMaXl+Wy06HN9XUlTpNEHj4ZKlGXRNNIYv2Hw88k/oGLLtDVS+fPiy/U63RJigHpTMFRNV1ZgQ+Z+D2ufgUgnk6nijgYDCRJEiLOer0euQP7FeaPDDhO1el0CLORhKmGQdbfdM4tFgvC+UG43W4Ld7tdhTv5wfsdQHD9GDcajdTRmEL4C8OOWPztA4GlUolM0pQeDAYUx7Fs4O9HaZrKw6dPVO4wPB6PRffbPghjpVIpJY2uGP8ibrfbIo5GI9na3FQH93d3qdFoyOvdXfnw8aPsHx7q4PX79xLcvXOn7D2MgPgdNy5OWCH4jx9/AHnKheDgs13DAAAAAElFTkSuQmCC");
    }
    
    .user-icon-3 {
        background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAhGVYSWZNTQAqAAAACAAFARIAAwAAAAEAAQAAARoABQAAAAEAAABKARsABQAAAAEAAABSASgAAwAAAAEAAgAAh2kABAAAAAEAAABaAAAAAAAAAEgAAAABAAAASAAAAAEAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAEKADAAQAAAABAAAAEAAAAADGIWiXAAAACXBIWXMAAAsTAAALEwEAmpwYAAABWWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyI+CiAgICAgICAgIDx0aWZmOk9yaWVudGF0aW9uPjE8L3RpZmY6T3JpZW50YXRpb24+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgoZXuEHAAABl0lEQVQ4EY1TPWtUQRQ99857M5tks5OQLOpiYmETwUIEO1v/gOAP8AdYWthZiYWFnVhZWdjYamFnL1iKSJQQSGKMu9nszOyb9+4517zZwiKZgct9nHO/ZoRfiJeXR9jtQktilIaBeBgZisIU+0sGBdW2sVOx7fV9lRaGV8YbKIpQnPM6GkkkDAYrwVX0+yXs9sKGU8WXMhbV2qDXczZzfjRPWAP9foDFhxFutw5oK+C+CwJM7wHFYRFZXVrz6nMVzYrAXk17DU7DWKBzVOD0a46M+11oaCyLmVEJJIFsSYzHCQS1/pZs7XgMhzGOYO/OqPZ1z5FWkpgwMRH1BgIb29VPdDZzPHs9QlHYdBV+tOSdLYc8mA7XrfgRMq9ArwFLWJvkeD8e4OHSEjqdFLVajpdvRqg2HNZWLcM94P7CaLY33jSb8Gw8wYvuJ9zdOkQYRmi1WnCugs1tTb99y7GxU9M9Mm9+EoXnT5eJaNPfqvQ+GGD64gmeNxu43+lgZeUOLvrn2Pvxgy8zGmkc9GvTlUh4DHgEI1h85x/zJ+cvb1fwOxHnJjsAAAAASUVORK5CYII=");
    }
    
    .exp-icon-1 {
        background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA6ElEQVR4nGNgoBAwQmlGKM2IrgCmGF0zE7oCdMUwmtHNzQ1sAEwxTDNMMxM2Q5ANQLcYZggTTAO6AmyKYZibmxtTMQygK4ZhZMOZsClGNoQRmyaoAXAMs4QJWQEuxeiaYZgJ2WXo6pnQFeBSDMNMUJcy4VIMw0y4FMMwEy7FMMyESzEMM+FSDMNMuBSjA0geYMSlGIaZcCmGYSZcimGYCZdiGGbCpRiGmXAphmEmXIphgBFIO/n6Ehck/H19GLFhdMOZoDQTmmKYS6CuZYKaBFOMVTE2TshfgBsAsYWRkAqYDJmjahilgwqYY2QVwA6CaMTRiUwwDAFOWkUDyfNvTAAAAAElFTkSuQmCC");
    }
    
    .exp-icon-2 {
        background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA70lEQVR4nGNgoBAwQmlGKM2IrgCmGF0zE7oCdMUwmtHNzQ1sAEwxTDNMMxM2Q5ANQLcYZggTTAO6AmyKYZibmxtTMQygK4ZhZMOZsClGNoQRmyaoAXAMs4QJWQEuxeiaYZgJ2WXo6pnQFeBSDMNMUJcy4VIMw0y4FMMwEy7FMMyESzEMM+FSDMNMuBSjA0geYMSlGIaZcCmGYSZcimGYCZdiGGbCpRiGmXAphgFGIO3v748zHBmZoJqxYyYYZkLTDHMJNJqYoAbBFGJVjE0TshfgBsAsYWRkAqYDJmjahilgwqYY2QVwA6CaMTRiUwwDAFOWkUDyfNvTAAAAAElFTkSuQmCC");
    }
    
    .benefit-icon-1 {
        background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA9ElEQVR4nGNgoBAwYsOMMIyiEF0xTDHMAUzoCmAYpASuENkAZAXoCmFqGLEZgm4B3IBQfyINMUROE0zImqGYESbKFFGHVTMMM8IwNs0wzIRuABOyYpgCJmTDsRkOswzDJdCUANOMTTMMM0FdygQVZwRqlGBCUwzDTMgRiK4YhplgAkBNIP+jG4CsGKYRhhmRNSMLMmFTjAxQXIFNMQwzEopEmAFM2BQjG8CEKM34P1QTIYAR2TACQYiiGEYzoRlArAHImlFcgs9VeF0Bw0zICrBpxm85unp0lwDTAjPIgEZ0zTDMxAAiWMkQnZmYoC5iQrcEWTEAlLhQ5SKVTmMAAAAASUVORK5CYII=");
    }
    
    .benefit-icon-2 {
        background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAnElEQVR4nGNgoBAwQmlGKM2IrgCmGF0zE7oCdMUwmtHNzQ1sAEwxTDNMMxM2Q5ANQLcYZggTTAO6AmyKYZibmxtTMQygK4ZhZMOZsClGNoQRmyaoAXAMs4QJWQEuxeiaYZgJ2WXo6pnQFeBSDMNMUJcy4VIMw0y4FGMCTExMYJoBGN8iEoaZgB6hUH9/sDiKCaiaMTQy4cIsLS04F6MFCUYZ/2A//F7AZAmyi5BdgVczE9QAZuQgA2vEgicLw5iACQjdRcQmNJA+RhRXoCsGAEotFxc7A8QmAAAAAElFTkSuQmCC");
    }
    
    .benefit-icon-3 {
        background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA0ElEQVR4nGNgoBAwQmlGKM2IrgCmGF0zE7oCdMUwmtHNzQ1sAEwxTDNMMxM2Q5ANQLcYZggTTAO6AmyKYZibmxtTMQygK4ZhZMOZsClGNoQRmyaoAXAMs4QJWQEuxeiaYZgJ2WXo6pnQFeBSDMNMUJcy4VIMw0y4FGMCTExMYJoBGN8iEoaZgB6hUH9/sDiKCaiaMTQy4cIsLS04F6MFCUYZ/2A//F7AZAmyi5BdgVczE9QAZuQgA2vEgicLw5iACQjdRcQmNJA+RhRXoCsGAEotFxc7A8QmAAAAAElFTkSuQmCC");
    }

    /* 섹션별 픽셀 보더 색상 */
    .target-users .pixel-border {
        border: 1.5px solid #e5e7eb;
        box-shadow: 0 6px 0 #9dbdff;
        transition: all 0.3s;
    }
    
    .target-users .pixel-border:hover {
        transform: translateY(-8px);
        box-shadow: 0 12px 0 #9dbdff;
    }

    .user-experience .pixel-border {
        border: 1.5px solid #e5e7eb;
        box-shadow: 0 6px 0 #a9e4ef;
        transition: all 0.3s;
    }
    
    .user-experience .pixel-border:hover {
        transform: translateY(-8px);
        box-shadow: 0 12px 0 #a9e4ef;
    }

    .benefits .pixel-border {
        border: 1.5px solid #e5e7eb;
        box-shadow: 0 6px 0 #ff9dbd;
        transition: all 0.3s;
    }
    
    .benefits .pixel-border:hover {
        transform: translateY(-8px);
        box-shadow: 0 12px 0 #ff9dbd;
    }

    .user-experience .pixel-heading {
        text-shadow: 2px 2px 0 #a9e4ef;
        position: relative;
        display: inline-block;
    }
    
    .user-experience .pixel-heading::after {
        content: '';
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        width: 100px;
        height: 3px;
        background: linear-gradient(to right, transparent, #a9e4ef, transparent);
    }

    /* 섹션별 테두리 색상 */
    .target-users .tamagotchi-border {
        border: 4px solid #9dbdff;
        border-radius: 20px;
        padding: 20px;
        background-color: rgba(255, 255, 255, 0.4);
    }

    .user-experience .tamagotchi-border {
        border: 4px solid #a9e4ef;
        border-radius: 20px;
        padding: 20px;
        background-color: rgba(255, 255, 255, 0.4);
    }

    .benefits .tamagotchi-border {
        border: 4px solid #ff9dbd;
        border-radius: 20px;
        padding: 20px;
        background-color: rgba(255, 255, 255, 0.4);
    }

    .target-users .pixel-heading {
        text-shadow: 2px 2px 0 #9dbdff;
        position: relative;
        display: inline-block;
    }
    
    .target-users .pixel-heading::after {
        content: '';
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        width: 100px;
        height: 3px;
        background: linear-gradient(to right, transparent, #9dbdff, transparent);
    }

    .slide-banner-container {
        width: 100%;
        overflow: hidden;
        margin: 0 auto 2rem auto;
        max-width: 1200px;
        height: 180px;
        position: relative;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .slide-banner-track {
        display: flex;
        transition: transform 0.7s cubic-bezier(0.4,0,0.2,1);
        align-items: center;
    }

    .slide-banner-item {
        width: 200px;
        flex-shrink: 0;
        margin: 0 8px;
        text-align: center;
        position: relative;
        background: transparent;
        box-shadow: none;
        border-radius: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
    }

    .slide-banner-item img {
        width: 100%;
        height: 140px;
        object-fit: contain;
        border-radius: 10px;
        background: transparent;
        box-shadow: none;
    }

    .slide-banner-caption {
        margin-top: 8px;
        font-family: 'NeoDunggeunmo', sans-serif;
        font-size: 1.1rem;
        color: #333;
        text-shadow: 1px 1px 0 #fff;
    }

    /* 모바일에서 배너 크기 조정 */
    @media (max-width: 768px) {
        .slide-banner-container {
            height: 120px;
            max-width: 100%;
        }

        .slide-banner-item {
            width: 180px;
            margin: 0 5px;
        }

        .slide-banner-item img {
            height: 90px;
        }

        .slide-banner-caption {
            font-size: 0.9rem;
            margin-top: 4px;
        }
    }

    /* 매우 작은 모바일 화면에서 더 작게 */
    @media (max-width: 480px) {
        .slide-banner-container {
            height: 100px;
        }

        .slide-banner-item {
            width: 150px;
            margin: 0 3px;
        }

        .slide-banner-item img {
            height: 75px;
        }

        .slide-banner-caption {
            font-size: 0.8rem;
            margin-top: 2px;
        }
    }
</style>