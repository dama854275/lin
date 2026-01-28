<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { supabase } from '$lib/supabase/client';
	import { user } from '$lib/stores/auth';
	import { goto } from '$app/navigation';

	let currentUser = null;
	let myUserInfo = null;
	let referredMembers = [];
	let loading = false;
	let pageLoading = true; // 페이지 접속 시 초기 로딩
	let error = null;
	let grantDays = {};
	let granting = {};
	let selectedMembers = new Set();
	let bulkGrantDays = '';
	let bulkGranting = false;
	let searchQuery = '';
	let grantHistory = [];
	let historyLoading = false;
	let historyCurrentPage = 1;
	const historyItemsPerPage = 10;
	let historyExpanded = false; // 기간 적용 내역 기본 접힌 상태

	// 검색어로 필터링된 회원 목록
	$: filteredMembers = searchQuery.trim()
		? referredMembers.filter((member) => {
				const query = searchQuery.trim().toLowerCase();
				// 공백으로 구분된 여러 검색어 지원
				const queries = query.split(/\s+/).filter((q) => q.length > 0);
				// 모든 검색어 중 하나라도 일치하면 표시
				return queries.some((q) => member.email.toLowerCase().includes(q));
		  })
		: referredMembers;

	async function fetchMyUserInfo() {
		if (!currentUser?.email) return;

		try {
			const { data, error: fetchError } = await supabase
				.from('user_info')
				.select('remaining_day')
				.eq('email', currentUser.email)
				.single();

			if (fetchError) {
				console.error('Fetch my user info error:', fetchError);
				return;
			}

			myUserInfo = data;
		} catch (err) {
			console.error('Error fetching my user info:', err);
		}
	}

	async function fetchReferredMembers() {
		if (!currentUser?.email) return;

		loading = true;
		error = null;

		try {
			// 모든 회원을 가져오기 위해 큰 limit 설정 (최대 100,000개)
			const { data, error: fetchError } = await supabase
				.from('user_info')
				.select('email, product_period')
				.eq('referrer_email', currentUser.email)
				.order('email', { ascending: true })
				.limit(100000);

			if (fetchError) {
				console.error('Fetch error:', fetchError);
				error = '회원 목록을 불러오는 중 오류가 발생했습니다.';
				return;
			}

			referredMembers = data || [];
		} catch (err) {
			console.error('Error fetching referred members:', err);
			error = '회원 목록을 불러오는 중 오류가 발생했습니다.';
		} finally {
			loading = false;
		}
	}

	async function fetchGrantHistory() {
		if (!currentUser?.email) return;

		historyLoading = true;

		try {
			const { data, error: fetchError } = await supabase
				.from('period_grant_history')
				.select('*')
				.eq('operator_email', currentUser.email)
				.order('created_at', { ascending: false })
				.limit(1000);

			if (fetchError) {
				console.error('Fetch history error:', fetchError);
				return;
			}

			grantHistory = data || [];
			historyCurrentPage = 1; // 데이터 새로고침 시 첫 페이지로
		} catch (err) {
			console.error('Error fetching grant history:', err);
		} finally {
			historyLoading = false;
		}
	}

	// 페이지네이션된 내역 계산
	$: historyTotalPages = Math.ceil(grantHistory.length / historyItemsPerPage);
	$: historyStartIndex = (historyCurrentPage - 1) * historyItemsPerPage;
	$: historyEndIndex = historyStartIndex + historyItemsPerPage;
	$: paginatedHistory = grantHistory.slice(historyStartIndex, historyEndIndex);

	function goToHistoryPage(page) {
		if (page >= 1 && page <= historyTotalPages) {
			historyCurrentPage = page;
		}
	}

	async function grantProductPeriod(memberEmail) {
		const days = parseInt(grantDays[memberEmail]);
		
		if (!days || days <= 0) {
			error = '올바른 기간을 입력해주세요.';
			return;
		}

		// 내 remaining_day 확인
		const myRemainingDays = parseInt(myUserInfo?.remaining_day || '0');
		if (myRemainingDays < days) {
			error = `적용 가능한 기간이 부족합니다. (현재: ${myRemainingDays}일)`;
			return;
		}

		granting[memberEmail] = true;
		error = null;

		try {
			// 해당 회원의 현재 product_period 조회
			const { data: memberData, error: memberError } = await supabase
				.from('user_info')
				.select('product_period')
				.eq('email', memberEmail)
				.single();

			if (memberError) {
				console.error('Member fetch error:', memberError);
				error = '회원 정보를 불러오는 중 오류가 발생했습니다.';
				return;
			}

			let newProductPeriod;
			const currentPeriod = memberData?.product_period;

			if (currentPeriod) {
				// 기존 상품 기간이 있으면 추가
				const existingDate = new Date(currentPeriod);
				existingDate.setDate(existingDate.getDate() + days);
				newProductPeriod = existingDate.toISOString();
			} else {
				// 기존 상품 기간이 없으면 현재 시간 기준으로 적용
				const now = new Date();
				now.setDate(now.getDate() + days);
				newProductPeriod = now.toISOString();
			}

			// 회원의 product_period 업데이트
			const { error: updateError } = await supabase
				.from('user_info')
				.update({ product_period: newProductPeriod })
				.eq('email', memberEmail);

			if (updateError) {
				console.error('Update product_period error:', updateError);
				error = '상품 기간 적용 중 오류가 발생했습니다.';
				return;
			}

			// 내 remaining_day에서 빼기
			const newRemainingDays = myRemainingDays - days;
			const { error: updateRemainingError } = await supabase
				.from('user_info')
				.update({ remaining_day: newRemainingDays.toString() })
				.eq('email', currentUser.email);

			if (updateRemainingError) {
				console.error('Update remaining_day error:', updateRemainingError);
				error = 'remaining_day 업데이트 중 오류가 발생했습니다.';
				return;
			}

			// 기간 적용 내역 저장
			const { error: historyError } = await supabase
				.from('period_grant_history')
				.insert({
					operator_email: currentUser.email,
					target_email: memberEmail,
					days: days,
					before_product_period: currentPeriod || null,
					after_product_period: newProductPeriod,
					before_remaining_day: myRemainingDays.toString(),
					after_remaining_day: newRemainingDays.toString()
				});

			if (historyError) {
				console.error('Save history error:', historyError);
				// 내역 저장 실패는 로그만 남기고 계속 진행
			}

			// 성공 시 목록 새로고침
			await fetchMyUserInfo();
			await fetchReferredMembers();
			await fetchGrantHistory();
			grantDays[memberEmail] = '';
		} catch (err) {
			console.error('Grant product period error:', err);
			error = '상품 기간 적용 중 오류가 발생했습니다.';
		} finally {
			granting[memberEmail] = false;
		}
	}

	function toggleMemberSelection(memberEmail) {
		const newSet = new Set(selectedMembers);
		if (newSet.has(memberEmail)) {
			newSet.delete(memberEmail);
		} else {
			newSet.add(memberEmail);
		}
		selectedMembers = newSet; // Svelte 반응성 트리거
	}

	function toggleAllMembers() {
		// 필터링된 회원 목록 기준으로 전체 선택/해제
		if (selectedMembers.size === filteredMembers.length && filteredMembers.length > 0) {
			// 필터링된 회원들만 선택 해제
			const filteredEmails = new Set(filteredMembers.map((m) => m.email));
			const newSet = new Set(selectedMembers);
			filteredEmails.forEach((email) => newSet.delete(email));
			selectedMembers = newSet;
		} else {
			// 필터링된 모든 회원 선택
			const filteredEmails = filteredMembers.map((m) => m.email);
			const newSet = new Set(selectedMembers);
			filteredEmails.forEach((email) => newSet.add(email));
			selectedMembers = newSet;
		}
		// Svelte 반응성을 위해 새로운 Set 객체로 할당
		selectedMembers = new Set(selectedMembers);
	}

	async function bulkGrantProductPeriod() {
		const days = parseInt(bulkGrantDays);

		if (!days || days <= 0) {
			error = '올바른 기간을 입력해주세요.';
			return;
		}

		if (selectedMembers.size === 0) {
			error = '적용할 회원을 선택해주세요.';
			return;
		}

		// 내 remaining_day 확인
		const myRemainingDays = parseInt(myUserInfo?.remaining_day || '0');
		const totalDaysNeeded = days * selectedMembers.size;

		if (myRemainingDays < totalDaysNeeded) {
			error = `적용 가능한 기간이 부족합니다. (필요: ${totalDaysNeeded}일, 현재: ${myRemainingDays}일)`;
			return;
		}

		bulkGranting = true;
		error = null;

		let successCount = 0;
		let failCount = 0;
		const selectedEmails = Array.from(selectedMembers);
		const savedHistoryIds = []; // 저장된 내역 ID 목록

		try {
			// 선택된 각 회원에게 일괄 적용
			for (const memberEmail of selectedEmails) {
				try {
					// 해당 회원의 현재 product_period 조회
					const { data: memberData, error: memberError } = await supabase
						.from('user_info')
						.select('product_period')
						.eq('email', memberEmail)
						.single();

					if (memberError) {
						console.error(`Member fetch error for ${memberEmail}:`, memberError);
						failCount++;
						continue;
					}

					let newProductPeriod;
					const currentPeriod = memberData?.product_period;

					if (currentPeriod) {
						// 기존 상품 기간이 있으면 추가
						const existingDate = new Date(currentPeriod);
						existingDate.setDate(existingDate.getDate() + days);
						newProductPeriod = existingDate.toISOString();
					} else {
						// 기존 상품 기간이 없으면 현재 시간 기준으로 적용
						const now = new Date();
						now.setDate(now.getDate() + days);
						newProductPeriod = now.toISOString();
					}

					// 회원의 product_period 업데이트
					const { error: updateError } = await supabase
						.from('user_info')
						.update({ product_period: newProductPeriod })
						.eq('email', memberEmail);

					if (updateError) {
						console.error(`Update error for ${memberEmail}:`, updateError);
						failCount++;
						continue;
					}

					// 성공한 경우에만 내역 저장
					successCount++;
					const { data: historyData, error: historyError } = await supabase
						.from('period_grant_history')
						.insert({
							operator_email: currentUser.email,
							target_email: memberEmail,
							days: days,
							before_product_period: currentPeriod || null,
							after_product_period: newProductPeriod,
							before_remaining_day: myRemainingDays.toString(),
							after_remaining_day: myRemainingDays.toString() // 임시 값, 나중에 업데이트
						})
						.select('id')
						.single();

					if (historyError) {
						console.error(`Save history error for ${memberEmail}:`, historyError);
						// 내역 저장 실패는 로그만 남기고 계속 진행
					} else if (historyData?.id) {
						savedHistoryIds.push(historyData.id);
					}
				} catch (err) {
					console.error(`Error granting to ${memberEmail}:`, err);
					failCount++;
				}
			}

			// 내 remaining_day에서 빼기 (성공한 회원 수만큼만)
			const actualDaysUsed = successCount * days;
			const newRemainingDays = myRemainingDays - actualDaysUsed;
			const { error: updateRemainingError } = await supabase
				.from('user_info')
				.update({ remaining_day: newRemainingDays.toString() })
				.eq('email', currentUser.email);

			if (updateRemainingError) {
				console.error('Update remaining_day error:', updateRemainingError);
				error = 'remaining_day 업데이트 중 오류가 발생했습니다.';
				return;
			}

			// 저장된 모든 내역의 after_remaining_day를 최종 값으로 업데이트
			if (savedHistoryIds.length > 0) {
				const { error: updateHistoryError } = await supabase
					.from('period_grant_history')
					.update({ after_remaining_day: newRemainingDays.toString() })
					.in('id', savedHistoryIds);

				if (updateHistoryError) {
					console.error('Update history remaining_day error:', updateHistoryError);
					// 내역 업데이트 실패는 로그만 남기고 계속 진행
				}
			}

			// 성공 시 목록 새로고침
			await fetchMyUserInfo();
			await fetchReferredMembers();
			await fetchGrantHistory();
			selectedMembers = new Set(); // Svelte 반응성 트리거
			bulkGrantDays = '';

			if (failCount > 0) {
				error = `${successCount}명에게 적용 완료, ${failCount}명 적용 실패`;
			}
		} catch (err) {
			console.error('Bulk grant error:', err);
			error = '일괄 적용 중 오류가 발생했습니다.';
		} finally {
			bulkGranting = false;
		}
	}

	onMount(async () => {
		if (browser) {
			user.subscribe(async (u) => {
				currentUser = u;
				if (!u) {
					goto('/login');
				} else {
					// 내 계정 정보와 추천한 회원 목록, 내역 조회
					await fetchMyUserInfo();
					await fetchReferredMembers();
					await fetchGrantHistory();
					pageLoading = false;
				}
			});
		} else {
			pageLoading = false;
		}
	});

	async function handleLogout() {
		await supabase.auth.signOut();
		goto('/login');
	}
</script>

<div class="max-w-6xl">
	{#if pageLoading}
		<div class="flex flex-col items-center justify-center min-h-[40vh] gap-4">
			<svg
				class="animate-spin h-12 w-12 text-blue-600"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<circle
					class="opacity-25"
					cx="12"
					cy="12"
					r="10"
					stroke="currentColor"
					stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
			<p class="text-gray-600 text-lg font-medium">로딩 중...</p>
		</div>
	{:else}
	<div class="flex justify-between items-center mb-8">
		<h2 class="text-4xl font-bold text-gray-900">계정 관리</h2>
		{#if currentUser}
			<button
				on:click={handleLogout}
				class="px-5 py-2.5 bg-red-500 text-white text-base rounded-lg hover:bg-red-600 transition-colors"
			>
				로그아웃
			</button>
		{/if}
	</div>

	<!-- 적용 가능한 기간 표시 -->
	{#if myUserInfo}
		<div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg mb-6">
			<p class="text-yellow-800 font-semibold text-lg">
				적용 가능한 기간: {myUserInfo.remaining_day ?? '0'}일
			</p>
		</div>
	{/if}

	<!-- 기간 적용 내역 (기본 접힌 상태, 버튼으로 펼치기) -->
	<div class="bg-white rounded-lg shadow-md p-6 mb-6">
		<div class="flex items-center justify-between gap-4">
			<h3 class="text-2xl font-semibold">기간 적용 내역</h3>
			{#if historyLoading}
				<span class="text-gray-500 text-base">로딩 중...</span>
			{:else}
				<span class="text-gray-600 text-base">
					{grantHistory.length === 0 ? '적용 내역 없음' : `총 ${grantHistory.length}건`}
				</span>
			{/if}
			<button
				type="button"
				on:click={() => (historyExpanded = !historyExpanded)}
				class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
				aria-expanded={historyExpanded}
			>
				{historyExpanded ? '내역 접기' : '내역 보기'}
				<svg
					class="w-5 h-5 transition-transform {historyExpanded ? 'rotate-180' : ''}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</button>
		</div>

		{#if historyExpanded}
		{#if historyLoading}
			<div class="text-center py-8 mt-4">
				<p class="text-gray-500 text-base">로딩 중...</p>
			</div>
		{:else if grantHistory.length === 0}
			<div class="text-center py-8 mt-4">
				<p class="text-gray-500 text-base">적용 내역이 없습니다.</p>
			</div>
		{:else}
			<div class="overflow-x-auto mt-4">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
								작업 시간
							</th>
							<th class="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
								대상 회원
							</th>
							<th class="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
								적용 일수
							</th>
							<th class="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
								상품 기간 (적용 전)
							</th>
							<th class="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
								상품 기간 (적용 후)
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each paginatedHistory as history, index}
							<tr class="hover:bg-gray-50 {index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
								<td class="px-6 py-4 whitespace-nowrap text-base text-gray-900">
									{new Date(history.created_at).toLocaleString('ko-KR')}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-base font-medium text-gray-900">
									{history.target_email}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-base text-gray-500">
									{history.days}일
								</td>
								<td class="px-6 py-4 text-base text-gray-500">
									{#if history.before_product_period}
										<div class="flex flex-col leading-tight">
											<span>{new Date(history.before_product_period).toLocaleDateString('ko-KR')}</span>
											<span class="text-sm text-gray-400">{new Date(history.before_product_period).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
										</div>
									{:else}
										미설정
									{/if}
								</td>
								<td class="px-6 py-4 text-base text-gray-500">
									{#if history.after_product_period}
										<div class="flex flex-col leading-tight">
											<span>{new Date(history.after_product_period).toLocaleDateString('ko-KR')}</span>
											<span class="text-sm text-gray-400">{new Date(history.after_product_period).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
										</div>
									{:else}
										미설정
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- 페이지네이션 -->
			{#if historyTotalPages > 1}
				<div class="mt-4 flex items-center justify-between">
					<div class="text-base text-gray-600">
						총 {grantHistory.length}건의 내역 (페이지 {historyCurrentPage} / {historyTotalPages})
					</div>
					<div class="flex items-center gap-2">
						<button
							on:click={() => goToHistoryPage(historyCurrentPage - 1)}
							disabled={historyCurrentPage === 1}
							class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							이전
						</button>
						
						{#each Array(historyTotalPages) as _, i}
							{@const page = i + 1}
							{#if page === historyCurrentPage || page === 1 || page === historyTotalPages || (page >= historyCurrentPage - 1 && page <= historyCurrentPage + 1)}
								<button
									on:click={() => goToHistoryPage(page)}
									class="px-3 py-2 text-sm font-medium rounded-lg transition-colors {page === historyCurrentPage
										? 'bg-blue-600 text-white'
										: 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'}"
								>
									{page}
								</button>
							{:else if page === historyCurrentPage - 2 || page === historyCurrentPage + 2}
								<span class="px-2 text-gray-500">...</span>
							{/if}
						{/each}
						
						<button
							on:click={() => goToHistoryPage(historyCurrentPage + 1)}
							disabled={historyCurrentPage === historyTotalPages}
							class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							다음
						</button>
					</div>
				</div>
			{:else}
				<div class="mt-4 text-base text-gray-600">
					총 {grantHistory.length}건의 내역
				</div>
			{/if}
		{/if}
		{/if}
	</div>

	<!-- 하위 계정 -->
	<div class="bg-white rounded-lg shadow-md p-6">
		<h3 class="text-2xl font-semibold mb-4">하위 계정</h3>

		{#if loading}
			<div class="text-center py-8">
				<p class="text-gray-500 text-base">로딩 중...</p>
			</div>
		{:else if error}
			<div class="bg-red-50 border-l-4 border-red-300 p-4 rounded-lg">
				<p class="text-base text-red-700">{error}</p>
			</div>
		{:else if referredMembers.length === 0}
			<div class="text-center py-8">
				<p class="text-gray-500 text-base">하위 계정이 없습니다.</p>
			</div>
		{:else}
			<!-- 검색 필터 -->
			<div class="mb-4">
				<div class="relative">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="이메일 검색"
						class="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
						<svg
							class="w-6 h-6 text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
					</div>
					{#if searchQuery.trim()}
						<button
							on:click={() => {
								searchQuery = '';
							}}
							class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
						>
							<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					{/if}
				</div>
				{#if searchQuery.trim()}
					<p class="mt-2 text-base text-gray-600">
						검색 결과: {filteredMembers.length}명
						{#if filteredMembers.length !== referredMembers.length}
							(전체 {referredMembers.length}명 중)
						{/if}
					</p>
				{/if}
			</div>

			<!-- 일괄 적용 섹션 -->
			{#if selectedMembers.size > 0}
				<div class="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg mb-4">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-blue-800 font-semibold text-base">
								{selectedMembers.size}명 선택됨
							</p>
						</div>
						<div class="flex items-center gap-3">
							<input
								type="number"
								min="1"
								bind:value={bulkGrantDays}
								placeholder="기간"
								class="w-24 px-3 py-2 border border-blue-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
							<button
								on:click={bulkGrantProductPeriod}
								disabled={bulkGranting || !bulkGrantDays}
								class="px-4 py-2 bg-blue-600 text-white text-base rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							>
								{bulkGranting ? '적용 중...' : '일괄 적용'}
							</button>
							<button
								on:click={() => {
									selectedMembers = new Set();
								}}
								class="px-3 py-2 text-base text-blue-600 hover:text-blue-800"
							>
								선택 해제
							</button>
						</div>
					</div>
				</div>
			{/if}

			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left">
								<input
									type="checkbox"
									checked={filteredMembers.length > 0 && filteredMembers.every((m) => selectedMembers.has(m.email))}
									on:change={toggleAllMembers}
									class="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
								/>
							</th>
							<th class="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
								이메일
							</th>
							<th class="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
								상품 기간
							</th>
							<th class="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
								상품 기간 적용
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each filteredMembers as member}
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4 whitespace-nowrap">
									<input
										type="checkbox"
										checked={selectedMembers.has(member.email)}
										on:change={() => toggleMemberSelection(member.email)}
										class="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
									/>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-base font-medium text-gray-900">
									{member.email}
								</td>
								<td class="px-6 py-4 text-base text-gray-500">
									{#if member.product_period}
										<div class="flex flex-col leading-tight">
											<span>{new Date(member.product_period).toLocaleDateString('ko-KR')}</span>
											<span class="text-sm text-gray-400">{new Date(member.product_period).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
										</div>
									{:else}
										미설정
									{/if}
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="flex items-center gap-2">
										<input
											type="number"
											min="1"
											bind:value={grantDays[member.email]}
											placeholder="기간"
											class="w-20 px-2 py-1 border border-gray-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
										<button
											on:click={() => grantProductPeriod(member.email)}
											disabled={granting[member.email] || !grantDays[member.email]}
											class="px-3 py-1 bg-blue-600 text-white text-base rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
										>
											{granting[member.email] ? '적용 중...' : '적용'}
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="mt-4 text-base text-gray-600">
				{#if searchQuery.trim()}
					총 {filteredMembers.length}명 표시 (전체 {referredMembers.length}명)
				{:else}
					총 {referredMembers.length}명의 회원
				{/if}
			</div>
		{/if}
	</div>
	{/if}
</div>

<!-- 로딩 오버레이 -->
{#if bulkGranting || Object.values(granting).some((g) => g)}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
		style="pointer-events: all;"
	>
		<div class="bg-white rounded-lg p-8 flex flex-col items-center space-y-4 shadow-xl">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
			<p class="text-gray-700 font-medium">
				{bulkGranting ? '일괄 기간 적용 중...' : '기간 적용 중...'}
			</p>
			<p class="text-sm text-gray-500">잠시만 기다려주세요.</p>
		</div>
	</div>
{/if}
