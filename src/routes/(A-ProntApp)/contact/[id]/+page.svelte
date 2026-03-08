<script>
    import { goto } from '$app/navigation';
    import { supabase } from '$lib/supabase/client';
    import { user } from '$lib/stores/auth';
    export let data;
    
    let answerText = data.contact.answer || '';
    let answerImage;
    let isEditing = false;
    let loading = false;
    let error = null;

    // 이미지 업로드 함수
    async function uploadImage(file) {
        if (!file) return null;
        
        const fileExt = file.name.split('.').pop();
        const fileName = `answer_${Date.now()}.${fileExt}`;
        
        const { error: uploadError, data } = await supabase.storage
            .from('inquiries-images')
            .upload(`public/${fileName}`, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('inquiries-images')
            .getPublicUrl(`public/${fileName}`);

        return publicUrl;
    }

    // 답변 저장 함수
    async function handleAnswer() {
        if (!data.isAdmin) return;
        
        try {
            loading = true;
            error = null;

            let imageUrl = data.contact.answer_image_url;

            // 새 이미지가 선택된 경우
            if (answerImage) {
                // 기존 이미지가 있다면 삭제
                if (imageUrl) {
                    const oldPath = imageUrl.split('/').pop();
                    await supabase.storage
                        .from('inquiries-images')
                        .remove([`public/${oldPath}`]);
                }
                
                // 새 이미지 업로드
                imageUrl = await uploadImage(answerImage);
            }

            const { error: updateError } = await supabase
                .from('contacts')
                .update({
                    answer: answerText,
                    answer_image_url: imageUrl,
                    answered_at: new Date().toISOString(),
                    status: 'completed'
                })
                .eq('id', data.contact.id);

            if (updateError) throw updateError;

            isEditing = false;
            window.location.reload();
            
        } catch (e) {
            error = e.message || '답변 저장 중 오류가 발생했습니다.';
        } finally {
            loading = false;
        }
    }

    // 답변 삭제 함수
    async function handleDeleteAnswer() {
        if (!data.isAdmin || !confirm('답변을 삭제하시겠습니까?')) return;

        try {
            loading = true;
            error = null;

            // 이미지가 있다면 삭제
            if (data.contact.answer_image_url) {
                const oldPath = data.contact.answer_image_url.split('/').pop();
                await supabase.storage
                    .from('inquiries-images')
                    .remove([`public/${oldPath}`]);
            }

            const { error: updateError } = await supabase
                .from('contacts')
                .update({
                    answer: null,
                    answer_image_url: null,
                    answered_at: null,
                    status: 'pending'
                })
                .eq('id', data.contact.id);

            if (updateError) throw updateError;

            window.location.reload();
            
        } catch (e) {
            error = e.message || '답변 삭제 중 오류가 발생했습니다.';
        } finally {
            loading = false;
        }
    }

    function formatDate(dateString) {
        if (!dateString) return '';
        
        return new Date(dateString).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async function handleDelete() {
        if (!confirm('정말 삭제하시겠습니까?')) return;

        try {
            const { error } = await supabase
                .from('contacts')
                .delete()
                .eq('id', data.contact.id);

            if (error) throw error;

            await goto('/contact');
        } catch (err) {
            alert('삭제 중 오류가 발생했습니다.');
            console.error('Delete error:', err);
        }
    }
</script>

<div class="container mx-auto px-4 py-8 max-w-3xl">
    <div class="bg-white rounded-lg shadow-lg overflow-hidden">
        <!-- 헤더 -->
        <div class="p-6 border-b">
            <div class="flex justify-between items-center mb-4">
                <h1 class="text-2xl font-bold">{data.contact.title}</h1>
                <div class="flex gap-2">
                    {#if !data.contact.answer}
                        <a 
                            href="/contact/{data.contact.id}/edit" 
                            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            수정
                        </a>
                        <button 
                            on:click={handleDelete}
                            class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                            삭제
                        </button>
                    {/if}
                    <a 
                        href="/contact" 
                        class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                        목록
                    </a>
                </div>
            </div>
            <div class="text-sm text-gray-500">
                작성일: {formatDate(data.contact.created_at)}
            </div>
        </div>

        <!-- 본문 -->
        <div class="p-6">
            {#if data.contact.image_url}
                <div class="mb-6">
                    <img 
                        src={data.contact.image_url} 
                        alt="문의 이미지" 
                        class="max-w-full rounded-lg"
                    />
                </div>
            {/if}
            <div class="prose max-w-none whitespace-pre-wrap">
                {data.contact.content}
            </div>
        </div>

        <!-- 답변 섹션 -->
        {#if data.contact.answer}
            <div class="p-6 bg-gray-50 mt-4 border-t">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-lg font-semibold">답변</h2>
                    {#if data.isAdmin}
                        <div class="flex gap-2">
                            <button 
                                on:click={() => isEditing = true}
                                class="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                            >
                                수정
                            </button>
                            <button 
                                on:click={handleDeleteAnswer}
                                class="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                            >
                                삭제
                            </button>
                        </div>
                    {/if}
                </div>
                
                {#if isEditing && data.isAdmin}
                    <div class="mb-4">
                        <textarea
                            bind:value={answerText}
                            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 h-32"
                            placeholder="답변을 입력하세요..."
                        ></textarea>
                    </div>
                    <div class="mb-4">
                        <label 
                            for="edit-answer-image" 
                            class="block text-sm font-medium text-gray-700 mb-2"
                        >
                            답변 이미지
                        </label>
                        {#if data.contact.answer_image_url}
                            <div class="mb-2">
                                <img 
                                    src={data.contact.answer_image_url} 
                                    alt="현재 답변 이미지" 
                                    class="max-h-40 rounded"
                                />
                            </div>
                        {/if}
                        <input 
                            id="edit-answer-image"
                            type="file"
                            accept="image/*"
                            on:change={(e) => answerImage = e.target.files[0]}
                            class="w-full"
                        />
                        <p class="text-sm text-gray-500 mt-1">* 새 이미지를 선택하면 기존 이미지는 삭제됩니다.</p>
                    </div>
                    {#if error}
                        <div class="mb-4 p-3 bg-red-100 text-red-700 rounded">
                            {error}
                        </div>
                    {/if}
                    <div class="flex gap-2 justify-end">
                        <button
                            on:click={() => isEditing = false}
                            class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                        >
                            취소
                        </button>
                        <button
                            on:click={handleAnswer}
                            disabled={loading || !answerText.trim()}
                            class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
                        >
                            {loading ? '저장 중...' : '저장'}
                        </button>
                    </div>
                {:else}
                    {#if data.contact.answer_image_url}
                        <div class="mb-4">
                            <img 
                                src={data.contact.answer_image_url} 
                                alt="답변 이미지" 
                                class="max-w-full rounded-lg"
                            />
                        </div>
                    {/if}
                    <div class="prose max-w-none whitespace-pre-wrap">
                        {data.contact.answer}
                    </div>
                    <div class="text-sm text-gray-500 mt-2">
                        {#if data.contact.answered_at}
                            답변일: {formatDate(data.contact.answered_at)}
                        {/if}
                    </div>
                {/if}
            </div>
        {:else if data.isAdmin}
            <div class="p-6 bg-gray-50 mt-4 border-t">
                <h2 class="text-lg font-semibold mb-4">답변 작성</h2>
                <div class="mb-4">
                    <textarea
                        bind:value={answerText}
                        class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 h-32"
                        placeholder="답변을 입력하세요..."
                    ></textarea>
                </div>
                <div class="mb-4">
                    <label 
                        for="new-answer-image" 
                        class="block text-sm font-medium text-gray-700 mb-2"
                    >
                        답변 이미지
                    </label>
                    <input 
                        id="new-answer-image"
                        type="file"
                        accept="image/*"
                        on:change={(e) => answerImage = e.target.files[0]}
                        class="w-full"
                    />
                </div>
                {#if error}
                    <div class="mb-4 p-3 bg-red-100 text-red-700 rounded">
                        {error}
                    </div>
                {/if}
                <button
                    on:click={handleAnswer}
                    disabled={loading || !answerText.trim()}
                    class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
                >
                    {loading ? '저장 중...' : '답변 저장'}
                </button>
            </div>
        {/if}

        <!-- 상태 표시 -->
        <div class="p-6 border-t">
            <span class={`px-3 py-1 rounded-full text-sm ${
                data.contact.status === 'pending' 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-green-100 text-green-800'
            }`}>
                {data.contact.status === 'pending' ? '답변 대기중' : '답변 완료'}
            </span>
        </div>
    </div>
</div>

<style>
    .prose {
        line-height: 1.6;
    }
</style>