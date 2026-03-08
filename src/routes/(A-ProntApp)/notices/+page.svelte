<script>
    import { supabase } from '$lib/supabase/client';
    import { goto } from '$app/navigation';
    import { isAdmin } from '$lib/stores/auth';
    import { onMount } from 'svelte';
    
    export let data;
    let notices = [];
    let expandedStates = {};
    
    onMount(async () => {
        const { data: noticeData, error } = await supabase
            .from('notices')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) {
            console.error('Error fetching notices:', error);
            return;
        }
        
        notices = noticeData;
    });
    
    function toggleExpand(noticeId) {
        expandedStates[noticeId] = !expandedStates[noticeId];
        expandedStates = expandedStates;
    }

    async function handleDelete(id) {
        if (!$isAdmin) {
            alert('관리자만 삭제할 수 있습니다.');
            return;
        }

        if (confirm('정말로 이 공지사항을 삭제하시겠습니까?')) {
            try {
                // 1. 먼저 해당 공지사항 정보 가져오기
                const { data: noticeData, error: noticeError } = await supabase
                    .from('notices')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (noticeError) throw noticeError;

                // 2. 이미지가 있다면 삭제
                if (noticeData.image_url) {
                    try {
                        // 이미지 URL에서 파일 경로 추출
                        const urlParts = noticeData.image_url.split('notices-images/public/');
                        if (urlParts.length > 1) {
                            const fileName = `public/${urlParts[1].split('?')[0]}`; // public/ 경로 포함
                            console.log('Deleting image:', fileName); // 삭제할 파일 경로 로깅

                            const { error: storageError } = await supabase.storage
                                .from('notices-images')
                                .remove([fileName]);

                            if (storageError) {
                                console.error('이미지 삭제 실패:', storageError);
                            }
                        }
                    } catch (imageError) {
                        console.error('이미지 삭제 중 오류:', imageError);
                    }
                }

                // 3. 공지사항 삭제
                const { error: deleteError } = await supabase
                    .from('notices')
                    .delete()
                    .eq('id', id);

                if (deleteError) throw deleteError;

                // 4. 성공 메시지 표시
                alert('공지사항이 삭제되었습니다.');
                
                // 5. 페이지 새로고침 대신 notices 배열 업데이트
                notices = notices.filter(notice => notice.id !== id);
            } catch (error) {
                console.error('삭제 중 오류 발생:', error);
                alert('삭제 중 오류가 발생했습니다.');
            }
        }
    }

    // 키보드 이벤트 핸들러 추가
    function handleKeyPress(event, noticeId) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleExpand(noticeId);
        }
    }
</script>

<div class="page-layout">
    <div class="main-content">
        <div class="container mx-auto p-6">
            <div class="header">
                <h1 class="text-3xl font-bold mb-8">공지사항</h1>
                {#if $isAdmin}
                    <a href="/notices/create" class="create-button">새 공지사항 작성</a>
                {/if}
            </div>

            <div class="notices-list">
                {#each notices as notice}
                    <div class="notice-card">
                        <div class="notice-header-wrapper">
                            <button 
                                class="notice-header" 
                                on:click={() => toggleExpand(notice.id)}
                                on:keydown={(e) => handleKeyPress(e, notice.id)}
                                aria-expanded={!!expandedStates[notice.id]}
                                aria-controls="notice-content-{notice.id}"
                            >
                                <h2>{notice.title}</h2>
                                <p class="date">
                                    {new Date(notice.created_at).toLocaleString('ko-KR', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false // 24시간 형식 사용
                                    })}
                                </p>
                                <span class="expand-icon" aria-hidden="true">
                                    {expandedStates[notice.id] ? '▼' : '▶'}
                                </span>
                            </button>

                            {#if $isAdmin}
                                <div class="action-buttons" role="group" aria-label="공지사항 관리">
                                    <a 
                                        href="/notices/edit/{notice.id}" 
                                        class="edit-button"
                                        role="button"
                                    >
                                        수정
                                    </a>
                                    <button 
                                        type="button" 
                                        class="delete-button"
                                        on:click={() => handleDelete(notice.id)}
                                    >
                                        삭제
                                    </button>
                                </div>
                            {/if}
                        </div>
                        
                        {#if expandedStates[notice.id]}
                            <div 
                                id="notice-content-{notice.id}" 
                                class="notice-content"
                                role="region"
                                aria-labelledby="notice-header-{notice.id}"
                            >
                                <p class="content">{notice.content}</p>
                                {#if notice.image_url}
                                    <img src={notice.image_url} alt="공지사항 이미지" />
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    </div>
    
    <div class="banner-sidebar">
    </div>
</div>

<style>
    .container {
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
    }

    h1 {
        font-size: 1.875rem;
        font-weight: 700;
        margin-bottom: 2rem;
        color: #333;
    }

    .create-button {
        padding: 10px 20px;
        background-color: #4CAF50;
        color: white;
        text-decoration: none;
        border-radius: 4px;
    }

    .create-button:hover {
        background-color: #45a049;
    }

    .notices-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .notice-card {
        border: 1px solid #ddd;
        border-radius: 8px;
        background-color: white;
        overflow: hidden;
    }

    .notice-header-wrapper {
        display: flex;
        align-items: center;
        background-color: #f8f9fa;
        padding: 0 10px;
    }

    .notice-header {
        flex: 1;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 10px;
        cursor: pointer;
        background: none;
        border: none;
        text-align: left;
        font-size: inherit;
        width: 100%;
    }

    .notice-header:hover {
        background-color: #f0f0f0;
    }

    .notice-header:focus {
        outline: 2px solid #4CAF50;
        outline-offset: -2px;
    }

    .notice-header h2 {
        margin: 0;
        font-size: 1.1em;
        color: #333;
        flex-grow: 1;
    }

    .date {
        color: #666;
        font-size: 0.9em;
        margin: 0 20px;
        white-space: nowrap;
        min-width: 150px;
        text-align: right;
    }

    .expand-icon {
        font-size: 0.8em;
        color: #666;
        margin-left: 10px;
    }

    .notice-content {
        padding: 20px;
        border-top: 1px solid #eee;
    }

    .content {
        margin-bottom: 15px;
        line-height: 1.5;
        white-space: pre-wrap;
    }

    img {
        max-width: 100%;
        height: auto;
        border-radius: 4px;
        margin-top: 10px;
    }

    .action-buttons {
        display: flex;
        gap: 10px;
        padding: 0 10px;
    }

    .edit-button, .delete-button {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.9em;
        cursor: pointer;
        border: none;
    }

    .edit-button {
        background-color: #ffc107;
        color: black;
        text-decoration: none;
    }

    .delete-button {
        background-color: #dc3545;
        color: white;
        border: none;
    }

    .edit-button:hover {
        background-color: #e0a800;
    }

    .delete-button:hover {
        background-color: #c82333;
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
</style>