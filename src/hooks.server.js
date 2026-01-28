// 서버 사이드 훅
// 인증 체크는 클라이언트 사이드에서 처리합니다
export async function handle({ event, resolve }) {
	const response = await resolve(event);
	return response;
}
