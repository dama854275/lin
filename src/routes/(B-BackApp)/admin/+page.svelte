<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';

    onMount(() => {
        goto('/admin/user_info', { replaceState: true });
    });
</script>

<div class="flex justify-center items-center h-screen">
    <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p class="text-gray-500">관리자 페이지로 이동 중...</p>
    </div>
</div>

<style>
    /* 화면 전체를 차지하도록 설정 */
    div {
        min-width: 100%;
        white-space: nowrap;
        overflow: visible;
    }
</style>
