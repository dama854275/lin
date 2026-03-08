<script>
    import { supabase } from '$lib/supabase/client';
    import { goto } from '$app/navigation';
    import { isAdmin } from '$lib/stores/auth';
    import { onMount } from 'svelte';
    
    onMount(async () => {
        if (!$isAdmin) {
            alert('관리자만 접근할 수 있습니다.');
            await goto('/faq');
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
            
            let imageUrl = null;
            if (imageFile) {
                const fileExt = imageFile.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;
                
                const { error: uploadError, data } = await supabase.storage
                    .from('faq-images')
                    .upload(`public/${fileName}`, imageFile);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('faq-images')
                    .getPublicUrl(`public/${fileName}`);
                
                imageUrl = publicUrl;
            }

            const { error: insertError } = await supabase
                .from('faqs')
                .insert([
                    {
                        title,
                        content,
                        image_url: imageUrl,
                        created_at: new Date().toISOString()
                    }
                ]);

            if (insertError) throw insertError;

            await goto('/faq');
            
        } catch (e) {
            console.error('Error:', e);
            error = 'FAQ 작성 중 오류가 발생했습니다.';
        } finally {
            loading = false;
        }
    }
</script>

<div class="container">
    <div class="header">
        <h1>FAQ 작성</h1>
        <a href="/faq" class="back-button">목록으로</a>
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