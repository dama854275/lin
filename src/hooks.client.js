// 클라이언트 사이드 훅
export async function handle({ event, resolve }) {
    // 응답을 처리하기 전에 실행될 코드
    const response = await resolve(event);
    
    // 응답을 처리한 후 실행될 코드
    return response;
}
