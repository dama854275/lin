<script>
    export let imageUrl = '/banner/co_1.jpg';
    export let alt = '엠드래곤 채널 배너';
    export let link = 'https://t.me/MDragonsoftwareon'; // 기본 텔레그램 링크
</script>

<div class="banner-container">
    <a href={link} class="banner-link" target="_blank" rel="noopener noreferrer">
        <img src={imageUrl} alt={alt} class="banner-image" />
    </a>
</div>

<style>
    .banner-container {
        width: 95%;
        max-width: 1000px;
        margin: 0 auto;
    }

    .banner-link {
        display: block;
        text-decoration: none;
        transition: transform 0.2s ease;
    }

    .banner-link:hover {
        transform: scale(1.02);
    }

    .banner-image {
        width: 100%;
        height: auto;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        transition: box-shadow 0.2s ease;
    }

    .banner-image:hover {
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
    }

    /* 그리드 셀 너비를 그대로 사용 (모바일 포함) */
</style>
