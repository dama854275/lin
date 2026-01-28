# LinWeb

Supabase와 Svelte를 사용한 웹 프로젝트입니다.

## 시작하기

### 1. 환경변수 설정

`.env.example` 파일을 참고하여 `.env` 파일을 생성하고 Supabase 정보를 입력하세요:

```env
PUBLIC_SUPABASE_URL="your-supabase-url"
PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 개발 서버 실행

```bash
npm run dev
```

## 프로젝트 구조

- `src/lib/supabase/client.js` - 클라이언트 사이드 Supabase 클라이언트
- `src/lib/supabase/server.js` - 서버 사이드 Supabase 클라이언트
- `src/routes/` - SvelteKit 라우트
- `src/hooks.client.js` - 클라이언트 사이드 훅
- `src/hooks.server.js` - 서버 사이드 훅

## 기술 스택

- SvelteKit
- Supabase
- Tailwind CSS
- Vite
