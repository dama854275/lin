import { writable } from 'svelte/store';

/** 매니저/하위 계정 일괄 생성 중 — signUp 직후 auth 세션이 잠깐 바뀌므로 레이아웃의 강제 리디렉트를 막음 */
export const accountBulkCreationInProgress = writable(false);
