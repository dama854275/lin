<svelte:head>
	<title>리니지 클래식</title>
</svelte:head>

<script>
	import '../app.css';
	import { user, authReady } from '$lib/stores/auth';
	import { goto, afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabase/client';
	import { browser } from '$app/environment';
	import { accountBulkCreationInProgress } from '$lib/stores/accountCreation';
	import { isZGroupAccount, isMaGroupAccount } from '$lib/utils/groupPrefix';
	import { subscribeUserEmail } from '$lib/utils/subscribeUserEmail';
	import { theme, syncDocumentTheme } from '$lib/stores/theme';

	let mounted = false;
	let currentUserLevel = null;

	// 인증이 필요하지 않은 경로
	const publicRoutes = ['/login', '/register'];

	onMount(() => {
		mounted = true;

		if (!browser) return;
		syncDocumentTheme($page.url.pathname, $theme);
		return subscribeUserEmail(user, async (u) => {
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
	});

	// 현재 경로/사용자/레벨 상태
	$: isPublicRoute = publicRoutes.some((route) => $page.url.pathname.startsWith(route));
	$: currentPath = $page.url.pathname;
	$: currentUser = $user;
	$: isAuthReady = $authReady;
	$: isLevelLoading = isAuthReady && currentUser && currentUserLevel === null;
	$: bulkAccountCreationBusy = $accountBulkCreationInProgress;
	$: monitorPath = currentUser && isZGroupAccount(currentUser.email)
		? '/monitor_2'
		: currentUser && isMaGroupAccount(currentUser.email)
			? '/monitor_ma'
			: '/monitor';
	$: isMonitorActive = currentPath === '/monitor' || currentPath === '/monitor_2' || currentPath === '/monitor_ma';
	$: if (browser) {
		syncDocumentTheme(currentPath, $theme);
	}

	afterNavigate(() => {
		if (!browser) return;
		syncDocumentTheme($page.url.pathname, $theme);
	});
	$: isZGroupUser = currentUser && isZGroupAccount(currentUser.email);
	$: isMaGroupUser = currentUser && isMaGroupAccount(currentUser.email);
	$: level3AllowedPath = isZGroupUser ? '/monitor_2' : isMaGroupUser ? '/monitor_ma' : null;
	$: isLevel3 = currentUserLevel != null && String(currentUserLevel).trim() === '3';

	// 허용 레벨: 1, 2, 3만 로그인 유지
	$: isLevelAllowed = currentUserLevel != null && ['1', '2', '3'].includes(String(currentUserLevel).trim());

	// 인증 상태 확인 및 리다이렉트 (reactive statement)
	// 일괄 계정 생성 중에는 signUp/setSession 사이에 user가 잠깐 바뀌므로 리디렉트하지 않음
	$: if (
		mounted &&
		typeof window !== 'undefined' &&
		isAuthReady &&
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
		isAuthReady &&
		!isPublicRoute &&
		!bulkAccountCreationBusy &&
		currentUser &&
		!isLevelLoading &&
		currentUserLevel !== null &&
		!isLevelAllowed
	) {
		supabase.auth.signOut().then(() => goto('/login'));
	}

	// level 3 일반 계정은 monitor_control 비활성화로 접속 불가
	$: if (
		mounted &&
		typeof window !== 'undefined' &&
		isAuthReady &&
		!isPublicRoute &&
		!bulkAccountCreationBusy &&
		currentUser &&
		isLevel3 &&
		!level3AllowedPath
	) {
		supabase.auth.signOut().then(() => goto('/login'));
	}

	// level 3 사용자는 허용 경로 외 접근 금지 (z_ → /monitor_2, ma_ → /monitor_ma)
	$: if (
		mounted &&
		typeof window !== 'undefined' &&
		isAuthReady &&
		!bulkAccountCreationBusy &&
		currentUser &&
		isLevel3 &&
		level3AllowedPath &&
		currentPath !== level3AllowedPath
	) {
		goto(level3AllowedPath);
	}

	// slot은 항상 렌더합니다. {#if}로 slot을 감싸면 로그인 직후 클라이언트
	// 이동 시 페이지가 마운트되지 않고, F5를 눌러야만 보이는 상태가 됩니다.
</script>

{#if !isPublicRoute}
	<div class="min-h-screen bg-[#f6f7f8] flex flex-col">
		<!-- 상단 가로 메뉴 -->
		<header class="bg-white shadow-md">
			<div class="flex items-center gap-3 sm:gap-8 px-3 sm:px-6 py-3 sm:py-4">
				<h1 class="text-base sm:text-xl font-bold text-gray-800 whitespace-nowrap">리니지 클래식</h1>
				<nav class="flex flex-row flex-wrap items-center gap-2">
					{#if currentUser && currentUserLevel === null}
						<!-- 로그인 중 등급 로딩 중일 때는 메뉴를 잠시 숨김 (깜빡임 방지) -->
					{:else if isLevel3 && level3AllowedPath}
						<a
							href={level3AllowedPath}
							class="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg transition-colors whitespace-nowrap {currentPath === level3AllowedPath ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}"
						>
							캐릭터 모니터링
						</a>
					{:else}
						<a
							href="/"
							class="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg transition-colors whitespace-nowrap {currentPath === '/' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}"
						>
							계정 생성
						</a>
						<a
							href="/account"
							class="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg transition-colors whitespace-nowrap {currentPath === '/account' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}"
						>
							계정 관리
						</a>
						<a
							href={monitorPath}
							class="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg transition-colors whitespace-nowrap {isMonitorActive ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}"
						>
							캐릭터 모니터링
						</a>
					{/if}
				</nav>
			</div>
		</header>

		<main class="flex-1 p-3 sm:p-5 md:p-8">
			<slot />
		</main>
	</div>
{:else}
	<main>
		<slot />
	</main>
{/if}
