You are Codex applying worker-proposed edits for the Whiteboard Capture repository.
Role: frontend
Run ID: run-2026-05-21T12-29-31-055Z

Goal:
웹 프론트엔드에 네이버 소셜 로그인 버튼 및 인증 플로우를 추가하여 사용자가 네이버 계정으로 로그인할 수 있도록 한다.

Allowed paths:
- web/**

Blocked paths:
- backend-fast/**
- backend-core/**
- mobile/**

Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- VITE_API_BASE_URL, VITE_REALTIME_WS_URL 계약을 유지합니다.
- 백엔드 메시지 포맷과 JWT 전달 방식을 합의 없이 바꾸지 않습니다.
- 로그인 버튼, OAuth redirect, JWT 저장 방식은 백엔드와 합의된 계약만 사용합니다.

Required verification:
- .skills/verify-web.ps1

Apply the following file-by-file edits carefully:

## web/src/components/Login.tsx
- action: update
- summary: 네이버 로그인 버튼 추가, 네이버 인증 플로우 및 JWT 저장/라우팅 로직 반영
- instructions:
  - 1. 네이버 로그인 버튼을 추가합니다. 공식 CI 가이드에 맞는 SVG 또는 이미지 버튼을 사용하며, button에 네이버 전용 CSS 클래스를 부여합니다.
  - 2. onClick 시 VITE_API_BASE_URL + '/oauth2/authorization/naver'로 window.location.href를 리다이렉트합니다.
  - 3. 인증 리다이렉트 URI에서 location.search에 JWT 토큰(token 키를 가정)을 추출하여 localStorage에 저장하고, 로그인 완료 상태로 전환 및 대시보드(또는 메인)로 라우팅합니다.
  - 4. location.search에 error, error_description 등이 있다면 UX 안내 메시지(UI 상 알림), 에러 처리 로직을 추가합니다.
  - 5. useEffect 내에서 리디렉트된 JWT 또는 에러 소거, URL을 정상화(clean-up)하는 코드를 추가합니다.

## web/src/components/Login.module.css
- action: update
- summary: 네이버 소셜 로그인 공식 버튼 스타일 추가
- instructions:
  - 1. 네이버 로그인 버튼 스타일(공식 CI 가이드 준수) class .naver-login-btn 추가: 배경색 #03C75A, 폰트 굵기/크기/색상, border 등 네이버 공식 버튼 디자인 반영.
  - 2. SVG 아이콘 또는 공식 이미지가 배치될 경우 해당 레이아웃, hover 등 상태도 CSS로 지정합니다.

Execution rules:
- Edit only files inside allowed paths.
- Do not modify blocked paths.
- Preserve existing project conventions and comments.
- Add or restore concise human-readable comments in complex logic where they improve maintainability.
- Run the required verification commands after editing.
- If a proposed edit conflicts with actual code, adapt carefully and record the deviation in your final summary.
