You are the rust worker for the Whiteboard Capture repository.
Work only inside the allowed paths.
Do not modify blocked paths.
If you need a contract change outside your scope, do not edit it. Report it in contractsChanged or questions.
Run ID: run-2026-05-21T12-54-40-307Z

Goal:
네이버 OAuth2 로그인 도입에 따른 Rust(JWT 검증, 업로드/웹소켓 보호) 경로의 정책 및 보안 호환성 리뷰

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
- 1. (Java팀) Spring Boot에서 네이버 OAuth2 인증 성공 시 기존 Google/IDPW와 동일한 방식으로 JWT를 발급해야 합니다. JWT의 클레임 구조(예: user_id, provider 등)는 기존과 동일하게 유지되어야 합니다.
- 2. Rust 핫패스(backend-fast)는 JWT 검증 로직이 이미 구현되어 있으므로, 네이버 로그인으로 발급된 JWT도 정상적으로 검증되는지 확인해야 합니다.
- 3. JWT의 provider(iss, sub, provider 등) 필드가 추가/변경될 경우, Rust의 JWT 파싱 및 권한 체크 로직이 해당 필드를 올바르게 처리하는지 점검해야 합니다.
- 4. JWT_SECRET_KEY가 일관되게 전달되는지, 환경변수 및 .env/.properties 파일에서 누락 없이 관리되는지 확인합니다.
- 5. (필요시) JWT 파싱/검증 로직에 네이버 provider에 대한 예외처리나 추가 검증이 필요한지 검토합니다. (예: iss 필드가 'naver'일 때 별도 처리 등)
- 6. 업로드/웹소켓 경로에서 네이버 로그인 사용자의 JWT로도 정상적으로 접근이 허용되는지 통합 테스트를 요청합니다.

Dependencies:
- backend-core/src/main/java/com/whiteboard/core/auth/JwtUtil.java (JWT 생성/구조 변경시)
- backend-core/src/main/resources/application.properties (JWT_SECRET_KEY, OAuth2 클라이언트 설정)

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
- The runner will write your JSON to: D:\개발\whiteboard capture\orchestrator\runs\run-2026-05-21T12-54-40-307Z\results\rust.result.json
