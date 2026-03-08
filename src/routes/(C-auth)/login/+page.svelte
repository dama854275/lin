<script>
    import { supabase } from '$lib/supabase/client';
    import { user } from '$lib/stores/auth'
    import { goto } from '$app/navigation';
    
    let email = '';
    let password = '';
    let loading = false;
    let error = null;

    async function handleLogin() {
        try {
            loading = true;
            error = null;
            
            const { data, error: err } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (err) throw err;
            
            goto('/'); // 로그인 성공 시 메인 페이지로 이동
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
        }
    }
</script>

<div class="min-h-screen bg-gradient-to-br from-sky-50 to-violet-50 py-12">
    <div class="container mx-auto px-4">
        <div class="max-w-md mx-auto">
            <div class="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-sky-100">
                <div class="px-8 py-10">
                    <h2 class="text-3xl font-bold text-center text-gray-800 mb-2">로그인</h2>
                    <p class="text-center text-gray-500 text-sm mb-8">환영합니다! 계정에 로그인해주세요.</p>
                    
                    <form class="space-y-6" on:submit|preventDefault={handleLogin}>
                        {#if error}
                            <div class="bg-red-50 border-l-4 border-red-300 p-4 rounded-lg">
                                <div class="flex">
                                    <div class="flex-shrink-0">
                                        <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                                        </svg>
                                    </div>
                                    <div class="ml-3">
                                        <p class="text-sm text-red-700">{error}</p>
                                    </div>
                                </div>
                            </div>
                        {/if}

                        <div class="space-y-2">
                            <label for="email" class="block text-sm font-medium text-gray-700">이메일</label>
                            <input
                                id="email"
                                type="email"
                                bind:value={email}
                                required
                                class="mt-1 block w-full px-4 py-3 border border-sky-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300 bg-white/70"
                                placeholder="이메일을 입력하세요"
                            />
                        </div>

                        <div class="space-y-2">
                            <label for="password" class="block text-sm font-medium text-gray-700">비밀번호</label>
                            <input
                                id="password"
                                type="password"
                                bind:value={password}
                                required
                                class="mt-1 block w-full px-4 py-3 border border-sky-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300 bg-white/70"
                                placeholder="비밀번호를 입력하세요"
                            />
                        </div>

                        <div class="pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                class="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-sky-400 to-violet-400 hover:from-sky-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                {loading ? '로그인 중...' : '로그인'}
                            </button>
                        </div>

                        <div class="text-sm text-center pt-4">
                            <a href="/register" class="font-medium text-sky-600 hover:text-sky-500 transition-colors duration-200">
                                계정이 없으신가요? 회원가입
                            </a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>