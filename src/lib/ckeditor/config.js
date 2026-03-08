import { supabase } from '$lib/supabase/client';

let editorInstance = null;

class SupabaseUploadAdapter {
    constructor(loader) {
        this.loader = loader;
    }

    async upload() {
        try {
            let file = await this.loader.file;
            
            // base64 문자열이 들어온 경우 파일로 변환
            if (typeof file === 'string' && file.startsWith('data:image')) {
                const response = await fetch(file);
                const blob = await response.blob();
                file = new File([blob], `image-${Date.now()}.png`, { type: 'image/png' });
            }

            const fileName = `${Date.now()}-${file.name.replace(/\.[^/.]+$/, '')}.png`;
            
            // 파일을 PNG로 변환
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            await new Promise((resolve) => {
                img.onload = resolve;
                img.src = URL.createObjectURL(file);
            });
            
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const pngBlob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png');
            });

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

            return {
                default: publicUrl.publicUrl
            };
        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    }

    abort() {
        // 업로드 취소 로직
    }
}

export async function initEditor(element, toolbarElement, initialData = '', onChange = () => {}) {
    if (editorInstance) {
        await destroyEditor();
    }

    try {
        const editor = await window.CKEDITOR.ClassicEditor.create(element, {
            collaboration: {
                channelId: 'document-1'
            },
            removePlugins: [
                'CKBox', 'CKFinder', 'EasyImage', 
                'RealTimeCollaborativeComments', 'RealTimeCollaborativeTrackChanges', 
                'RealTimeCollaborativeRevisionHistory', 'PresenceList', 'Comments', 
                'TrackChanges', 'TrackChangesData', 'RevisionHistory', 'Pagination', 
                'WProofreader', 'MathType', 'SlashCommand', 'Template', 'DocumentOutline', 
                'FormatPainter', 'TableOfContents', 'PasteFromOfficeEnhanced',
                'AIAssistant', 'TextPartLanguage', 'TextTransformation', 'Style'
            ],
            toolbar: {
                items: [
                    'undo', 'redo', '|',
                    'heading', '|',
                    'fontFamily', 'fontSize', '|',
                    'fontColor', 'fontBackgroundColor', '|',
                    'bold', 'italic', 'strikethrough', 'underline', '|',
                    'alignment', '|',
                    'numberedList', 'bulletedList', '|',
                    'outdent', 'indent', '|',
                    'link', 'blockQuote', '|',
                    'horizontalLine', '|',
                    'insertTable', '|',
                    'imageUpload', 'mediaEmbed'
                ]
            },
            horizontalLine: {
                styles: {
                    'border-bottom': '2px solid #bbb',
                    'border-top': '2px solid #bbb'
                }
            },
            image: {
                styles: ['alignLeft', 'alignCenter', 'alignRight'],
                resizeOptions: [
                    {
                        name: 'imageResize:original',
                        value: null,
                        label: 'Original'
                    },
                    {
                        name: 'imageResize:50',
                        value: '50',
                        label: '50%'
                    },
                    {
                        name: 'imageResize:75',
                        value: '75',
                        label: '75%'
                    }
                ],
                toolbar: [
                    'imageStyle:alignLeft',
                    'imageStyle:alignCenter',
                    'imageStyle:alignRight',
                    '|',
                    'imageResize',
                    '|',
                    'imageTextAlternative'
                ]
            },
            extraPlugins: [
                function(editor) {
                    editor.plugins.get('FileRepository').createUploadAdapter = (loader) => {
                        return new SupabaseUploadAdapter(loader);
                    };
                }
            ]
        });

        editor.ui.view.toolbar.element.style.display = 'none';
        toolbarElement.appendChild(editor.ui.view.toolbar.element);
        editor.ui.view.toolbar.element.style.display = 'flex';
        
        editor.setData(initialData || '');
        editor.model.document.on('change:data', () => {
            onChange(editor.getData());
        });

        editorInstance = editor;
        return editor;
    } catch (error) {
        console.error('Editor initialization failed:', error);
        return null;
    }
}

export async function destroyEditor() {
    if (editorInstance) {
        try {
            await editorInstance.destroy();
            editorInstance = null;
        } catch (error) {
            console.error('Editor destruction failed:', error);
        }
    }
}