<script>
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase/client';
	import { user } from '$lib/stores/auth';
	import { isSettingsPresetAccount } from '$lib/utils/groupPrefix';
	import { defaultSlotName, isDefaultSlotName, SLOT_COUNT } from '$lib/settings/filenameMap';
	import { packSelectedFolder } from '$lib/settings/packFolder';
	import settingsFolderGuide from '$lib/assets/settings-folder-guide.png';
	import settingsLoadGuide from '$lib/assets/settings-load-guide.png';

	const STORAGE_KEY = 'monitor-settings-presets-open-v1';

	let open = false;
	let slots = Array.from({ length: SLOT_COUNT }, (_, i) => ({
		slot_id: i + 1,
		name: defaultSlotName(i + 1),
		savedName: defaultSlotName(i + 1),
		size_bytes: 0,
		updated_at: null,
		has_file: false
	}));
	let loading = false;
	let error = '';
	let success = '';
	let progress = '';
	let busySlot = 0;
	let folderInput;
	let pendingSlot = 0;
	let loadedEmail = '';
	let showGuide = false;

	if (browser) {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === '1') open = true;
	}

	function toggle() {
		open = !open;
		if (browser) localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
		if (open && allowed && email && email !== loadedEmail) {
			loadedEmail = email;
			loadSlots();
		}
	}

	$: email = ($user?.email || '').trim().toLowerCase();
	$: allowed = isSettingsPresetAccount(email);

	function formatSize(bytes) {
		const n = Number(bytes) || 0;
		if (n <= 0) return '비어 있음';
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
		return `${(n / (1024 * 1024)).toFixed(1)} MB`;
	}

	async function authHeaders() {
		const { data } = await supabase.auth.getSession();
		const token = data?.session?.access_token;
		if (!token) throw new Error('로그인이 필요합니다.');
		return { Authorization: `Bearer ${token}` };
	}

	async function loadSlots() {
		if (!allowed) return;
		loading = true;
		error = '';
		try {
			const headers = await authHeaders();
			const res = await fetch('/api/settings/slots', { headers });
			const body = await res.json();
			if (!res.ok || !body.success) throw new Error(body.error || '슬롯을 불러오지 못했습니다.');
			slots = (body.slots || slots).map((slot) => {
				const name = isDefaultSlotName(slot.name) ? '' : slot.name;
				return { ...slot, name, savedName: name };
			});
		} catch (err) {
			error = err.message || '슬롯을 불러오지 못했습니다.';
		} finally {
			loading = false;
		}
	}

	function isNameDirty(slot) {
		const current = isDefaultSlotName(slot.name) ? '' : String(slot.name || '').trim();
		const saved = isDefaultSlotName(slot.savedName) ? '' : String(slot.savedName || '').trim();
		return current !== saved;
	}

	async function saveName(slot) {
		if (!allowed || busySlot) return;
		const nextName = String(slot.name || '').trim();
		if (!nextName) {
			error = '이름을 입력해 주세요.';
			return;
		}
		if (!isNameDirty(slot)) return;

		busySlot = slot.slot_id;
		error = '';
		success = '';
		try {
			const headers = await authHeaders();
			const res = await fetch('/api/settings/slots', {
				method: 'POST',
				headers: { ...headers, 'Content-Type': 'application/json' },
				body: JSON.stringify({ slot: slot.slot_id, name: nextName })
			});
			const body = await res.json();
			if (!res.ok || !body.success) throw new Error(body.error || '이름을 저장하지 못했습니다.');
			slots = slots.map((item) =>
				item.slot_id === slot.slot_id
					? { ...item, name: body.name, savedName: body.name }
					: item
			);
			success = `${slot.slot_id}번 이름을 저장했습니다.`;
		} catch (err) {
			error = err.message || '이름을 저장하지 못했습니다.';
		} finally {
			busySlot = 0;
		}
	}

	function openFolderPicker(slotId) {
		pendingSlot = slotId;
		error = '';
		success = '';
		progress = '설정 폴더에서 1 또는 2 폴더를 선택하세요';
		folderInput?.click();
	}

	async function handleFolderPicked(event) {
		const input = event.currentTarget;
		const files = Array.from(input.files || []);
		const slotId = pendingSlot;
		pendingSlot = 0;
		if (input) input.value = '';
		if (!slotId) {
			progress = '';
			error = '설정 번호를 다시 선택한 뒤 업로드해 주세요.';
			return;
		}
		if (!files.length) {
			progress = '';
			error = `${slotId}번 폴더에서 파일을 읽지 못했습니다. 다시 선택해 주세요.`;
			return;
		}

		busySlot = slotId;
		error = '';
		success = '';
		try {
			progress = `${slotId}번 압축 중...`;
			const packed = await packSelectedFolder(files);
			if (!packed.ok) throw new Error(packed.error);

			progress = `${slotId}번 업로드 중...`;
			const form = new FormData();
			form.append('slot', String(slotId));
			form.append('file', packed.blob, `${slotId}.zip`);

			const headers = await authHeaders();
			const res = await fetch('/api/settings/upload', {
				method: 'POST',
				headers,
				body: form
			});
			const body = await res.json();
			if (!res.ok || !body.success) throw new Error(body.error || '업로드에 실패했습니다.');

			slots = slots.map((slot) =>
				slot.slot_id === slotId
					? {
							...slot,
							has_file: true,
							size_bytes: body.size_bytes,
							updated_at: body.updated_at
						}
					: slot
			);
			progress = '';
			success = `${slotId}번을 업로드했습니다.`;
		} catch (err) {
			progress = '';
			error = err.message || '업로드에 실패했습니다.';
		} finally {
			busySlot = 0;
		}
	}

	async function downloadSlot(slotId) {
		if (!email) return;
		window.location.href = `/api/settings/download?email=${encodeURIComponent(email)}&slot=${slotId}`;
	}

	async function resetSlot(slot) {
		if (!confirm(`${slot.slot_id}번 설정을 초기화할까요?`)) return;
		busySlot = slot.slot_id;
		error = '';
		success = '';
		try {
			const headers = await authHeaders();
			const res = await fetch('/api/settings/reset', {
				method: 'POST',
				headers: { ...headers, 'Content-Type': 'application/json' },
				body: JSON.stringify({ slot: slot.slot_id })
			});
			const body = await res.json();
			if (!res.ok || !body.success) throw new Error(body.error || '초기화에 실패했습니다.');
			slots = slots.map((item) =>
				item.slot_id === slot.slot_id
					? { ...body.slot, savedName: body.slot.name }
					: item
			);
			success = `${slot.slot_id}번을 초기화했습니다.`;
		} catch (err) {
			error = err.message || '초기화에 실패했습니다.';
		} finally {
			busySlot = 0;
		}
	}

	onMount(() => {
		if (open && allowed && email) {
			loadedEmail = email;
			loadSlots();
		}
	});

	$: if (open && allowed && email && email !== loadedEmail) {
		loadedEmail = email;
		loadSlots();
	}
</script>

{#if allowed}
	<input
		bind:this={folderInput}
		type="file"
		class="sr-only"
		webkitdirectory
		directory
		multiple
		on:change={handleFolderPicked}
	/>
	<div class="bg-white rounded-lg shadow-md mb-4 overflow-hidden">
		<div class="flex items-center justify-between gap-3 px-4 md:px-6 py-3">
			<button
				type="button"
				class="min-w-0 flex-1 text-left hover:opacity-80"
				on:click={toggle}
				aria-expanded={open}
			>
				<span class="text-xs sm:text-sm font-semibold text-gray-800">설정 관리</span>
			</button>
			<div class="flex items-center gap-2 shrink-0">
				<button
					type="button"
					class="flex items-center gap-1.5 text-sm sm:text-base font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-md px-2 sm:px-3 py-1 sm:py-1.5"
					on:click={() => (showGuide = true)}
				>
					설명서
				</button>
				<button
					type="button"
					class="flex items-center gap-1.5 text-sm sm:text-base font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2 sm:px-3 py-1 sm:py-1.5"
					on:click={toggle}
				>
					{open ? '접기' : '펼치기'}
					<svg
						class="w-5 h-5 text-blue-600 transition-transform {open ? 'rotate-180' : ''}"
						viewBox="0 0 20 20"
						fill="currentColor"
						aria-hidden="true"
					>
						<path
							fill-rule="evenodd"
							d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
			</div>
		</div>

		{#if open}
			<div class="px-4 md:px-6 pb-4 border-t border-gray-100 pt-4">
				{#if loading}
					<p class="text-xs text-gray-400 mb-2">불러오는 중</p>
				{/if}
				{#if error}
					<p class="text-xs text-red-600 mb-2">{error}</p>
				{/if}
				{#if progress}
					<p class="text-sm font-semibold text-blue-600 mb-2">{progress}</p>
				{/if}
				{#if success}
					<p class="text-xs text-emerald-600 mb-2">{success}</p>
				{/if}

				<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
					{#each slots as slot (slot.slot_id)}
						<div class="rounded-md border border-gray-200 px-3 py-2.5 space-y-2">
							<div class="flex items-center justify-between gap-2">
								<span class="text-sm font-bold text-gray-800">{slot.slot_id}번 설정</span>
								<span
									class="text-[11px] {slot.has_file
										? 'text-emerald-600'
										: 'text-gray-400'}"
								>
									{formatSize(slot.size_bytes)}
								</span>
							</div>
							<div class="flex items-center gap-1.5">
								<input
									type="text"
									class="w-full min-w-0 rounded border border-gray-200 px-2 py-1 text-xs text-gray-800"
									bind:value={slot.name}
									maxlength="20"
									placeholder="메모"
									disabled={busySlot === slot.slot_id}
									on:focus={(event) => {
										event.currentTarget.placeholder = '';
									}}
									on:blur={(event) => {
										event.currentTarget.placeholder = '메모';
									}}
									on:keydown={(event) => {
										if (event.key === 'Enter') {
											event.preventDefault();
											saveName(slot);
										}
									}}
								/>
								<button
									type="button"
									class="shrink-0 rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
									disabled={busySlot === slot.slot_id || !isNameDirty(slot)}
									on:click={() => saveName(slot)}
								>
									저장
								</button>
							</div>
							<div class="flex items-center gap-1.5">
								<button
									type="button"
									class="flex-1 rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
									disabled={busySlot === slot.slot_id}
									on:click={() => openFolderPicker(slot.slot_id)}
								>
									업로드
								</button>
								{#if slot.has_file}
									<button
										type="button"
										class="flex-1 rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 disabled:opacity-50"
										disabled={busySlot === slot.slot_id}
										on:click={() => downloadSlot(slot.slot_id)}
									>
										다운
									</button>
								{/if}
								<button
									type="button"
									class="flex-1 rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 disabled:opacity-50"
									disabled={busySlot === slot.slot_id}
									on:click={() => resetSlot(slot)}
								>
									초기화
								</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	{#if showGuide}
		<div
			class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4"
			on:click={() => (showGuide = false)}
			on:keydown={(event) => {
				if (event.key === 'Escape') showGuide = false;
			}}
			role="dialog"
			tabindex="-1"
		>
			<div
				class="bg-white rounded-lg shadow-xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto"
				on:click|stopPropagation
			>
				<div class="flex justify-between items-start mb-4 gap-3">
					<h3 id="settings-guide-title" class="text-lg font-semibold text-gray-900">설명서</h3>
					<button
						type="button"
						class="text-gray-400 hover:text-gray-600 transition-colors"
						aria-label="닫기"
						on:click={() => (showGuide = false)}
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</button>
				</div>

				<div class="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 mb-4">
					<p class="text-sm font-bold text-blue-800 mb-2">설정을 서버에 저장</p>
					<img
						src={settingsFolderGuide}
						alt="설정 폴더 안의 1, 2 폴더"
						class="w-full rounded border border-blue-100 bg-white mb-3"
					/>
					<div class="text-sm text-gray-700 leading-relaxed space-y-2">
						<p>하단의 파란색 업로드 버튼을 누르고 바탕화면 LC 폴더 - LineageC - '설정' 폴더로 이동합니다.</p>
						<p>설정 폴더 내의 1이 왼쪽 매크로, 2가 오른쪽 매크로 설정입니다.</p>
						<p>1번 폴더 또는 2번 폴더를 선택 후 '업로드'를 누르면 설정이 그대로 서버에 저장됩니다.</p>
					</div>
				</div>

				<div class="border-t border-gray-200 my-4"></div>

				<div class="rounded-lg bg-orange-50 border border-orange-100 px-4 py-3">
					<p class="text-sm font-bold text-orange-800 mb-3">서버에서 설정을 불러오기</p>
					<div class="flex justify-center mb-3">
						<img
							src={settingsLoadGuide}
							alt="프로그램에서 설정 번호 입력 후 불러오기"
							width="347"
							height="105"
							class="h-auto w-auto max-w-full rounded border border-orange-100 bg-white"
						/>
					</div>
					<div class="text-sm text-gray-700 leading-relaxed space-y-2">
						<p>프로그램 10번 탭에서 불러오기 번호는 설정 번호만 입력하면 됩니다. ex) 1, 2, 3 ...</p>
						<p>그 후 '불러오기' 버튼을 누르면 불러오기가 진행되며 프로그램이 종료됩니다.</p>
						<p>프로그램을 다시 실행하면 불러온 설정이 그대로 적용됩니다.</p>
					</div>
				</div>
			</div>
		</div>
	{/if}
{/if}
