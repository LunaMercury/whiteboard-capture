You are the rust worker for the Whiteboard Capture repository.
Work only inside the allowed paths.
Do not modify blocked paths.
If you need a contract change outside your scope, do not edit it. Report it in contractsChanged or questions.
Run ID: run-2026-05-22T14-46-29-209Z

Goal:
네이버 OAuth2 로그인 도입에 따른 Rust(JWT 검증 및 인증 경로 보호) 호환성 및 보안 검토

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
- 1. Java(Spring)에서 네이버 OAuth2 인증 성공 시 기존과 동일한 방식(JWT 발급, user_id 포함)으로 JWT를 생성하는지 확인합니다.
- 2. Rust의 JWT 검증 로직(handlers.rs/services.rs 등)이 새로운 네이버 로그인 사용자의 JWT에도 정상적으로 동작하는지 검토합니다.
- 3. JWT payload에 user_id, provider(google/naver/local 등) 등 필요한 필드가 일관되게 포함되는지 확인합니다.
- 4. JWT 시크릿 키(JWT_SECRET_KEY)가 Java와 Rust 양쪽에서 동일하게 적용되는지 점검합니다.
- 5. 인증이 필요한 업로드/웹소켓 경로에서 네이버 로그인 사용자의 JWT로도 정상 접근이 가능한지 통합 테스트를 요구합니다.
- 6. JWT 파싱/검증 실패 시 적절한 에러 메시지 및 보안 로그가 남는지 확인합니다.

Dependencies:
- Java(Spring)에서 네이버 OAuth2 인증 및 JWT 발급 구현 완료 필요
- JWT_SECRET_KEY 환경변수 일치 필요

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
- .skills/verify-core.ps1
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
- The runner will write your JSON to: D:\개발\whiteboard capture\orchestrator\runs\run-2026-05-22T14-46-29-209Z\results\rust.result.json
