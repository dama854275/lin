<svelte:head>
	<title>리니지 클래식</title>
</svelte:head>

<script>
	import '../app.css';
	import { user } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabase/client';
	import { browser } from '$app/environment';
	import { accountBulkCreationInProgress } from '$lib/stores/accountCreation';

	let mounted = false;
	let currentUserLevel = null;

	// 인증이 필요하지 않은 경로
	const publicRoutes = ['/login', '/register'];

	onMount(async () => {
		mounted = true;

		// 로그인된 경우 user_info에서 level 조회
		if (browser) {
			const unsubscribe = user.subscribe(async (u) => {
				if (u?.email) {
					const email = u.email.toLowerCase();
					const { data: userInfo } = await supabase
						.from('user_info')
						.select('level')
						.eq('email', email)
						.maybeSingle();
					currentUserLevel = userInfo?.level ?? null;
				} else {
					currentUserLevel = null;
				}
			});

			// 레이아웃이 살아있는 동안만 사용 (별도 언마운트 훅 필요 없음)
		}
	});

	// 현재 경로/사용자/레벨 상태
	$: isPublicRoute = publicRoutes.some((route) => $page.url.pathname.startsWith(route));
	$: currentPath = $page.url.pathname;
	$: currentUser = $user;
	$: isLevelLoading = currentUser && currentUserLevel === null;
	$: bulkAccountCreationBusy = $accountBulkCreationInProgress;

	// 허용 레벨: 1, 2, 3만 로그인 유지
	$: isLevelAllowed = currentUserLevel != null && ['1', '2', '3'].includes(String(currentUserLevel).trim());

	// 인증 상태 확인 및 리다이렉트 (reactive statement)
	// 일괄 계정 생성 중에는 signUp/setSession 사이에 user가 잠깐 바뀌므로 리디렉트하지 않음
	$: if (
		mounted &&
		typeof window !== 'undefined' &&
		!isPublicRoute &&
		!bulkAccountCreationBusy &&
		!currentUser
	) {
		goto('/login');
	}

	// 로그인은 되어 있으나 level이 1,2,3이 아니거나 null이면 로그아웃 후 로그인 페이지로
	$: if (
		mounted &&
		typeof window !== 'undefined' &&
		!isPublicRoute &&
		!bulkAccountCreationBusy &&
		currentUser &&
		!isLevelLoading &&
		currentUserLevel !== null &&
		!isLevelAllowed
	) {
		supabase.auth.signOut().then(() => goto('/login'));
	}

	// level 3 사용자는 /monitor_control 외 경로 접근 금지 (공용 경로 포함)
	$: if (
		mounted &&
		typeof window !== 'undefined' &&
		!bulkAccountCreationBusy &&
		currentUser &&
		currentUserLevel === '3' &&
		currentPath !== '/monitor_control'
	) {
		goto('/monitor_control');
	}

	// 컨텐츠 노출 조건
	// - 공용 경로는 항상 노출
	// - 로그인 전에는 노출
	// - 로그인 후 level 로딩 중이면 잠시 노출 안 함 (깜빡임 방지)
	// - level 3은 /monitor_control 에서만 노출, 그 외 페이지는 숨김
	// - 일괄 계정 생성 중에는 signUp으로 잠깐 level 3으로 보일 수 있으므로 슬롯(안내 오버레이 포함)을 유지
	$: showContent =
		isPublicRoute ||
		!currentUser ||
		bulkAccountCreationBusy ||
		(!isLevelLoading &&
			(currentUserLevel !== '3' || (currentUserLevel === '3' && currentPath === '/monitor_control')));
</script>

{#if !isPublicRoute}
	<div class="flex min-h-screen bg-gray-50">
		<!-- 좌측 사이드바 -->
		<aside class="w-64 bg-white shadow-lg">
			<div class="p-6">
				<h1 class="text-2xl font-bold text-gray-800 mb-8">리니지 클래식</h1>
				<nav class="space-y-2">
					{#if currentUser && currentUserLevel === null}
						<!-- 로그인 중 등급 로딩 중일 때는 메뉴를 잠시 숨김 (깜빡임 방지) -->
					{:else if currentUserLevel === '3'}
						<!-- level 3: 캐릭터 모니터링(모니터 제어)만 표시 -->
						<a
							href="/monitor_control"
							class="block px-4 py-3 rounded-lg transition-colors {currentPath === '/monitor_control' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}"
						>
							캐릭터 모니터링
						</a>
					{:else}
						<!-- 그 외 등급: 기존 메뉴 전체 표시 -->
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
					{/if}
				</nav>
			</div>
		</aside>

		<!-- 메인 컨텐츠 영역 -->
		{#if showContent}
			<main class="flex-1 p-8">
				<slot />
			</main>
		{/if}
	</div>
{:else}
	<main>
		<slot />
	</main>
{/if}
