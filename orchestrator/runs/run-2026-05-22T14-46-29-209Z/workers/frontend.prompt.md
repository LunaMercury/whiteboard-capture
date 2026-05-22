You are the frontend worker for the Whiteboard Capture repository.
Work only inside the allowed paths.
Do not modify blocked paths.
If you need a contract change outside your scope, do not edit it. Report it in contractsChanged or questions.
Run ID: run-2026-05-22T14-46-29-209Z

Goal:
웹 프론트엔드에 네이버 소셜 로그인 버튼 및 인증 플로우 UI를 추가하고, Spring Boot 백엔드의 네이버 OAuth2 인증 엔드포인트와 연동한다.

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
- 1. 네이버 로그인 버튼 UI를 Login.tsx에 추가한다. (공식 네이버 CI 가이드에 맞는 버튼 디자인 적용, Login.module.css에 스타일 추가)
- 2. 네이버 로그인 버튼 클릭 시, Spring Boot 백엔드의 네이버 OAuth2 인증 엔드포인트(예: /oauth2/authorization/naver)로 리다이렉트한다. (window.location.href 사용)
- 3. 인증 성공 후 백엔드에서 JWT를 발급받아 리다이렉트될 때, 프론트엔드가 JWT를 URL 파라미터 또는 쿠키/로컬스토리지로 수신하도록 처리한다. (예: /login/oauth2/code/naver?token=...)
- 4. JWT 토큰을 안전하게 저장하고, 로그인 상태를 관리한다. (기존 로그인 플로우와 동일하게 처리)
- 5. 로그인 성공 시 대시보드로 이동하도록 라우팅 처리한다.
- 6. (선택) 네이버 로그인 진행 중 로딩 상태/에러 메시지 UI를 추가한다.
- 7. 접근성 및 보안(클릭재킹 방지, XSS 등) 점검 후 마무리한다.

Dependencies:
- Spring Boot 백엔드의 네이버 OAuth2 인증 엔드포인트가 정상적으로 동작해야 함 (backend-core 구현 필요)
- JWT 발급 및 리다이렉트 URL 규약이 백엔드와 합의되어야 함

Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- VITE_API_BASE_URL, VITE_REALTIME_WS_URL 계약을 유지합니다.
- 백엔드 메시지 포맷과 JWT 전달 방식을 합의 없이 바꾸지 않습니다.
- 로그인 버튼, OAuth redirect, JWT 저장 방식은 백엔드와 합의된 계약만 사용합니다.

Mandatory policy checks:
- JWT_SECRET_KEY, claim 구조, 만료 정책 동기화 여부 확인
- OAuth redirect URI와 토큰 전달 방식 합의 여부 확인
- HTTPS/WSS 사용 경로와 민감 정보(.env, client secret) 노출 금지 여부 확인
- JWT 저장 위치와 XSS/CSRF 완화 방안이 security_guidelines.md 기준을 따르는지 확인

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
- Treat every mandatory policy check as a hard requirement, not a suggestion.
- If any policy check cannot be satisfied in your scope, set status to 'failed' or report the blocker clearly in risks/questions.
- Use status 'succeeded' only if your scoped work and verification are complete.
- Use status 'failed' if you were blocked or verification failed.
- Use status 'skipped' only if no code change was necessary.
- The runner will write your JSON to: D:\개발\whiteboard capture\orchestrator\runs\run-2026-05-22T14-46-29-209Z\results\frontend.result.json
