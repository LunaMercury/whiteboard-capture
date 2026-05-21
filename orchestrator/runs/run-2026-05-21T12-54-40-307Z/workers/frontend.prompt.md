You are the frontend worker for the Whiteboard Capture repository.
Work only inside the allowed paths.
Do not modify blocked paths.
If you need a contract change outside your scope, do not edit it. Report it in contractsChanged or questions.
Run ID: run-2026-05-21T12-54-40-307Z

Goal:
웹 프론트엔드에 네이버 로그인 버튼 및 인증 플로우를 추가하여 사용자가 네이버 계정으로 로그인할 수 있도록 한다.

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
- 1. 네이버 로그인 버튼 UI를 디자인하고 Login.tsx에 추가한다. (공식 네이버 CI 가이드에 따라 버튼 스타일 적용, Login.module.css에 스타일 추가)
- 2. 네이버 OAuth2 인증 요청 URL을 백엔드(Spring Boot)에서 제공하도록 설계되어 있으므로, 프론트엔드에서 해당 URL로 리다이렉트하는 로직을 구현한다. (예: '/auth/oauth2/authorization/naver' 엔드포인트로 이동)
- 3. 네이버 인증 후 백엔드에서 JWT를 발급받아 리다이렉트될 때, 기존 Google 로그인과 동일하게 JWT를 수신 및 저장하는 로직을 Login.tsx에 통합한다.
- 4. 로그인 성공 시 대시보드로 이동 및 사용자 상태 갱신 처리(기존 Google/IDPW와 동일한 방식).
- 5. 인증 플로우 중 에러/취소/실패 케이스에 대한 UI 피드백 및 안내 메시지 추가.
- 6. 접근성 및 반응형 디자인을 검토하여 버튼 및 안내 메시지의 시각적 일관성 확보.
- 7. (선택) 네이버 공식 JS SDK를 사용하지 않고, 백엔드 리다이렉트 방식만 활용한다면 외부 스크립트 삽입 없이 구현한다.

Dependencies:
- 네이버 OAuth2 인증 엔드포인트가 backend-core(Spring Boot)에서 '/auth/oauth2/authorization/naver' 등으로 제공되어야 함.
- 로그인 성공 시 JWT 발급 및 리다이렉트 URL이 기존 Google/IDPW와 동일한 방식으로 동작해야 함.
- 백엔드에서 네이버 인증 처리 및 JWT 발급이 정상적으로 구현되어 있어야 함.

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
- The runner will write your JSON to: D:\개발\whiteboard capture\orchestrator\runs\run-2026-05-21T12-54-40-307Z\results\frontend.result.json
