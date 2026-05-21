You are the frontend worker for the Whiteboard Capture repository.
Work only inside the allowed paths.
Do not modify blocked paths.
If you need a contract change outside your scope, do not edit it. Report it in contractsChanged or questions.
Run ID: run-2026-05-21T12-29-31-055Z

Goal:
웹 프론트엔드에 네이버 소셜 로그인 버튼 및 인증 플로우를 추가하여 사용자가 네이버 계정으로 로그인할 수 있도록 한다.

Allowed paths:
- web/**

Blocked paths:
- backend-fast/**
- backend-core/**
- mobile/**

Touched areas:
- web/src/components/Login.tsx
- web/src/components/Login.module.css

Implementation steps:
- 1. 네이버 로그인 버튼 UI를 Login.tsx에 추가한다. (공식 네이버 CI 가이드에 맞는 버튼 스타일 적용)
- 2. 네이버 로그인 버튼 클릭 시, Spring Boot 백엔드의 네이버 OAuth2 인증 엔드포인트(예: /oauth2/authorization/naver)로 리다이렉트한다. (VITE_API_BASE_URL 활용)
- 3. 인증 성공 후 백엔드에서 JWT를 발급받아 프론트엔드로 리디렉션되도록 한다. (리디렉션 URI 및 JWT 전달 방식은 백엔드 구현에 맞춰 연동)
- 4. 리디렉션된 URI에서 JWT 토큰을 추출하여 localStorage/sessionStorage 등에 저장하고, 로그인 상태로 전환한다.
- 5. 로그인 성공 시 대시보드 등으로 이동하도록 라우팅 처리한다.
- 6. 네이버 로그인 관련 에러/취소/실패 케이스에 대한 안내 메시지 및 UX 처리 추가
- 7. Login.module.css에 네이버 버튼 스타일 추가 (공식 가이드 준수)

Dependencies:
- Spring Boot 백엔드에서 네이버 OAuth2 인증 및 JWT 발급 엔드포인트 구현 필요 (backend-core)
- JWT 토큰 전달 방식(쿼리스트링, 해시, 쿠키 등)에 대한 백엔드와의 사전 합의 필요

Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- VITE_API_BASE_URL, VITE_REALTIME_WS_URL 계약을 유지합니다.
- 백엔드 메시지 포맷과 JWT 전달 방식을 합의 없이 바꾸지 않습니다.
- 로그인 버튼, OAuth redirect, JWT 저장 방식은 백엔드와 합의된 계약만 사용합니다.

Required verification:
- .skills/verify-web.ps1

Instructions:
- You may edit files inside allowed paths when necessary.
- Run relevant verification commands when possible.
- Return only JSON matching the provided schema.
- Use changedFiles as repository-relative paths.
- proposedEdits must list the concrete file-by-file changes that should be applied in this repository.
- Each proposedEdits item must include path, action, summary, and step-by-step instructions.
- If no file change is needed, return proposedEdits as an empty array.
- Use status 'succeeded' only if your scoped work and verification are complete.
- Use status 'failed' if you were blocked or verification failed.
- Use status 'skipped' only if no code change was necessary.
- The runner will write your JSON to: D:\개발\whiteboard capture\orchestrator\runs\run-2026-05-21T12-29-31-055Z\results\frontend.result.json
