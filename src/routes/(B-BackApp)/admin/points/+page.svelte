<script>
    import { supabase } from '$lib/supabase/client';
    import { onMount } from 'svelte';

    let pointLogs = [];
    let email = '';
    let pointAmount = 0;
    let description = '';
    let loading = false;
    let message = '';
    let userPoints = null;
    let isValidUser = false;
    let isAdmin = false;
    let userId = null;
    let adminEmail = '';

    onMount(async () => {
        await checkAdminStatus();
        await loadPointLogs();
    });

    async function checkAdminStatus() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            message = '로그인이 필요합니다.';
            return;
        }

        const { data, error } = await supabase
            .from('admin_users')
            .select('user_id')
            .eq('user_id', user.id)
            .single();

        if (error || !data) {
            message = '관리자 권한이 없습니다.';
            isAdmin = false;
        } else {
            isAdmin = true;
            adminEmail = user.email;
        }
    }

    async function loadPointLogs() {
        const { data, error } = await supabase
            .from('point_admin_logs')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('포인트 로그 로딩 실패:', error);
            return;
        }
        
        pointLogs = data;
    }

    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    async function verifyUser() {
        if (!isValidEmail(email)) {
            message = '유효한 이메일 형식이 아닙니다.';
            isValidUser = false;
            userPoints = null;
            userId = null;
            return;
        }

        loading = true;
        message = '';

        try {
            const { data, error } = await supabase
                .from('user_info')
                .select('points, user_id')
                .eq('email', email)
                .single();

            if (error) {
                message = '등록되지 않은 사용자입니다.';
                isValidUser = false;
                userPoints = null;
                userId = null;
            } else {
                message = '확인된 사용자입니다.';
                isValidUser = true;
                userPoints = data.points;
                userId = data.user_id;
            }
        } catch (err) {
            console.error('사용자 확인 실패:', err);
            message = '사용자 확인 중 오류가 발생했습니다.';
            isValidUser = false;
            userPoints = null;
            userId = null;
        } finally {
            loading = false;
        }
    }

    $: if (email) {
        isValidUser = false;
        userPoints = null;
        userId = null;
        message = '';
    }

    async function handlePointsUpdate() {
        if (!isAdmin) {
            message = '관리자 권한이 없습니다.';
            return;
        }

        if (!isValidUser) {
            message = '먼저 사용자 확인을 해주세요.';
            return;
        }

        if (!pointAmount) {
            message = '포인트 금액을 입력해주세요.';
            return;
        }

        loading = true;
        message = '';

        try {
            // RPC 함수를 사용하여 포인트 업데이트
            const { error: rpcError } = await supabase
                .rpc('update_user_points', {
                    user_id_input: userId,
                    points_to_add: pointAmount
                });

            if (rpcError) throw rpcError;

            const { error: logError } = await supabase
                .from('point_admin_logs')
                .insert({
                    email: email,
                    amount: pointAmount,
                    description: description,
                    admin_email: adminEmail
                });

            if (logError) throw logError;

            message = '포인트가 성공적으로 업데이트되었습니다.';
            await loadPointLogs();
            userPoints += pointAmount;
            
            pointAmount = 0;
            description = '';

        } catch (error) {
            console.error('포인트 업데이트 실패:', error);
            message = '오류가 발생했습니다. 다시 시도해주세요.';
        } finally {
            loading = false;
        }
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(date);
    }
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-6">포인트 지급/회수</h1>

    <div class="bg-white rounded-lg shadow p-6 mb-6">
        <div class="mb-4">
            <label 
                for="userEmail" 
                class="block text-sm font-medium text-gray-700 mb-2"
            >
                사용자 이메일
            </label>
            <div class="flex gap-2">
                <input
                    id="userEmail"
                    type="email"
                    bind:value={email}
                    placeholder="사용자 이메일을 입력하세요"
                    class="flex-1 p-2 border rounded"
                />
                <button
                    on:click={verifyUser}
                    disabled={loading || !email}
                    class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 disabled:bg-gray-300"
                >
                    사용자 확인
                </button>
            </div>
            {#if userPoints !== null}
                <p class="mt-2 text-sm text-gray-600">
                    현재 포인트: {userPoints.toLocaleString()}
                </p>
            {/if}
        </div>

        <div class="mb-4">
            <label 
                for="pointAmount" 
                class="block text-sm font-medium text-gray-700 mb-2"
            >
                포인트 금액
            </label>
            <input
                id="pointAmount"
                type="number"
                bind:value={pointAmount}
                placeholder="양수: 지급, 음수: 회수"
                class="w-full p-2 border rounded"
                disabled={!isValidUser}
            />
        </div>

        <div class="mb-4">
            <label 
                for="description" 
                class="block text-sm font-medium text-gray-700 mb-2"
            >
                설명
            </label>
            <textarea
                id="description"
                bind:value={description}
                placeholder="지급/회수 사유를 입력하세요"
                class="w-full p-2 border rounded"
                rows="3"
                disabled={!isValidUser}
            ></textarea>
        </div>

        <button
            on:click={handlePointsUpdate}
            disabled={loading || !isValidUser}
            class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
            {loading ? '처리중...' : '포인트 업데이트'}
        </button>

        {#if message}
            <div class="mt-4 p-3 rounded {message.includes('확인된') ? 'bg-green-100 text-green-700' : message.includes('오류') || message.includes('등록되지') ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}">
                {message}
            </div>
        {/if}
    </div>

    <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-bold mb-4">포인트 지급/회수 내역</h2>
        <div class="overflow-x-auto">
            <table class="min-w-full">
                <thead>
                    <tr class="bg-gray-100">
                        <th class="px-4 py-2 text-left">일시</th>
                        <th class="px-4 py-2 text-left">대상 이메일</th>
                        <th class="px-4 py-2 text-right">포인트</th>
                        <th class="px-4 py-2 text-left">설명</th>
                        <th class="px-4 py-2 text-left">관리자</th>
                    </tr>
                </thead>
                <tbody>
                    {#each pointLogs as log}
                        <tr class="border-t">
                            <td class="px-4 py-2">{formatDate(log.created_at)}</td>
                            <td class="px-4 py-2">{log.email}</td>
                            <td class="px-4 py-2 text-right {log.amount > 0 ? 'text-green-600' : 'text-red-600'}">
                                {log.amount > 0 ? '+' : ''}{log.amount.toLocaleString()}
                            </td>
                            <td class="px-4 py-2">{log.description || '-'}</td>
                            <td class="px-4 py-2">{log.admin_email || '-'}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>
</div>
