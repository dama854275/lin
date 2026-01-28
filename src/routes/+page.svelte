<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { supabase } from '$lib/supabase/client';
	import { user } from '$lib/stores/auth';
	import { goto } from '$app/navigation';

	let session = null;
	let currentUser = null;
	let currentUserLevel = null; // user_info 테이블의 level (1: 관리자, 2: 매니저, 3: 회원)
	let isCreatingAccount = false; // 계정 생성 중 플래그

	// 매니저 계정 생성 관련 변수
	let managerEmail = '';
	let managerPassword = '';
	let managerConfirmPassword = '';
	let managerLoading = false;
	let managerError = null;
	let managerSuccess = false;

	// 프로그램 버전 관리 (level 1 전용)
	let programVersion = '';
	let programVersionLoaded = ''; // UPDATE 시 WHERE version = ? 에 사용 (version만 있는 테이블용)
	let programVersionLoading = false;
	let programVersionSaving = false;
	let programVersionError = null;
	let programVersionSuccess = false;

	// 하위 계정 생성 관련 변수 (level 3)
	let memberEmail = '';
	let memberPassword = '';
	let memberConfirmPassword = '';
	let memberReferrerEmail = '';
	let memberAccountCount = 4; // 생성할 계정 개수 (1~4)
	let memberLoading = false;
	let memberError = null;
	let memberSuccess = false;
	let createdAccounts = []; // 생성된 계정 이름 목록
	let showAccountPopup = false; // 계정 생성 팝업 표시 여부

	// 기간 부여 관련 변수
	let periodUserId = '';
	let periodDays = '';
	let periodType = 'grant'; // 'grant' 또는 'deduct'
	let periodLoading = false;
	let periodError = null;
	let periodSuccess = false;
	let periodHistory = [];
	let periodHistoryLoading = false;

	// 공지사항 / 업데이트 내역
	let notices = [];
	let updates = [];
	let noticesLoading = false;
	let updatesLoading = false;

	// 공지사항 글쓰기/수정 (level 1 전용)
	let noticeFormOpen = false;
	let noticeFormMode = 'create'; // 'create' | 'edit'
	let noticeFormId = null;
	let noticeFormTitle = '';
	let noticeFormContent = '';
	let noticeFormPinned = false;
	let noticeFormSaving = false;
	let noticeFormError = null;

	// 업데이트 내역 글쓰기/수정 (level 1 전용)
	let updateFormOpen = false;
	let updateFormMode = 'create';
	let updateFormId = null;
	let updateFormVersion = '';
	let updateFormContent = '';
	let updateFormSaving = false;
	let updateFormError = null;

	// 삭제 확인 (level 1 전용)
	let deleteTarget = null; // { type: 'notice'|'update', id, title }
	let deleteLoading = false;
	let deleteError = null;

	// 보기 팝업 (공지/업데이트 제목+내용)
	let viewPopupOpen = false;
	let viewPopupType = null; // 'notice' | 'update'
	let viewPopupTitle = '';
	let viewPopupContent = '';

	onMount(async () => {
		if (browser) {
			// 현재 세션 확인
			const { data: { session: currentSession } } = await supabase.auth.getSession();
			session = currentSession;

			// 인증 상태 변경 감지
			supabase.auth.onAuthStateChange((_event, newSession) => {
				session = newSession;
			});

			// user store 구독
			user.subscribe(async (u) => {
				// 하위 계정 생성 중(signUp 과정)에는 auth 상태가 잠깐 바뀌며
				// "상위 이메일" 입력값이 생성되는 이메일로 덮어써지는 문제가 있어,
				// 생성 중에는 user 구독 로직으로 memberReferrerEmail을 갱신하지 않도록 방지합니다.
				if (isCreatingAccount) return;

				currentUser = u;
				if (!u) {
					goto('/login');
				} else if (u?.email) {
					const email = u.email.toLowerCase();
					memberReferrerEmail = email;
					// user_info에서 level 조회
					const { data: userInfo } = await supabase
						.from('user_info')
						.select('level')
						.eq('email', email)
						.maybeSingle();
					currentUserLevel = userInfo?.level ?? null;
					// level 1일 때만 기간 부여/차감 내역, 프로그램 버전 조회
					if (currentUserLevel === '1') {
						await fetchPeriodHistory();
						await fetchProgramVersion();
					}
					await fetchNotices();
					await fetchUpdates();
				}
			});
		}
	});

	async function fetchPeriodHistory() {
		periodHistoryLoading = true;
		try {
			const { data, error } = await supabase
				.from('period_history')
				.select('*')
				.order('created_at', { ascending: false })
				.limit(50); // 최근 50개만 표시

			if (error) {
				console.error('Fetch period history error:', error);
				return;
			}

			periodHistory = data || [];
		} catch (err) {
			console.error('Error fetching period history:', err);
		} finally {
			periodHistoryLoading = false;
		}
	}

	async function fetchProgramVersion() {
		programVersionLoading = true;
		programVersionError = null;
		try {
			// program_version 테이블: version(text) 단일 컬럼
			const { data, error } = await supabase
				.from('program_version')
				.select('version')
				.limit(1)
				.maybeSingle();

			if (error) {
				console.error('Fetch program version error:', error);
				programVersionError = '버전 정보를 불러오지 못했습니다.';
				return;
			}
			const loaded = data?.version ?? '';
			programVersion = loaded;
			programVersionLoaded = loaded;
		} catch (err) {
			console.error('Error fetching program version:', err);
			programVersionError = '버전 정보를 불러오지 못했습니다.';
		} finally {
			programVersionLoading = false;
		}
	}

	async function handleUpdateProgramVersion() {
		programVersionSaving = true;
		programVersionError = null;
		programVersionSuccess = false;
		try {
			const v = (programVersion || '').trim();
			if (!v) {
				programVersionError = '버전을 입력해 주세요.';
				programVersionSaving = false;
				return;
			}
			// version 단일 컬럼 테이블: WHERE version = (조회해 둔 값) 으로 한 행 지정
			const { error } = await supabase
				.from('program_version')
				.update({ version: v })
				.eq('version', programVersionLoaded);
			if (error) throw error;
			programVersionLoaded = v;
			programVersionSuccess = true;
			setTimeout(() => {
				programVersionSuccess = false;
			}, 3000);
		} catch (err) {
			console.error('Update program version error:', err);
			programVersionError = err.message || '버전 수정 중 오류가 발생했습니다.';
		} finally {
			programVersionSaving = false;
		}
	}

	async function fetchNotices() {
		noticesLoading = true;
		try {
			const { data, error } = await supabase
				.from('notices')
				.select('*')
				.order('is_pinned', { ascending: false })
				.order('created_at', { ascending: false })
				.limit(10);

			if (error) throw error;
			notices = data || [];
		} catch (err) {
			console.error('Fetch notices error:', err);
			notices = [];
		} finally {
			noticesLoading = false;
		}
	}

	async function fetchUpdates() {
		updatesLoading = true;
		try {
			const { data, error } = await supabase
				.from('app_updates')
				.select('*')
				.order('created_at', { ascending: false })
				.limit(10);

			if (error) throw error;
			updates = data || [];
		} catch (err) {
			console.error('Fetch updates error:', err);
			updates = [];
		} finally {
			updatesLoading = false;
		}
	}

	// ----- 공지사항 CRUD (level 1 전용) -----
	function openNoticeCreate() {
		noticeFormMode = 'create';
		noticeFormId = null;
		noticeFormTitle = '';
		noticeFormContent = '';
		noticeFormPinned = false;
		noticeFormError = null;
		noticeFormOpen = true;
	}

	function openNoticeEdit(notice) {
		noticeFormMode = 'edit';
		noticeFormId = notice.id;
		noticeFormTitle = notice.title || '';
		noticeFormContent = notice.content || '';
		noticeFormPinned = !!notice.is_pinned;
		noticeFormError = null;
		noticeFormOpen = true;
	}

	function closeNoticeForm() {
		noticeFormOpen = false;
		noticeFormError = null;
	}

	async function saveNotice() {
		const title = noticeFormTitle.trim();
		if (!title) {
			noticeFormError = '제목을 입력해주세요.';
			return;
		}
		noticeFormSaving = true;
		noticeFormError = null;
		try {
			if (noticeFormMode === 'create') {
				const { error } = await supabase.from('notices').insert([
					{ title, content: noticeFormContent.trim() || null, is_pinned: noticeFormPinned }
				]);
				if (error) throw error;
			} else {
				const { error } = await supabase
					.from('notices')
					.update({ title, content: noticeFormContent.trim() || null, is_pinned: noticeFormPinned })
					.eq('id', noticeFormId);
				if (error) throw error;
			}
			closeNoticeForm();
			await fetchNotices();
		} catch (err) {
			console.error('Save notice error:', err);
			noticeFormError = err.message || '저장 중 오류가 발생했습니다.';
		} finally {
			noticeFormSaving = false;
		}
	}

	async function deleteNotice(id) {
		deleteLoading = true;
		deleteError = null;
		try {
			const { error } = await supabase.from('notices').delete().eq('id', id);
			if (error) throw error;
			deleteTarget = null;
			await fetchNotices();
		} catch (err) {
			console.error('Delete notice error:', err);
			deleteError = err.message || '삭제 중 오류가 발생했습니다.';
		} finally {
			deleteLoading = false;
		}
	}

	// ----- 업데이트 내역 CRUD (level 1 전용) -----
	function openUpdateCreate() {
		updateFormMode = 'create';
		updateFormId = null;
		updateFormVersion = '';
		updateFormContent = '';
		updateFormError = null;
		updateFormOpen = true;
	}

	function openUpdateEdit(update) {
		updateFormMode = 'edit';
		updateFormId = update.id;
		updateFormVersion = update.version || '';
		updateFormContent = update.content || '';
		updateFormError = null;
		updateFormOpen = true;
	}

	function closeUpdateForm() {
		updateFormOpen = false;
		updateFormError = null;
	}

	async function saveUpdate() {
		const version = updateFormVersion.trim();
		if (!version) {
			updateFormError = '버전을 입력해주세요.';
			return;
		}
		updateFormSaving = true;
		updateFormError = null;
		try {
			if (updateFormMode === 'create') {
				const { error } = await supabase.from('app_updates').insert([
					{ version, content: updateFormContent.trim() || null }
				]);
				if (error) throw error;
			} else {
				const { error } = await supabase
					.from('app_updates')
					.update({ version, content: updateFormContent.trim() || null })
					.eq('id', updateFormId);
				if (error) throw error;
			}
			closeUpdateForm();
			await fetchUpdates();
		} catch (err) {
			console.error('Save update error:', err);
			updateFormError = err.message || '저장 중 오류가 발생했습니다.';
		} finally {
			updateFormSaving = false;
		}
	}

	async function deleteUpdate(id) {
		deleteLoading = true;
		deleteError = null;
		try {
			const { error } = await supabase.from('app_updates').delete().eq('id', id);
			if (error) throw error;
			deleteTarget = null;
			await fetchUpdates();
		} catch (err) {
			console.error('Delete update error:', err);
			deleteError = err.message || '삭제 중 오류가 발생했습니다.';
		} finally {
			deleteLoading = false;
		}
	}

	// 삭제 확인 모달용
	function confirmDelete(type, id, title) {
		deleteTarget = { type, id, title: title || (type === 'notice' ? '공지' : '업데이트') };
		deleteError = null;
	}

	function cancelDelete() {
		deleteTarget = null;
		deleteError = null;
	}

	function openNoticeView(notice) {
		viewPopupType = 'notice';
		viewPopupTitle = notice.title || '';
		viewPopupContent = notice.content || '';
		viewPopupOpen = true;
	}

	function openUpdateView(update) {
		viewPopupType = 'update';
		viewPopupTitle = update.version || '—';
		viewPopupContent = update.content || '';
		viewPopupOpen = true;
	}

	function closeViewPopup() {
		viewPopupOpen = false;
		viewPopupType = null;
		viewPopupTitle = '';
		viewPopupContent = '';
	}

	async function doDelete() {
		if (!deleteTarget) return;
		if (deleteTarget.type === 'notice') {
			await deleteNotice(deleteTarget.id);
		} else {
			await deleteUpdate(deleteTarget.id);
		}
	}

	async function handleLogout() {
		await supabase.auth.signOut();
		goto('/login');
	}

	async function handleCreateManager() {
		try {
			// 이메일 공백 제거 및 소문자 변환
			const trimmedEmail = managerEmail.trim().toLowerCase();

			// 빈 이메일 체크
			if (!trimmedEmail) {
				managerError = '이메일을 입력해주세요.';
				return;
			}

			// 기본 이메일 형식 검증
			if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
				managerError = '올바른 이메일 형식을 입력해주세요.';
				return;
			}

			if (managerPassword !== managerConfirmPassword) {
				managerError = '비밀번호가 일치하지 않습니다.';
				return;
			}

			if (managerPassword.length < 6) {
				managerError = '비밀번호는 최소 6자 이상이어야 합니다.';
				return;
			}

			managerLoading = true;
			managerError = null;
			managerSuccess = false;
			isCreatingAccount = true; // 계정 생성 시작

			// 현재 세션 저장 (계정 생성 후 원래 세션으로 복원하기 위해)
			const { data: { session: currentSession } } = await supabase.auth.getSession();
			const originalSession = currentSession ? {
				access_token: currentSession.access_token,
				refresh_token: currentSession.refresh_token
			} : null;

			// Supabase Auth로 계정 생성
			const { data, error: signUpError } = await supabase.auth.signUp({
				email: trimmedEmail,
				password: managerPassword.trim()
			});

			// 즉시 원래 세션으로 복원 (signUp 후 자동 로그인 방지)
			if (originalSession) {
				await supabase.auth.setSession(originalSession);
			} else {
				await supabase.auth.signOut();
			}

			if (signUpError) {
				console.error('Manager signup error:', signUpError);
				managerError = signUpError.message || '매니저 계정 생성 중 오류가 발생했습니다.';
				return;
			}

			// user_info 테이블에 이메일과 level 저장
			if (data?.user) {
				const { error: insertError } = await supabase.from('user_info').insert([
					{
						email: trimmedEmail,
						referrer_email: null,
						product_period: null,
						product_token: null,
						level: '2'
					}
				]);

				if (insertError) {
					console.error('user_info insert error:', insertError);
					managerError = '계정은 생성되었지만 user_info 저장 중 오류가 발생했습니다.';
					return;
				}
			}

			// 성공 메시지 표시
			managerSuccess = true;
			managerEmail = '';
			managerPassword = '';
			managerConfirmPassword = '';

			// 3초 후 성공 메시지 숨기기
			setTimeout(() => {
				managerSuccess = false;
			}, 3000);
		} catch (err) {
			console.error('Create manager error:', err);
			managerError = err.message || '매니저 계정 생성 중 오류가 발생했습니다.';
		} finally {
			managerLoading = false;
			isCreatingAccount = false; // 계정 생성 완료
		}
	}

	async function handleCreateMember() {
		try {
			// 이메일 공백 제거 및 소문자 변환
			const trimmedEmail = memberEmail.trim().toLowerCase();
			const trimmedReferrerEmail = memberReferrerEmail.trim().toLowerCase();

			// 빈 이메일 체크
			if (!trimmedEmail) {
				memberError = '이메일을 입력해주세요.';
				return;
			}

			// 이메일 형식(@ 포함) 입력 방지
			if (trimmedEmail.includes('@')) {
				memberError = '이메일 형식(@ 포함)을 입력하지 마세요. 이메일 앞부분만 입력해주세요. (예: test)';
				return;
			}

			// 최종 이메일 생성 (입력값 + @gmail.com)
			const finalEmail = `${trimmedEmail}@gmail.com`;

			// 상위 이메일 필수 체크
			if (!trimmedReferrerEmail) {
				memberError = '상위 이메일을 입력해주세요.';
				return;
			}

			// 상위 이메일 형식 검증
			if (!trimmedReferrerEmail.includes('@') || !trimmedReferrerEmail.includes('.')) {
				memberError = '올바른 상위 이메일 형식을 입력해주세요.';
				return;
			}

			if (memberPassword !== memberConfirmPassword) {
				memberError = '비밀번호가 일치하지 않습니다.';
				return;
			}

			if (memberPassword.length < 6) {
				memberError = '비밀번호는 최소 6자 이상이어야 합니다.';
				return;
			}

			memberLoading = true;
			memberError = null;
			memberSuccess = false;
			isCreatingAccount = true; // 계정 생성 시작

			// 현재 세션 저장 (계정 생성 후 원래 세션으로 복원하기 위해)
			const { data: { session: currentSession } } = await supabase.auth.getSession();
			const originalSession = currentSession ? {
				access_token: currentSession.access_token,
				refresh_token: currentSession.refresh_token
			} : null;

			// 이메일 앞부분 추출
			const emailPrefix = trimmedEmail;
			const password = memberPassword.trim();

			// 계정 개수 검증
			const accountCount = parseInt(String(memberAccountCount || '4').trim());
			if (isNaN(accountCount) || accountCount < 1 || accountCount > 4) {
				memberError = '계정 개수는 1~4개 사이여야 합니다.';
				return;
			}

			// 선택한 개수만큼 계정 생성 (test_01 -> test_01_01@gmail.com, test_01_02@gmail.com, ... / 가운데 번호를 PC 번호로 활용)
			const emailsToCreate = [];
			const pad = String(accountCount).length;
			for (let i = 1; i <= accountCount; i++) {
				const num = String(i).padStart(Math.max(2, pad), '0');
				emailsToCreate.push(`${emailPrefix}_${num}@gmail.com`);
			}

			let successCount = 0;
			let errorMessages = [];
			createdAccounts = []; // 생성된 계정 목록 초기화

			// 각 이메일로 계정 생성
			for (const email of emailsToCreate) {
				try {
					// Supabase Auth로 계정 생성
					const { data, error: signUpError } = await supabase.auth.signUp({
						email: email,
						password: password
					});

					// 각 계정 생성 후 즉시 원래 세션으로 복원 (signUp 후 자동 로그인 방지)
					if (originalSession) {
						await supabase.auth.setSession(originalSession);
					} else {
						await supabase.auth.signOut();
					}

					if (signUpError) {
						console.error(`Member signup error for ${email}:`, signUpError);
						errorMessages.push(`${email}: ${signUpError.message}`);
						continue;
					}

					// user_info 테이블에 이메일, level, referrer_email 저장
					if (data?.user) {
						const { error: insertError } = await supabase.from('user_info').insert([
							{
								email: email,
								referrer_email: trimmedReferrerEmail,
								product_period: null,
								product_token: null,
								level: '3'
							}
						]);

						if (insertError) {
							console.error(`user_info insert error for ${email}:`, insertError);
							errorMessages.push(`${email}: user_info 저장 실패`);
							continue;
						}

						successCount++;
						createdAccounts.push(email); // 생성된 계정 추가
					}
				} catch (err) {
					console.error(`Error creating account for ${email}:`, err);
					errorMessages.push(`${email}: ${err.message}`);
				}
			}

			// 결과 처리
			if (successCount === accountCount) {
				// 모든 계정 생성 성공
				memberSuccess = true;
				memberEmail = '';
				memberPassword = '';
				memberConfirmPassword = '';
				// 상위 이메일은 현재 사용자 이메일로 유지
				if (currentUser?.email) {
					memberReferrerEmail = currentUser.email.toLowerCase();
				}

				// 생성된 계정 이름 팝업 표시
				showAccountPopup = true;

				// 3초 후 성공 메시지 숨기기
				setTimeout(() => {
					memberSuccess = false;
				}, 3000);
			} else if (successCount > 0) {
				// 일부 계정만 생성 성공
				memberError = `${successCount}개의 계정이 생성되었습니다. 일부 계정 생성에 실패했습니다: ${errorMessages.join(', ')}`;
				// 일부 성공한 경우에도 생성된 계정 팝업 표시
				if (createdAccounts.length > 0) {
					showAccountPopup = true;
				}
			} else {
				// 모든 계정 생성 실패
				memberError = `계정 생성에 실패했습니다: ${errorMessages.join(', ')}`;
			}
		} catch (err) {
			console.error('Create member error:', err);
			memberError = err.message || '회원 계정 생성 중 오류가 발생했습니다.';
		} finally {
			memberLoading = false;
			isCreatingAccount = false; // 계정 생성 완료
		}
	}

	async function handleGrantPeriod() {
		try {
			// 입력값 검증
			const trimmedUserId = periodUserId.trim().toLowerCase();
			const days = parseInt(String(periodDays || '').trim());

			if (!trimmedUserId) {
				periodError = '회원 아이디를 입력해주세요.';
				return;
			}

			if (!periodDays || isNaN(days) || days <= 0) {
				periodError = '올바른 일수를 입력해주세요.';
				return;
			}

			periodLoading = true;
			periodError = null;
			periodSuccess = false;

			// user_info 테이블에서 해당 사용자 조회 및 level 검증
			const { data: userInfo, error: fetchError } = await supabase
				.from('user_info')
				.select('level, remaining_day')
				.eq('email', trimmedUserId)
				.single();

			if (fetchError || !userInfo) {
				periodError = '해당 회원을 찾을 수 없습니다.';
				return;
			}

			// level이 2인지 검증
			if (userInfo.level !== '2') {
				periodError = '해당 회원은 매니저(level 2)가 아닙니다.';
				return;
			}

			// remaining_day에 일수 더하기 또는 빼기
			const currentDays = parseInt(userInfo.remaining_day || '0');
			let newDays;
			if (periodType === 'grant') {
				newDays = currentDays + days;
			} else {
				// 차감 시 음수가 되지 않도록 체크
				if (currentDays - days < 0) {
					periodError = `현재 남은 일수(${currentDays}일)보다 차감할 일수(${days}일)가 더 많습니다.`;
					periodLoading = false;
					return;
				}
				newDays = currentDays - days;
			}

			// user_info 테이블 업데이트
			const { error: updateError } = await supabase
				.from('user_info')
				.update({ remaining_day: newDays.toString() })
				.eq('email', trimmedUserId);

			if (updateError) {
				console.error('Period update error:', updateError);
				periodError = periodType === 'grant' ? '기간 부여 중 오류가 발생했습니다.' : '기간 차감 중 오류가 발생했습니다.';
				return;
			}

			// period_history 테이블에 내역 저장
			if (currentUser?.email) {
				const { error: historyError } = await supabase.from('period_history').insert([
					{
						operator_email: currentUser.email.toLowerCase(),
						target_email: trimmedUserId,
						operation_type: periodType,
						days: days,
						before_remaining_day: currentDays.toString(),
						after_remaining_day: newDays.toString()
					}
				]);

				if (historyError) {
					console.error('Period history insert error:', historyError);
					// 내역 저장 실패는 경고만 하고 계속 진행
				}
			}

			// 성공 메시지 표시
			periodSuccess = true;
			periodUserId = '';
			periodDays = '';

			// 내역 새로고침
			await fetchPeriodHistory();

			// 3초 후 성공 메시지 숨기기
			setTimeout(() => {
				periodSuccess = false;
			}, 3000);
		} catch (err) {
			console.error('Grant period error:', err);
			periodError = err.message || (periodType === 'grant' ? '기간 부여 중 오류가 발생했습니다.' : '기간 차감 중 오류가 발생했습니다.');
		} finally {
			periodLoading = false;
		}
	}
</script>

<div class="max-w-4xl">
	<div class="flex justify-between items-center mb-8">
		<h2 class="text-3xl font-bold text-gray-900">계정 생성</h2>
		{#if currentUser}
			<button
				on:click={handleLogout}
				class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
			>
				로그아웃
			</button>
		{/if}
	</div>

	<!-- level 1일 때만: 기간 부여/차감, 부여/차감 내역, 매니저 계정 생성 -->
	{#if currentUserLevel === '1'}
	<!-- 기간 부여/차감 섹션 -->
	<div class="bg-white rounded-lg shadow-md p-6 mb-6">
		<h3 class="text-xl font-semibold mb-6">기간 부여/차감</h3>

		<form class="space-y-4" on:submit|preventDefault={handleGrantPeriod}>
			{#if periodError}
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
							<p class="text-sm text-red-700">{periodError}</p>
						</div>
					</div>
				</div>
			{/if}

			{#if periodSuccess}
				<div class="bg-green-50 border-l-4 border-green-300 p-4 rounded-lg">
					<div class="flex">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<p class="text-sm text-green-700">
								{periodType === 'grant' ? '기간이 성공적으로 부여되었습니다.' : '기간이 성공적으로 차감되었습니다.'}
							</p>
						</div>
					</div>
				</div>
			{/if}

			<!-- 부여/차감 선택 -->
			<fieldset class="mb-4">
				<legend class="block text-sm font-medium text-gray-700 mb-2">작업 유형 <span class="text-red-500">*</span></legend>
				<div class="flex gap-4">
					<label class="flex items-center">
						<input
							type="radio"
							bind:group={periodType}
							value="grant"
							class="mr-2"
						/>
						<span class="text-gray-700">기간 부여</span>
					</label>
					<label class="flex items-center">
						<input
							type="radio"
							bind:group={periodType}
							value="deduct"
							class="mr-2"
						/>
						<span class="text-gray-700">기간 차감</span>
					</label>
				</div>
			</fieldset>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="periodUserId" class="block text-sm font-medium text-gray-700 mb-2">
						회원 아이디 <span class="text-red-500">*</span>
					</label>
					<input
						id="periodUserId"
						type="text"
						bind:value={periodUserId}
						required
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						placeholder="회원 이메일을 입력하세요"
					/>
				</div>

				<div>
					<label for="periodDays" class="block text-sm font-medium text-gray-700 mb-2">
						{periodType === 'grant' ? '부여할 일수' : '차감할 일수'} <span class="text-red-500">*</span>
					</label>
					<input
						id="periodDays"
						type="number"
						bind:value={periodDays}
						required
						min="1"
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						placeholder="일수를 입력하세요"
					/>
				</div>
			</div>

			<div class="pt-2">
				<button
					type="submit"
					disabled={periodLoading}
					class="px-6 py-2 {periodType === 'grant' ? 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500' : 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500'} text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{periodLoading
						? periodType === 'grant'
							? '부여 중...'
							: '차감 중...'
						: periodType === 'grant'
							? '기간 부여'
							: '기간 차감'}
				</button>
			</div>
		</form>
	</div>

	<!-- 기간 부여/차감 내역 섹션 -->
	<div class="bg-white rounded-lg shadow-md p-6 mb-6">
		<h3 class="text-xl font-semibold mb-6">기간 부여/차감 내역</h3>

		{#if periodHistoryLoading}
			<div class="text-center py-8">
				<p class="text-gray-500">로딩 중...</p>
			</div>
		{:else if periodHistory.length === 0}
			<div class="text-center py-8">
				<p class="text-gray-500">내역이 없습니다.</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								작업 시간
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								대상 회원
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								일수
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								변경 전
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								변경 후
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each periodHistory as history}
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
									{new Date(history.created_at).toLocaleString('ko-KR')}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
									{history.target_email}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
									{history.days}일
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{history.before_remaining_day}일
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
									{history.after_remaining_day}일
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="mt-4 text-sm text-gray-600">
				최근 {periodHistory.length}개 내역 표시
			</div>
		{/if}
	</div>

	<!-- 매니저 계정 생성 섹션 -->
	<div class="bg-white rounded-lg shadow-md p-6 mb-6">
		<h3 class="text-xl font-semibold mb-6">매니저 계정 생성</h3>

		<form class="space-y-4" on:submit|preventDefault={handleCreateManager}>
			{#if managerError}
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
							<p class="text-sm text-red-700">{managerError}</p>
						</div>
					</div>
				</div>
			{/if}

			{#if managerSuccess}
				<div class="bg-green-50 border-l-4 border-green-300 p-4 rounded-lg">
					<div class="flex">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<p class="text-sm text-green-700">매니저 계정이 성공적으로 생성되었습니다.</p>
						</div>
					</div>
				</div>
			{/if}

			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div>
					<label for="managerEmail" class="block text-sm font-medium text-gray-700 mb-2">
						이메일
					</label>
					<input
						id="managerEmail"
						type="email"
						bind:value={managerEmail}
						required
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						placeholder="이메일을 입력하세요"
					/>
				</div>

				<div>
					<label for="managerPassword" class="block text-sm font-medium text-gray-700 mb-2">
						비밀번호
					</label>
					<input
						id="managerPassword"
						type="text"
						bind:value={managerPassword}
						required
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						placeholder="비밀번호 (최소 6자)"
					/>
				</div>

				<div>
					<label for="managerConfirmPassword" class="block text-sm font-medium text-gray-700 mb-2">
						비밀번호 확인
					</label>
					<input
						id="managerConfirmPassword"
						type="text"
						bind:value={managerConfirmPassword}
						required
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						placeholder="비밀번호를 다시 입력하세요"
					/>
				</div>
			</div>

			<div class="pt-2">
				<button
					type="submit"
					disabled={managerLoading}
					class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{managerLoading ? '생성 중...' : '매니저 계정 생성'}
				</button>
			</div>
		</form>
	</div>

	<!-- 프로그램 버전 관리 섹션 (level 1 전용) -->
	<div class="bg-white rounded-lg shadow-md p-6 mb-6">
		<h3 class="text-xl font-semibold mb-6">프로그램 버전 관리</h3>

		{#if programVersionLoading}
			<div class="text-gray-500 py-2">로딩 중...</div>
		{:else}
			<form class="space-y-4" on:submit|preventDefault={handleUpdateProgramVersion}>
				{#if programVersionError}
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
								<p class="text-sm text-red-700">{programVersionError}</p>
							</div>
						</div>
					</div>
				{/if}

				{#if programVersionSuccess}
					<div class="bg-green-50 border-l-4 border-green-300 p-4 rounded-lg">
						<div class="flex">
							<div class="flex-shrink-0">
								<svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
										clip-rule="evenodd"
									/>
								</svg>
							</div>
							<div class="ml-3">
								<p class="text-sm text-green-700">프로그램 버전이 수정되었습니다.</p>
							</div>
						</div>
					</div>
				{/if}

				<div class="max-w-xs">
					<label for="programVersion" class="block text-sm font-medium text-gray-700 mb-2">
						현재 프로그램 버전
					</label>
					<input
						id="programVersion"
						type="text"
						bind:value={programVersion}
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						placeholder="예: 1.0.0"
					/>
				</div>

				<div class="pt-2">
					<button
						type="submit"
						disabled={programVersionSaving}
						class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{programVersionSaving ? '저장 중...' : '버전 수정'}
					</button>
				</div>
			</form>
		{/if}
	</div>
	{/if}

	<!-- 하위 계정 생성 섹션 (level 3) -->
	<div class="bg-white rounded-lg shadow-md p-6 mb-6">
		<h3 class="text-xl font-semibold mb-6">하위 계정 생성</h3>

		<form class="space-y-4" on:submit|preventDefault={handleCreateMember}>
			{#if memberError}
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
							<p class="text-sm text-red-700">{memberError}</p>
						</div>
					</div>
				</div>
			{/if}

			{#if memberSuccess}
				<div class="bg-green-50 border-l-4 border-green-300 p-4 rounded-lg">
					<div class="flex">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<p class="text-sm text-green-700">{memberAccountCount}개의 회원 계정이 성공적으로 생성되었습니다.</p>
						</div>
					</div>
				</div>
			{/if}

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="memberEmail" class="block text-sm font-medium text-gray-700 mb-2">
						이메일 <span class="text-red-500">*</span>
					</label>
					<div class="flex items-center">
						<input
							id="memberEmail"
							type="text"
							bind:value={memberEmail}
							required
							class="w-full px-4 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							placeholder="이메일 앞부분만 입력"
						/>
						<div class="px-4 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-700">
							@gmail.com
						</div>
					</div>
					<p class="mt-1 text-xs text-gray-500">
						⚠️ 이메일 형식(@ 포함)을 입력하지 마세요. 이메일 앞부분만 입력해주세요. (예: test)
					</p>
				</div>

				<div>
					<label for="memberAccountCount" class="block text-sm font-medium text-gray-700 mb-2">
						생성할 계정 개수 <span class="text-red-500">*</span>
					</label>
					<select
						id="memberAccountCount"
						bind:value={memberAccountCount}
						required
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					>
						<option value={1}>1개</option>
						<option value={2}>2개</option>
						<option value={3}>3개</option>
						<option value={4}>4개</option>
					</select>
				</div>

				<!-- 상위 이메일은 값 유지, 화면에서는 숨김 -->
				<div class="hidden">
					<label for="memberReferrerEmail" class="block text-sm font-medium text-gray-700 mb-2">
						상위 이메일 <span class="text-red-500">*</span>
					</label>
					<input
						id="memberReferrerEmail"
						type="email"
						bind:value={memberReferrerEmail}
						readonly
						required
						class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
						placeholder="상위 이메일을 입력하세요"
					/>
				</div>

				<div>
					<label for="memberPassword" class="block text-sm font-medium text-gray-700 mb-2">
						비밀번호 <span class="text-red-500">*</span>
					</label>
					<input
						id="memberPassword"
						type="text"
						bind:value={memberPassword}
						required
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						placeholder="비밀번호 (최소 6자)"
					/>
				</div>

				<div>
					<label for="memberConfirmPassword" class="block text-sm font-medium text-gray-700 mb-2">
						비밀번호 확인 <span class="text-red-500">*</span>
					</label>
					<input
						id="memberConfirmPassword"
						type="text"
						bind:value={memberConfirmPassword}
						required
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						placeholder="비밀번호를 다시 입력하세요"
					/>
				</div>
			</div>

			<div class="pt-2">
				<button
					type="submit"
					disabled={memberLoading}
					class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{memberLoading ? '생성 중...' : '회원 계정 생성'}
				</button>
			</div>
		</form>

		<!-- 안내 문구 -->
		<div class="mt-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-lg">
			<div class="flex">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
					</svg>
				</div>
				<div class="ml-3">
					<h4 class="text-sm font-medium text-blue-800 mb-2">계정 생성 안내</h4>
					<div class="text-sm text-blue-700 space-y-1">
						<p>• 이메일 앞부분만 입력하시면 선택한 개수만큼 자동으로 계정이 생성됩니다.</p>
						<p>• 예시: "test" 입력 + 4개 선택 → <span class="font-mono text-blue-900">test_1@gmail.com</span>, <span class="font-mono text-blue-900">test_2@gmail.com</span>, <span class="font-mono text-blue-900">test_3@gmail.com</span>, <span class="font-mono text-blue-900">test_4@gmail.com</span></p>
						<p>• 생성된 계정은 모두 동일한 비밀번호와 상위 이메일을 가집니다.</p>
						<p>• 계정 생성 완료 후 생성된 계정 이름이 팝업으로 표시됩니다.</p>
					</div>
				</div>
			</div>
		</div>

		<!-- 생성 방식 추천 (안내 문구) -->
		<div class="mt-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-lg">
			<div class="flex">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				<div class="ml-3">
					<h4 class="text-sm font-medium text-blue-800 mb-2">생성 방식 추천</h4>
					<div class="text-sm text-blue-700 space-y-1">
						<p>• 예시: "test_01" 입력 + 4개 선택 후 생성</p>
						<div class="font-mono text-blue-900">
							<div>test_01_01@gmail.com</div>
							<div>test_01_02@gmail.com</div>
							<div>test_01_03@gmail.com</div>
							<div>test_01_04@gmail.com</div>
						</div>
						<p>위와 같이 4개가 생성됩니다.</p>
						<p>가운데 '01'을 PC 번호로 생각하고 생성해 주세요.</p>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- 공지사항 / 업데이트 내역 (양옆 배치) -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
		<!-- 공지사항 -->
		<div class="bg-white rounded-lg shadow-md p-6">
			<div class="flex justify-between items-center mb-4">
				<h3 class="text-xl font-semibold text-gray-900">공지사항</h3>
				{#if currentUserLevel === '1'}
					<button
						type="button"
						on:click={openNoticeCreate}
						class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
					>
						글쓰기
					</button>
				{/if}
			</div>
			{#if noticesLoading}
				<div class="text-center py-6">
					<p class="text-gray-500">로딩 중...</p>
				</div>
			{:else if notices.length === 0}
				<div class="text-center py-6">
					<p class="text-gray-500">등록된 공지사항이 없습니다.</p>
				</div>
			{:else}
				<ul class="space-y-4 divide-y divide-gray-100">
					{#each notices as notice}
						<li class="pt-3 first:pt-0 first:border-0 group">
							<div class="flex items-start gap-2">
								{#if notice.is_pinned}
									<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 flex-shrink-0">고정</span>
								{/if}
								<div
									class="min-w-0 flex-1 cursor-pointer hover:opacity-90"
									role="button"
									tabindex="0"
									on:click={() => openNoticeView(notice)}
									on:keydown={(e) => e.key === 'Enter' && openNoticeView(notice)}
								>
									<p class="font-medium text-gray-900">{notice.title}</p>
									<p class="text-sm text-gray-600 mt-1 line-clamp-2">{notice.content || ''}</p>
									<p class="text-xs text-gray-400 mt-1">{new Date(notice.created_at).toLocaleDateString('ko-KR')}</p>
								</div>
								{#if currentUserLevel === '1'}
									<div class="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
										<button
											type="button"
											on:click={() => openNoticeEdit(notice)}
											class="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
											title="수정"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
										</button>
										<button
											type="button"
											on:click={() => confirmDelete('notice', notice.id, notice.title)}
											class="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
											title="삭제"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
										</button>
									</div>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- 업데이트 내역 -->
		<div class="bg-white rounded-lg shadow-md p-6">
			<div class="flex justify-between items-center mb-4">
				<h3 class="text-xl font-semibold text-gray-900">업데이트 내역</h3>
				{#if currentUserLevel === '1'}
					<button
						type="button"
						on:click={openUpdateCreate}
						class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
					>
						글쓰기
					</button>
				{/if}
			</div>
			{#if updatesLoading}
				<div class="text-center py-6">
					<p class="text-gray-500">로딩 중...</p>
				</div>
			{:else if updates.length === 0}
				<div class="text-center py-6">
					<p class="text-gray-500">등록된 업데이트가 없습니다.</p>
				</div>
			{:else}
				<ul class="space-y-4 divide-y divide-gray-100">
					{#each updates as update}
						<li class="pt-3 first:pt-0 first:border-0 group">
							<div class="flex items-start gap-2">
								<div
									class="min-w-0 flex-1 cursor-pointer hover:opacity-90"
									role="button"
									tabindex="0"
									on:click={() => openUpdateView(update)}
									on:keydown={(e) => e.key === 'Enter' && openUpdateView(update)}
								>
									<div class="flex items-baseline gap-2 flex-wrap">
										<span class="font-semibold text-blue-600">{update.version || '—'}</span>
										<span class="text-xs text-gray-400">{new Date(update.created_at).toLocaleDateString('ko-KR')}</span>
									</div>
									<p class="text-sm text-gray-600 mt-1 whitespace-pre-wrap line-clamp-2">{update.content || ''}</p>
								</div>
								{#if currentUserLevel === '1'}
									<div class="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
										<button
											type="button"
											on:click={() => openUpdateEdit(update)}
											class="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
											title="수정"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
										</button>
										<button
											type="button"
											on:click={() => confirmDelete('update', update.id, update.version)}
											class="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
											title="삭제"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
										</button>
									</div>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>

<!-- 공지사항 글쓰기/수정 모달 (level 1 전용) -->
{#if noticeFormOpen}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="notice-form-title"
	>
		<button
			type="button"
			class="absolute inset-0 cursor-default"
			aria-label="닫기"
			on:click={closeNoticeForm}
			on:keydown={(e) => e.key === 'Escape' && closeNoticeForm()}
		></button>
		<div class="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" role="document">
			<div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
				<h4 id="notice-form-title" class="text-lg font-semibold text-gray-900">{noticeFormMode === 'create' ? '공지사항 글쓰기' : '공지사항 수정'}</h4>
				<button type="button" on:click={closeNoticeForm} class="p-1 text-gray-400 hover:text-gray-600" aria-label="닫기">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
				</button>
			</div>
			<div class="p-6 overflow-y-auto flex-1">
				{#if noticeFormError}
					<div class="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{noticeFormError}</div>
				{/if}
				<div class="space-y-4">
					<div>
						<label for="notice-form-title" class="block text-sm font-medium text-gray-700 mb-1">제목 <span class="text-red-500">*</span></label>
						<input
							id="notice-form-title"
							type="text"
							bind:value={noticeFormTitle}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							placeholder="제목을 입력하세요"
						/>
					</div>
					<div>
						<label for="notice-form-content" class="block text-sm font-medium text-gray-700 mb-1">내용</label>
						<textarea
							id="notice-form-content"
							bind:value={noticeFormContent}
							rows="5"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
							placeholder="내용을 입력하세요"
						></textarea>
					</div>
					<div>
						<label class="flex items-center gap-2 cursor-pointer">
							<input type="checkbox" bind:checked={noticeFormPinned} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
							<span class="text-sm text-gray-700">상단 고정</span>
						</label>
					</div>
				</div>
			</div>
			<div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
				<button type="button" on:click={closeNoticeForm} class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400">취소</button>
				<button type="button" on:click={saveNotice} disabled={noticeFormSaving} class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50">
					{noticeFormSaving ? '저장 중...' : '저장'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 업데이트 내역 글쓰기/수정 모달 (level 1 전용) -->
{#if updateFormOpen}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="update-form-title"
	>
		<button
			type="button"
			class="absolute inset-0 cursor-default"
			aria-label="닫기"
			on:click={closeUpdateForm}
			on:keydown={(e) => e.key === 'Escape' && closeUpdateForm()}
		></button>
		<div class="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" role="document">
			<div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
				<h4 id="update-form-title" class="text-lg font-semibold text-gray-900">{updateFormMode === 'create' ? '업데이트 글쓰기' : '업데이트 수정'}</h4>
				<button type="button" on:click={closeUpdateForm} class="p-1 text-gray-400 hover:text-gray-600" aria-label="닫기">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
				</button>
			</div>
			<div class="p-6 overflow-y-auto flex-1">
				{#if updateFormError}
					<div class="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{updateFormError}</div>
				{/if}
				<div class="space-y-4">
					<div>
						<label for="update-form-version" class="block text-sm font-medium text-gray-700 mb-1">버전 <span class="text-red-500">*</span></label>
						<input
							id="update-form-version"
							type="text"
							bind:value={updateFormVersion}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							placeholder="예: 1.0.0"
						/>
					</div>
					<div>
						<label for="update-form-content" class="block text-sm font-medium text-gray-700 mb-1">변경 내용</label>
						<textarea
							id="update-form-content"
							bind:value={updateFormContent}
							rows="5"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
							placeholder="변경 내용을 입력하세요 (줄바꿈 가능)"
						></textarea>
					</div>
				</div>
			</div>
			<div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
				<button type="button" on:click={closeUpdateForm} class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400">취소</button>
				<button type="button" on:click={saveUpdate} disabled={updateFormSaving} class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50">
					{updateFormSaving ? '저장 중...' : '저장'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 삭제 확인 모달 (level 1 전용) -->
{#if deleteTarget}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="delete-dialog-title"
	>
		<button
			type="button"
			class="absolute inset-0 cursor-default"
			aria-label="닫기"
			on:click={cancelDelete}
			on:keydown={(e) => e.key === 'Escape' && cancelDelete()}
		></button>
		<div class="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-6" role="document">
			<h4 id="delete-dialog-title" class="text-lg font-semibold text-gray-900 mb-2">삭제 확인</h4>
			<p class="text-gray-600 mb-4">
				{deleteTarget.type === 'notice' ? '공지사항' : '업데이트 내역'} "<span class="font-medium">{deleteTarget.title}</span>"(을)를 삭제할까요?
			</p>
			{#if deleteError}
				<div class="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{deleteError}</div>
			{/if}
			<div class="flex justify-end gap-2">
				<button type="button" on:click={cancelDelete} class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400">취소</button>
				<button type="button" on:click={doDelete} disabled={deleteLoading} class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50">
					{deleteLoading ? '삭제 중...' : '삭제'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 보기 팝업 (공지/업데이트 제목+내용) -->
{#if viewPopupOpen}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="view-popup-title"
	>
		<button
			type="button"
			class="absolute inset-0 cursor-default"
			aria-label="닫기"
			on:click={closeViewPopup}
			on:keydown={(e) => e.key === 'Escape' && closeViewPopup()}
		></button>
		<div class="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" role="document">
			<div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
				<h4 id="view-popup-title" class="text-lg font-semibold text-gray-900">
					{viewPopupType === 'notice' ? '공지사항' : '업데이트 내역'}
				</h4>
				<button type="button" on:click={closeViewPopup} class="p-1 text-gray-400 hover:text-gray-600" aria-label="닫기">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
				</button>
			</div>
			<div class="p-6 overflow-y-auto flex-1">
				<p class="text-xl font-semibold text-gray-900 mb-4">{viewPopupTitle}</p>
				<div class="text-gray-600 whitespace-pre-wrap">{viewPopupContent || '(내용 없음)'}</div>
			</div>
		</div>
	</div>
{/if}

<!-- 로딩 오버레이 -->
{#if managerLoading || memberLoading || periodLoading}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
		style="pointer-events: all;"
	>
		<div class="bg-white rounded-lg p-8 flex flex-col items-center space-y-4 shadow-xl">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
			<p class="text-gray-700 font-medium">
				{managerLoading
					? '매니저 계정 생성 중...'
					: memberLoading
						? '회원 계정 생성 중...'
						: periodType === 'grant'
							? '기간 부여 중...'
							: '기간 차감 중...'}
			</p>
			<p class="text-sm text-gray-500">잠시만 기다려주세요.</p>
		</div>
	</div>
{/if}

<!-- 생성된 계정 이름 팝업 -->
{#if showAccountPopup && createdAccounts.length > 0}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
		style="pointer-events: all;"
		on:click={() => showAccountPopup = false}
		on:keydown={(e) => {
			if (e.key === 'Escape') {
				showAccountPopup = false;
			}
		}}
		role="presentation"
	>
		<div
			class="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
			on:click|stopPropagation
			role="dialog"
			aria-modal="true"
			aria-labelledby="popup-title"
		>
			<div class="flex justify-between items-center mb-4">
				<h3 id="popup-title" class="text-xl font-semibold text-gray-900">생성된 계정</h3>
				<button
					on:click={() => showAccountPopup = false}
					class="text-gray-400 hover:text-gray-600 transition-colors"
					aria-label="닫기"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			<div class="mb-4">
				<p class="text-sm text-gray-600 mb-3">총 {createdAccounts.length}개의 계정이 생성되었습니다:</p>
				<div class="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
					<ul class="space-y-2">
						{#each createdAccounts as account}
							<li class="flex items-center text-sm text-gray-700">
								<svg class="w-4 h-4 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
								</svg>
								<span class="font-mono">{account}</span>
							</li>
						{/each}
					</ul>
				</div>
			</div>
			<div class="flex justify-end">
				<button
					on:click={() => showAccountPopup = false}
					class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
				>
					확인
				</button>
			</div>
		</div>
	</div>
{/if}
