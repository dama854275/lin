<script>
    export let data;
    const { manual } = data;
    
</script>

<div class="page-layout">
    <div class="main-content">
        {#if manual}
            <h1 class="page-title">다마고치 시작하기</h1>
            {#if manual.image_url}
                <img src={manual.image_url} alt={manual.title} />
            {/if}
            <div class="content ck-content">
                {@html manual.content}
            </div>
        {:else}
            <p>사용 설명을 찾을 수 없습니다.</p>
        {/if}
    </div>
    
    
</div>

<style>
    @font-face {
        font-family: 'NeoDunggeunmo';
        src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/NeoDunggeunmo.woff') format('woff');
        font-weight: normal;
        font-style: normal;
    }

    .page-layout {
        position: relative;
        max-width: 100%;
        margin: 0 auto;
        padding: 1rem;
    }

    .main-content {
        max-width: 1000px;
        margin: 0 auto;
    }

    .banner-sidebar {
        position: absolute;
        top: 1rem;
        right: -2rem;
        width: 250px;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    /* 모바일에서 세로 레이아웃으로 변경 */
    @media (max-width: 768px) {
        .main-content {
            padding-right: 0;
        }

        .banner-sidebar {
            position: static;
            width: 100%;
            margin-bottom: 2rem;
        }
    }

    .page-title {
        font-family: 'NeoDunggeunmo', sans-serif;
        font-size: 2.5em;
        text-align: center;
        margin-bottom: 2rem;
        color: #333;
        font-weight: normal;
        background-color: #c5d3f8;
        padding: 1rem;
        border-radius: 8px;
        border: 2px solid #92aff8;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    img {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        margin: 1rem 0;
    }

    .content {
        margin: 2rem 0;
    }

    /* CKEditor 컨텐츠 스타일링 */
    :global(.ck-content) {
        width: 100%;
        min-width: 100%;
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

    :global(.ck-content table) {
        border-collapse: collapse;
        width: 100% !important;
        margin: 1em 0;
        table-layout: fixed;
    }

    :global(.ck-content table td, .ck-content table th) {
        border: 1px solid #ddd;
        padding: 8px;
        word-wrap: break-word;
    }

    :global(.ck-content table th) {
        background-color: #f5f5f5;
    }

    :global(.ck-content img) {
        max-width: 100%;
        height: auto;
        margin: 1em 0;
    }

    :global(.ck-content .text-align-left) { text-align: left; }
    :global(.ck-content .text-align-center) { text-align: center; }
    :global(.ck-content .text-align-right) { text-align: right; }
    :global(.ck-content .text-align-justify) { text-align: justify; }

    :global(.ck-content ul, .ck-content ol) {
        padding-left: 40px;
        margin: 1em 0;
    }

    :global(.ck-content li) {
        margin: 0.5em 0;
    }

    :global(.ck-content blockquote) {
        margin: 1em 0;
        padding-left: 1em;
        border-left: 4px solid #ddd;
        color: #666;
    }

    :global(.ck-content pre) {
        background-color: #f5f5f5;
        padding: 1em;
        border-radius: 4px;
        overflow-x: auto;
    }
</style>