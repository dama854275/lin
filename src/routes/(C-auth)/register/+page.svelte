<script>
    import { supabase } from '$lib/supabase/client';
    import { goto } from '$app/navigation';

    let email = '';
    let password = '';
    let confirmPassword = '';
    let loading = false;
    let error = null;
    let referrerId = '';

    async function handleRegister() {
        try {
            if (password !== confirmPassword) {
                error = '비밀번호가 일치하지 않습니다.';
                return;
            }

            loading = true;
            error = null;

            let referrerUserId = null;
            if (referrerId) {
                const { data: referrerData, error: referrerError } = await supabase
                    .from('user_info')
                    .select('user_id')
                    .eq('email', referrerId)
                    .single();

                if (referrerError) {
                    error = '추천인을 찾을 수 없습니다.';
                    loading = false;
                    return;
                }
                referrerUserId = referrerData.user_id;
            }

            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password
            });

            if (signUpError) throw signUpError;

            const { error: insertError } = await supabase
                .from('user_info')
                .insert([
                    {
                        user_id: data.user.id,
                        email: email,
                        referrer_id: referrerUserId,
                        points: 0,
                        created_at: new Date().toISOString()
                    }
                ]);

            if (insertError) throw insertError;

            goto('/login');
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
                    <h2 class="text-3xl font-bold text-center text-gray-800 mb-2">회원가입</h2>
                    <p class="text-center text-gray-500 text-sm mb-8">새로운 계정을 만들어보세요.</p>

                    <form class="space-y-6" on:submit|preventDefault={handleRegister}>
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

                        <div class="bg-yellow-50 border-l-4 border-yellow-300 p-4 rounded-lg">
                            <div class="flex">
                                <div class="flex-shrink-0">
                                    <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                                    </svg>
                                </div>
                                <div class="ml-3">
                                    <p class="text-sm text-yellow-700">별도의 이메일 인증 과정은 없습니다</p>
                                    <p class="text-sm text-yellow-700">존재하지 않는 이메일도 가입 가능합니다</p>
                                </div>
                            </div>
                        </div>

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

                        <div class="space-y-2">
                            <label for="confirmPassword" class="block text-sm font-medium text-gray-700">
                                비밀번호 확인
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                bind:value={confirmPassword}
                                required
                                class="mt-1 block w-full px-4 py-3 border border-sky-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300 bg-white/70"
                                placeholder="비밀번호를 다시 입력하세요"
                            />
                        </div>

                        <div class="space-y-2">
                            <label for="referrerId" class="block text-sm font-medium text-gray-700">
                                추천인 아이디 (선택사항)
                            </label>
                            <input
                                id="referrerId"
                                type="text"
                                bind:value={referrerId}
                                class="mt-1 block w-full px-4 py-3 border border-sky-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300 bg-white/70"
                                placeholder="추천인의 이메일을 입력하세요"
                            />
                        </div>

                        <div class="pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                class="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-sky-400 to-violet-400 hover:from-sky-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                {loading ? '처리 중...' : '회원가입'}
                            </button>
                        </div>

                        <div class="text-sm text-center pt-4">
                            <a href="/login" class="font-medium text-sky-600 hover:text-sky-500 transition-colors duration-200">
                                이미 계정이 있으신가요? 로그인
                            </a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>