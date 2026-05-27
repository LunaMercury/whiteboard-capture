You are the rust worker for the Whiteboard Capture repository.
Work only inside the allowed paths.
Do not modify blocked paths.
If you need a contract change outside your scope, do not edit it. Report it in contractsChanged or questions.
Run ID: run-2026-05-27T06-56-46-393Z

Goal:
네이버 OAuth 2.0 로그인 기능 추가에 대한 Rust(backend-fast) 모듈의 보안 및 JWT 검증 경로 리뷰

Allowed paths:
- backend-fast/**

Blocked paths:
- web/**
- backend-core/**
- mobile/**

Touched areas:
- backend-fast/src/handlers.rs
- backend-fast/src/services.rs
- backend-fast/src/main.rs

Implementation steps:
- 1. Java(Spring Boot)에서 네이버 OAuth 인증 및 JWT 발급 로직이 추가될 예정이므로, Rust에서는 JWT의 payload와 서명 검증이 네이버 로그인 사용자에 대해서도 동일하게 동작하는지 확인해야 합니다.
- 2. JWT 검증 로직(backend-fast/src/services.rs 또는 handlers.rs 내 관련 함수)이 'sub', 'user_id', 'provider' 등 네이버 로그인 사용자의 claim 구조를 올바르게 파싱하는지 점검합니다.
- 3. JWT_SECRET_KEY가 .env 및 런타임 환경에서 일관되게 전달되는지, 네이버 로그인 사용자도 기존 Google/자체 로그인과 동일하게 인증 경로를 통과하는지 테스트합니다.
- 4. (필요시) JWT payload 내 'provider' 필드 등 신규 claim이 추가될 경우, Rust의 JWT 파싱 구조체(serde 등)가 이를 허용하도록 업데이트합니다.
- 5. WebSocket 및 이미지 업로드 엔드포인트에서 네이버 로그인 사용자의 JWT가 정상적으로 인증/인가되는지 통합 테스트를 수행합니다.

Dependencies:
- Java(Spring Boot)에서 JWT 발급 시 네이버 로그인 사용자를 위한 claim 구조 및 secret key 일치 필요
- .env 및 런타임 환경에서 JWT_SECRET_KEY 일관성 유지

Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- JWT_SECRET_KEY, ALLOWED_WEB_ORIGINS, PUBLIC_BASE_URL 계약을 유지합니다.
- 업로드 hot path와 websocket fan-out의 성능 특성을 해치지 않습니다.
- JWT_SECRET_KEY, claim 구조, 만료 정책이 Spring 발급 토큰과 일치해야 합니다.

Mandatory policy checks:
- JWT_SECRET_KEY, claim 구조, 만료 정책 동기화 여부 확인
- OAuth redirect URI와 토큰 전달 방식 합의 여부 확인
- HTTPS/WSS 사용 경로와 민감 정보(.env, client secret) 노출 금지 여부 확인
- JWT 저장 위치와 XSS/CSRF 완화 방안이 security_guidelines.md 기준을 따르는지 확인

Required verification:
- .skills/verify-fast.ps1
- .skills/verify-all.ps1

Instructions:
- Do not modify repository files in the worker phase.
- Produce proposedEdits only; the apply phase is responsible for actual file changes.
- Do not claim that verification commands were run unless you actually executed them in this worker runtime and observed the result.
- If you cannot execute local verification commands, leave verificationRun as an empty array and list the required verification in risks/questions when relevant.
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
- The runner will write your JSON to: D:\개발\whiteboard capture\orchestrator\runs\run-2026-05-27T06-56-46-393Z\results\rust.result.json
