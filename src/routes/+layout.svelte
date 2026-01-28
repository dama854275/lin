<script>
	import '../app.css';
	import { user } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let mounted = false;

	// 인증이 필요하지 않은 경로
	const publicRoutes = ['/login', '/register'];

	onMount(() => {
		mounted = true;
	});

	// 현재 경로 확인
	$: isPublicRoute = publicRoutes.some((route) => $page.url.pathname.startsWith(route));
	$: currentPath = $page.url.pathname;
	$: currentUser = $user;

	// 인증 상태 확인 및 리다이렉트 (reactive statement)
	$: if (mounted && typeof window !== 'undefined' && !isPublicRoute && !currentUser) {
		goto('/login');
	}
</script>

{#if !isPublicRoute}
	<div class="flex min-h-screen bg-gray-50">
		<!-- 좌측 사이드바 -->
		<aside class="w-64 bg-white shadow-lg">
			<div class="p-6">
				<h1 class="text-2xl font-bold text-gray-800 mb-8">LinWeb</h1>
				<nav class="space-y-2">
					<a
						href="/"
						class="block px-4 py-3 rounded-lg transition-colors {currentPath === '/' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}"
					>
						계정 생성
					</a>
					<a
						href="/account"
						class="block px-4 py-3 rounded-lg transition-colors {currentPath === '/account' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}"
					>
						계정 관리
					</a>
					<a
						href="/monitor"
						class="block px-4 py-3 rounded-lg transition-colors {currentPath === '/monitor' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}"
					>
						캐릭터 모니터링
					</a>
				</nav>
			</div>
		</aside>

		<!-- 메인 컨텐츠 영역 -->
		<main class="flex-1 p-8">
			<slot />
		</main>
	</div>
{:else}
	<main>
		<slot />
	</main>
{/if}
