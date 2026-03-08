<script>
    import { onMount, onDestroy } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { supabase } from '$lib/supabase/client';
    import { initEditor, destroyEditor } from '$lib/ckeditor/config';

    const productID = $page.params.id;
    let editorElement;
    let toolbarElement;
    let editor;
    let uploadedImageUrl = '';

    let product = {
        title: '',
        content: '',
        image_url: ''
    };

    onMount(async () => {
        // 기존 제품 데이터 로드
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', productID)
            .single();

        if (error) {
            console.error('제품 로딩 에러:', error);
            return;
        }

        product = data;

        if (!editorElement || !toolbarElement) {
            console.error('Editor elements are not defined');
            return;
        }

        editor = await initEditor(
            editorElement,
            toolbarElement,
            product.content,
            (newContent) => {
                product.content = newContent;
            }
        );

        if (editor) {
            editor.plugins.get('FileRepository').createUploadAdapter = (loader) => {
                return {
                    upload: async () => {
                        const file = await loader.file;
                        const isGif = file.type === 'image/gif';
                        
                        if (isGif) {
                            const fileName = `${Date.now()}-image.gif`;
                            const { data, error } = await supabase.storage
                                .from('products')
                                .upload(`images/${fileName}`, file, {
                                    contentType: 'image/gif',
                                    cacheControl: '3600',
                                    upsert: true
                                });

                            if (error) throw error;

                            const { data: publicUrl } = supabase.storage
                                .from('products')
                                .getPublicUrl(`images/${fileName}`);

                            uploadedImageUrl = publicUrl.publicUrl;
                            return { default: publicUrl.publicUrl };
                        }
                        
                        // GIF가 아닌 경우 기존 로직 실행
                        const blob = await file;
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        const imgEl = new Image();
                        
                        await new Promise((resolve) => {
                            imgEl.onload = resolve;
                            imgEl.src = URL.createObjectURL(blob);
                        });
                        
                        canvas.width = imgEl.width;
                        canvas.height = imgEl.height;
                        ctx.drawImage(imgEl, 0, 0);
                        
                        const pngBlob = await new Promise(resolve => {
                            canvas.toBlob(resolve, 'image/png');
                        });
                        
                        const fileName = `${Date.now()}-image.png`;
                        const { data, error } = await supabase.storage
                            .from('products')
                            .upload(`images/${fileName}`, pngBlob, {
                                contentType: 'image/png',
                                cacheControl: '3600',
                                upsert: true
                            });

                        if (error) throw error;

                        const { data: publicUrl } = supabase.storage
                            .from('products')
                            .getPublicUrl(`images/${fileName}`);

                        uploadedImageUrl = publicUrl.publicUrl;
                        return { default: publicUrl.publicUrl };
                    },
                    abort: () => {}
                };
            };
        }
    });

    onDestroy(() => {
        destroyEditor();
    });

    async function handleSubmit() {
        try {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = product.content;
            const images = tempDiv.querySelectorAll('img');
            
            // 이미지 처리
            for (const img of images) {
                // 이미 업로드된 이미지는 건너뛰기
                if (img.src.includes('supabase.co')) continue;

                // GIF 파일이면 변환하지 않고 그대로 업로드
                if (img.src.toLowerCase().endsWith('.gif')) {
                    const response = await fetch(img.src);
                    const blob = await response.blob();
                    
                    const fileName = `${Date.now()}-image.gif`;
                    const { data, error } = await supabase.storage
                        .from('products')
                        .upload(`images/${fileName}`, blob, {
                            contentType: 'image/gif',
                            cacheControl: '3600',
                            upsert: true
                        });

                    if (error) throw error;

                    const { data: publicUrl } = supabase.storage
                        .from('products')
                        .getPublicUrl(`images/${fileName}`);

                    product.content = product.content.replace(img.src, publicUrl.publicUrl);
                    
                    if (!product.image_url) {
                        product.image_url = publicUrl.publicUrl;
                    }
                }
                // GIF가 아닌 이미지는 PNG로 변환
                else if (img.src.startsWith('data:image') || !img.src.endsWith('.png')) {
                    const response = await fetch(img.src);
                    const blob = await response.blob();
                    
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const imgEl = new Image();
                    
                    await new Promise((resolve) => {
                        imgEl.onload = resolve;
                        imgEl.src = URL.createObjectURL(blob);
                    });
                    
                    canvas.width = imgEl.width;
                    canvas.height = imgEl.height;
                    ctx.drawImage(imgEl, 0, 0);
                    
                    const pngBlob = await new Promise(resolve => {
                        canvas.toBlob(resolve, 'image/png');
                    });
                    
                    const fileName = `${Date.now()}-image.png`;
                    const { data, error } = await supabase.storage
                        .from('products')
                        .upload(`images/${fileName}`, pngBlob, {
                            contentType: 'image/png',
                            cacheControl: '3600',
                            upsert: true
                        });

                    if (error) throw error;

                    const { data: publicUrl } = supabase.storage
                        .from('products')
                        .getPublicUrl(`images/${fileName}`);

                    product.content = product.content.replace(img.src, publicUrl.publicUrl);
                    
                    if (!product.image_url) {
                        product.image_url = publicUrl.publicUrl;
                    }
                }
            }

            const { error } = await supabase
                .from('products')
                .update({
                    title: product.title,
                    content: product.content,
                    image_url: product.image_url,
                    updated_at: new Date().toISOString()
                })
                .eq('id', productID);

            if (error) throw error;
            goto('/products');
        } catch (error) {
            console.error('제품 수정 실패:', error);
            alert('제품 수정에 실패했습니다.');
        }
    }
</script>

<div class="container">
    <h1>상품 수정</h1>
    
    <form on:submit|preventDefault={handleSubmit}>
        <div class="form-group">
            <label for="product-title">제목</label>
            <input 
                type="text" 
                id="product-title" 
                bind:value={product.title} 
                required
            />
        </div>

        <div class="form-group">
            <label for="product-image">대표 이미지 URL (선택사항)</label>
            <input 
                type="url" 
                id="product-image" 
                bind:value={product.image_url} 
            />
        </div>

        <div class="form-group">
            <label for="product-content">내용</label>
            <div bind:this={toolbarElement} class="document-editor__toolbar"></div>
            <div class="document-editor__editable-container">
                <div id="product-content" bind:this={editorElement}></div>
            </div>
        </div>

        <div class="actions">
            <a href="/products" class="button">취소</a>
            <button type="submit" class="button submit">저장</button>
        </div>
    </form>
</div>

<style>
    .container {
        max-width: 800px;
        margin: 0 auto;
        padding: 1rem;
    }

    .form-group {
        margin-bottom: 1rem;
    }

    label {
        display: block;
        margin-bottom: 0.5rem;
    }

    input {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
    }

    .actions {
        display: flex;
        gap: 1rem;
        margin-top: 2rem;
    }

    .button {
        padding: 0.5rem 1rem;
        text-decoration: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .submit {
        background-color: #4CAF50;
        color: white;
        border: none;
    }

    .document-editor__toolbar {
        background: #f8f9fa;
        border: 1px solid #c4c4c4;
        padding: 0.5rem;
    }

    .document-editor__editable-container {
        border: 1px solid #c4c4c4;
        border-top: none;
    }

    :global(.ck-editor__editable) {
        min-height: 300px;
        padding: 1rem;
    }

    :global(.ck-toolbar) {
        border: none !important;
    }
</style>