# React + Vite 스캐폴드 설계

## 목적
"지역바로알기" 프로젝트의 초기 뼈대를 만든다. Vite + React + TypeScript 기반이며, Supabase 클라이언트 연결을 미리 준비해둔다. 화면에는 테스트용으로 제목만 표시한다.

## 범위
- Vite(`react-ts` 템플릿) 스캐폴드
- `@supabase/supabase-js` 설치 및 클라이언트 초기화 코드
- 실제 Supabase 프로젝트(`Localized Curricullum in BP`, project ref `nqnfuyyjlwgzbctumxxv`, region `ap-northeast-2`)의 URL/publishable key로 `.env` 구성
- `App.tsx`는 `<h1>지역바로알기</h1>`만 렌더링

## 구성 요소

### 1. 프로젝트 스캐폴드
- `npm create vite@latest . -- --template react-ts`로 현재 디렉터리에 생성
- 패키지 매니저: npm

### 2. Supabase 클라이언트
- `src/lib/supabaseClient.ts`: `createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)`를 export
- 환경변수:
  - `.env` (git에 커밋하지 않음): 실제 URL/publishable key 값
  - `.env.example`: 키 이름만 있고 값은 비워둠, git에 커밋
- `.gitignore`에 `.env` 추가

### 3. 화면
- `App.tsx`에서 기존 Vite 템플릿 내용을 제거하고 `<h1>지역바로알기</h1>`만 렌더링
- 이 시점에서는 Supabase 클라이언트를 실제로 호출하지 않음 (연결 준비만)

## 에러 처리
- 해당 범위 없음 (정적 렌더링 + 클라이언트 초기화뿐, 네트워크 호출 없음)

## 테스트
- `npm run dev`로 로컬 실행 후 브라우저에서 "지역바로알기" 텍스트가 보이는지 확인
- `npm run build`로 타입 에러 없이 빌드되는지 확인

## 범위 외
- 실제 데이터베이스 테이블/쿼리
- 인증, 라우팅, 상태관리, 스타일링 라이브러리
