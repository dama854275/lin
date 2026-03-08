<script>
    import { supabase } from '$lib/supabase/client';
    import { goto } from '$app/navigation';
    import { user } from '$lib/stores/auth';
    import { onMount } from 'svelte';
    
    onMount(async () => {
        if (!$user) {
            alert('로그인이 필요합니다.');
            await goto('/login');
        }
    });

    let title = '';
    let content = '';
    let imageFile;
    let loading = false;
    let error = null;
    let classification = ''; // 기본값을 빈 문자열로 설정
    let gameClassification = ''; // 게임 분류 선택값

    const classifications = [
        { value: '', label: '분류를 선택하세요' }, // 기본 옵션 추가
        { value: 'game_error', label: '게임 오류 보고' },
        { value: 'billing', label: '결제 문의' },
        { value: 'suggestion', label: '개선 제안' },
        { value: 'other', label: '기타' }
    ];

    const gameClassifications = [
        { value: '', label: '게임을 선택하세요' },
        { value: 'odin', label: '오딘' },
        { value: 'rom', label: 'ROM' },
        { value: 'asdal', label: '아스달 연대기' },
        { value: 'xenonia', label: '제노니아' },
        { value: 'night_crow', label: '나이트 크로우' },
        { value: 'raven2', label: '레이븐2' },
        { value: 'archeage', label: '아키에이지 워' },
        { value: 'ymir', label: '이미르' },
        { value: 'RF', label: 'RF' },
        { value: 'lodenine', label: '로드나인' }
    ];

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    
    async function handleSubmit() {
        try {
            if (!$user) {
                throw new Error('로그인이 필요합니다.');
            }

            // 분류 선택 검증
            if (!classification) {
                throw new Error('분류를 선택해주세요.');
            }

            // 게임 오류 보고 선택 시 게임 분류 검증
            if (classification === 'game_error' && !gameClassification) {
                throw new Error('게임을 선택해주세요.');
            }

            // 파일 크기 체크
            if (imageFile && imageFile.size > MAX_FILE_SIZE) {
                throw new Error('이미지 크기는 5MB를 초과할 수 없습니다.');
            }

            loading = true;
            error = null;

            let imageUrl = null;
            if (imageFile) {
                const fileExt = imageFile.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;
                
                // 재시도 로직 추가
                let retries = 3;
                let uploadError;
                
                while (retries > 0) {
                    const { error: err, data } = await supabase.storage
                        .from('inquiries-images')
                        .upload(`public/${fileName}`, imageFile, {
                            cacheControl: '3600',
                            upsert: false
                        });
                    
                    if (!err) {
                        const { data: { publicUrl } } = supabase.storage
                            .from('inquiries-images')
                            .getPublicUrl(`public/${fileName}`);
                        
                        imageUrl = publicUrl;
                        break;
                    }
                    
                    uploadError = err;
                    retries--;
                    if (retries > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
                    }
                }

                if (!imageUrl) throw uploadError;
            }

            const newContact = {
                title,
                content,
                status: 'pending',
                user_id: $user.id,
                user_email: $user.email,
                classification,
                game_classification: classification === 'game_error' ? gameClassification : null
            };

            if (imageUrl) {
                newContact.image_url = imageUrl;
            }

            const { error: insertError, data } = await supabase
                .from('contacts')
                .insert([newContact])
                .select()
                .single();

            if (insertError) {
                console.error('Insert Error:', insertError);
                throw insertError;
            }

            // 텔레그램 메시지 전송 추가
            const telegramBotToken = '7623818010:AAEE0M1zVDqVBhIxzrOkawULt3PvbwUjn8g';
            const chatId = '7274382685';
            const message = `
📝 새로운 문의글 등록
━━━━━━━━━━━━━━━━━━
• 아이디: ${$user.email}
• 날짜: ${new Date().toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
})}
• 제목: ${title}
━━━━━━━━━━━━━━━━━━`;

            await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });

            await goto('/contact');
            
        } catch (e) {
            console.error('Error:', e);
            error = e.message || '문의글 작성 중 오류가 발생했습니다.';
        } finally {
            loading = false;
        }
    }
</script>

<div class="container">
    <div class="header">
        <h1>1:1 문의하기</h1>
        <a href="/contact" class="back-button">목록으로</a>
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
            <label for="classification">분류</label>
            <select 
                id="classification" 
                bind:value={classification}
                required
            >
                {#each classifications as option}
                    <option value={option.value}>{option.label}</option>
                {/each}
            </select>
            <div class="help-text">
                <p>게임 오류 보고 시에는 '분류'에서 '게임 오류 보고'를 선택 후 정확한 게임을 선택해주셔야 합니다</p>
                <p>정확하게 분류를 선택하지 않을 경우 담당 관리자 님이 글을 볼수 없습니다</p>
            </div>
        </div>

        {#if classification === 'game_error'}
            <div class="form-group">
                <label for="game-classification">게임 분류</label>
                <select 
                    id="game-classification" 
                    bind:value={gameClassification}
                    required
                >
                    {#each gameClassifications as option}
                        <option value={option.value}>{option.label}</option>
                    {/each}
                </select>
            </div>
        {/if}

        <div class="form-group">
            <label for="content">내용</label>
            <textarea 
                id="content" 
                bind:value={content} 
                required 
                placeholder="문의하실 내용을 자세히 입력해주세요"
            ></textarea>
        </div>

        <div class="form-group">
            <label for="image">이미지 첨부</label>
            <input 
                type="file" 
                id="image" 
                accept="image/*"
                on:change={(e) => {
                    const file = e.target.files[0];
                    if (file && file.size > MAX_FILE_SIZE) {
                        alert('이미지 크기는 5MB를 초과할 수 없습니다.');
                        e.target.value = '';
                        return;
                    }
                    imageFile = file;
                }}
            >
            <small>* 선택사항 (최대 5MB)</small>
        </div>

        {#if error}
            <div class="error-message">{error}</div>
        {/if}

        <div class="button-group">
            <button type="submit" disabled={loading}>
                {loading ? '저장 중...' : '문의하기'}
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
    textarea,
    select {
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

    .help-text {
        margin-top: 8px;
        padding: 10px;
        background-color: #f8f9fa;
        border-left: 4px solid #007bff;
        border-radius: 4px;
    }

    .help-text p {
        margin: 0 0 5px 0;
        font-size: 0.9em;
        color: #495057;
        line-height: 1.4;
    }

    .help-text p:last-child {
        margin-bottom: 0;
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