<script>
	import { supabase } from '$lib/supabase/client';
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/auth';
	import { onMount } from 'svelte';

	let email = '';
	let password = '';
	let confirmPassword = '';
	let loading = false;
	let error = null;

	onMount(() => {
		// 이미 로그인되어 있으면 홈으로 리다이렉트
		user.subscribe((currentUser) => {
			if (currentUser) {
				goto('/');
			}
		});
	});

	async function handleRegister() {
		try {
			// 이메일 공백 제거 및 소문자 변환
			const trimmedEmail = email.trim().toLowerCase();

			// 빈 이메일 체크
			if (!trimmedEmail) {
				error = '이메일을 입력해주세요.';
				return;
			}

			// 기본 이메일 형식 검증 (간단한 검증만)
			if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
				error = '올바른 이메일 형식을 입력해주세요.';
				return;
			}

			if (password !== confirmPassword) {
				error = '비밀번호가 일치하지 않습니다.';
				return;
			}

			if (password.length < 6) {
				error = '비밀번호는 최소 6자 이상이어야 합니다.';
				return;
			}

			loading = true;
			error = null;

			const { data, error: signUpError } = await supabase.auth.signUp({
				email: trimmedEmail,
				password: password.trim()
			});

			if (signUpError) {
				// Supabase의 실제 에러 메시지 표시
				console.error('Supabase signup error:', signUpError);
				error = signUpError.message || '회원가입 중 오류가 발생했습니다.';
				return;
			}

			// user_info 테이블에 이메일 저장
			if (data?.user) {
				const { error: insertError } = await supabase.from('user_info').insert([
					{
						email: trimmedEmail,
						referrer_email: null,
						product_period: null,
						product_token: null
					}
				]);

				if (insertError) {
					console.error('user_info insert error:', insertError);
					// user_info 저장 실패해도 회원가입은 성공했으므로 계속 진행
				}
			}

			// 회원가입 성공 시 로그인 페이지로 이동
			goto('/login');
		} catch (err) {
			console.error('Register error:', err);
			error = err.message || '회원가입 중 오류가 발생했습니다.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-sky-50 to-violet-50 py-12 flex items-center justify-center">
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
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
												clip-rule="evenodd"
											/>
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
								placeholder="비밀번호를 입력하세요 (최소 6자)"
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
							<a
								href="/login"
								class="font-medium text-sky-600 hover:text-sky-500 transition-colors duration-200"
							>
								이미 계정이 있으신가요? 로그인
							</a>
						</div>
					</form>
				</div>
			</div>
		</div>
	</div>
</div>
