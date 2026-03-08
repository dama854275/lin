<script>
    import { supabase } from '$lib/supabase/client';
    import { goto } from '$app/navigation';
    import { user } from '$lib/stores/auth';
    import { onMount } from 'svelte';
    
    export let data;

    let title = data.contact.title;
    let content = data.contact.content;
    let imageFile;
    let loading = false;
    let error = null;
    let classification = data.contact.classification || '';
    let gameClassification = data.contact.game_classification || '';

    const classifications = [
        { value: '', label: '분류를 선택하세요' },
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
        { value: 'lodenine', label: '로드나인' }
    ];

    onMount(() => {
        if (!$user) {
            alert('로그인이 필요합니다.');
            goto('/login');
        }
        
        if (data.contact.answer) {
            alert('이미 답변이 있는 문의글은 수정할 수 없습니다.');
            goto(`/contact/${data.contact.id}`);
        }
    });

    async function handleSubmit() {
        try {
            if (!$user) {
                throw new Error('로그인이 필요합니다.');
            }

            loading = true;
            error = null;

            let imageUrl = data.contact.image_url;
            if (imageFile) {
                // 기존 이미지가 있다면 삭제
                if (imageUrl) {
                    const oldPath = imageUrl.split('/').pop();
                    await supabase.storage
                        .from('inquiries-images')
                        .remove([`public/${oldPath}`]);
                }

                // 새 이미지 업로드
                const fileExt = imageFile.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('inquiries-images')
                    .upload(`public/${fileName}`, imageFile);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('inquiries-images')
                    .getPublicUrl(`public/${fileName}`);
                
                imageUrl = publicUrl;
            }

            const { error: updateError } = await supabase
                .from('contacts')
                .update({
                    title,
                    content,
                    image_url: imageUrl,
                    classification,
                    game_classification: classification === 'game_error' ? gameClassification : null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', data.contact.id);

            if (updateError) throw updateError;

            await goto(`/contact/${data.contact.id}`);
            
        } catch (e) {
            error = e.message || '문의글 수정 중 오류가 발생했습니다.';
        } finally {
            loading = false;
        }
    }
</script>

<div class="container mx-auto px-4 py-8 max-w-3xl">
    <div class="bg-white rounded-lg shadow-lg p-6">
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-2xl font-bold">문의글 수정</h1>
            <a 
                href="/contact/{data.contact.id}" 
                class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
                취소
            </a>
        </div>

        <form on:submit|preventDefault={handleSubmit}>
            <div class="mb-4">
                <label for="title" class="block text-gray-700 font-bold mb-2">제목</label>
                <input 
                    type="text" 
                    id="title"
                    bind:value={title}
                    class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                    required
                />
            </div>

            <div class="mb-4">
                <label for="classification" class="block text-gray-700 font-bold mb-2">분류</label>
                <select 
                    id="classification"
                    bind:value={classification}
                    class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                    required
                >
                    {#each classifications as option}
                        <option value={option.value}>{option.label}</option>
                    {/each}
                </select>
            </div>

            {#if classification === 'game_error'}
                <div class="mb-4">
                    <label for="game-classification" class="block text-gray-700 font-bold mb-2">게임 분류</label>
                    <select 
                        id="game-classification"
                        bind:value={gameClassification}
                        class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                        required
                    >
                        {#each gameClassifications as option}
                            <option value={option.value}>{option.label}</option>
                        {/each}
                    </select>
                </div>
            {/if}

            <div class="mb-4">
                <label for="content" class="block text-gray-700 font-bold mb-2">내용</label>
                <textarea 
                    id="content"
                    bind:value={content}
                    class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 h-48"
                    required
                ></textarea>
            </div>

            <div class="mb-6">
                <label for="image" class="block text-gray-700 font-bold mb-2">이미지</label>
                {#if data.contact.image_url}
                    <div class="mb-2">
                        <img 
                            src={data.contact.image_url} 
                            alt="현재 이미지" 
                            class="max-h-40 rounded"
                        />
                    </div>
                {/if}
                <input 
                    type="file"
                    id="image"
                    accept="image/*"
                    on:change={(e) => imageFile = e.target.files[0]}
                    class="w-full"
                />
                <p class="text-sm text-gray-500 mt-1">* 새 이미지를 선택하면 기존 이미지는 삭제됩니다.</p>
            </div>

            {#if error}
                <div class="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
                    {error}
                </div>
            {/if}

            <div class="flex justify-end">
                <button 
                    type="submit"
                    class="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                    disabled={loading}
                >
                    {loading ? '저장 중...' : '수정하기'}
                </button>
            </div>
        </form>
    </div>
</div>