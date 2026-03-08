<script>
    import { supabase } from '$lib/supabase/client';
    import { goto } from '$app/navigation';
    import { isAdmin } from '$lib/stores/auth';
    import { onMount } from 'svelte';
    
    onMount(async () => {
        if (!$isAdmin) {
            alert('관리자만 접근할 수 있습니다.');
            await goto('/notices');
        }
    });

    let title = '';
    let content = '';
    let imageFile;
    let loading = false;
    let error = null;

    async function handleSubmit() {
        try {
            loading = true;
            error = null;
            
            // 이미지 업로드 처리
            let imageUrl = null;
            if (imageFile) {
                const fileExt = imageFile.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;
                
                // Storage에 이미지 업로드
                const { error: uploadError, data } = await supabase.storage
                    .from('update_history-images')
                    .upload(`public/${fileName}`, imageFile);

                if (uploadError) throw uploadError;

                // 업로드된 이미지의 공개 URL 가져오기
                const { data: { publicUrl } } = supabase.storage
                    .from('update_history-images')
                    .getPublicUrl(`public/${fileName}`);
                
                imageUrl = publicUrl;
            }

            // 업데이트 내역 데이터 저장
            const { error: insertError } = await supabase
                .from('update_history')
                .insert([
                    {
                        title,
                        content,
                        image_url: imageUrl,
                        created_at: new Date().toISOString()
                    }
                ]);

            if (insertError) throw insertError;

            // 성공 시 목록 페이지로 이동
            await goto('/update_history');
            
        } catch (e) {
            console.error('Error:', e);
            error = '업데이트 내역 작성 중 오류가 발생했습니다.';
        } finally {
            loading = false;
        }
    }
</script>

<div class="container">
    <div class="header">
        <h1>업데이트 내역 작성</h1>
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
            <label for="image">이미지 첨부</label>
            <input 
                type="file" 
                id="image" 
                accept="image/*"
                on:change={(e) => imageFile = e.target.files[0]}
            >
            <small>* 선택사항</small>
        </div>

        {#if error}
            <div class="error-message">{error}</div>
        {/if}

        <div class="button-group">
            <button type="submit" disabled={loading}>
                {loading ? '저장 중...' : '작성하기'}
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
</style>