<script>
    import { supabase } from '$lib/supabase/client';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { isAdmin } from '$lib/stores/auth';
    import { onMount } from 'svelte';
    
    onMount(async () => {
        if (!$isAdmin) {
            alert('관리자만 접근할 수 있습니다.');
            await goto('/update_history');
        }
    });

    let title = '';
    let content = '';
    let imageFile;
    let currentImageUrl = '';
    let loading = false;
    let error = null;

    // 현재 공지사항 데이터 로드
    async function loadUpdate() {
        const { data, error } = await supabase
            .from('update_history')
            .select('*')
            .eq('id', $page.params.id)
            .single();

        if (error) {
            console.error('Error:', error);
            return;
        }

        title = data.title;
        content = data.content;
        currentImageUrl = data.image_url;
    }

    loadUpdate();

    async function handleSubmit() {
        try {
            loading = true;
            error = null;
            
            let imageUrl = currentImageUrl;

            // 새 이미지가 선택된 경우
            if (imageFile) {
                // 기존 이미지 삭제
                if (currentImageUrl) {
                    const oldImagePath = currentImageUrl.split('/').pop();
                    await supabase.storage
                        .from('update_history-images')
                        .remove([`public/${oldImagePath}`]);
                }

                // 새 이미지 업로드
                const fileExt = imageFile.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('update_history-images')
                    .upload(`public/${fileName}`, imageFile);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('update_history-images')
                    .getPublicUrl(`public/${fileName}`);
                
                imageUrl = publicUrl;
            }

            // 공지사항 업데이트
            const { error: updateError } = await supabase
                .from('update_history')
                .update({
                    title,
                    content,
                    image_url: imageUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', $page.params.id);

            if (updateError) throw updateError;

            await goto('/update_history');
            
        } catch (e) {
            console.error('Error:', e);
            error = '공지사항 수정 중 오류가 발생했습니다.';
        } finally {
            loading = false;
        }
    }
</script>

<div class="container">
    <div class="header">
        <h1>공지사항 수정</h1>
        <a href="/update_history" class="back-button">목록으로</a>
    </div>

    <form on:submit|preventDefault={handleSubmit}>
        <div class="form-group">
            <label for="title">제목</label>
            <input 
                type="text" 
                id="title" 
                bind:value={title} 
                required 
                placeholder="제목을 입력하세요"
            >
        </div>

        <div class="form-group">
            <label for="content">내용</label>
            <textarea 
                id="content" 
                bind:value={content} 
                required 
                placeholder="내용을 입력하세요"
            ></textarea>
        </div>

        <div class="form-group">
            {#if currentImageUrl}
                <div class="current-image">
                    <p>현재 이미지:</p>
                    <img src={currentImageUrl} alt="현재 이미지" />
                </div>
            {/if}
            <label for="image">새 이미지 첨부</label>
            <input 
                type="file" 
                id="image" 
                accept="image/*"
                on:change={(e) => imageFile = e.target.files[0]}
            >
            <small>* 새 이미지를 선택하면 기존 이미지는 삭제됩니다</small>
        </div>

        {#if error}
            <div class="error-message">{error}</div>
        {/if}

        <div class="button-group">
            <button type="submit" disabled={loading}>
                {loading ? '저장 중...' : '수정하기'}
            </button>
        </div>
    </form>
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

    .back-button {
        padding: 8px 16px;
        background-color: #6c757d;
        color: white;
        text-decoration: none;
        border-radius: 4px;
    }

    .back-button:hover {
        background-color: #5a6268;
    }

    .form-group {
        margin-bottom: 20px;
    }

    label {
        display: block;
        margin-bottom: 8px;
        font-weight: bold;
    }

    input[type="text"],
    textarea {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 1em;
    }

    textarea {
        height: 200px;
        resize: vertical;
    }

    small {
        color: #666;
        margin-left: 8px;
    }

    .error-message {
        color: #dc3545;
        margin-bottom: 20px;
        padding: 10px;
        background-color: #f8d7da;
        border-radius: 4px;
    }

    .button-group {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    }

    button {
        padding: 10px 20px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1em;
    }

    button:disabled {
        background-color: #cccccc;
        cursor: not-allowed;
    }

    button:hover:not(:disabled) {
        background-color: #45a049;
    }

    .current-image {
        margin-bottom: 15px;
        border: 1px solid #ddd;
        padding: 10px;
        border-radius: 4px;
        background-color: #f8f9fa;
    }

    .current-image p {
        margin: 0 0 10px 0;
        font-weight: bold;
        color: #666;
    }

    .current-image img {
        max-width: 200px;
        height: auto;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    input[type="file"] {
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        width: 100%;
        background-color: white;
    }

    input[type="file"]:hover {
        border-color: #4CAF50;
    }
</style>