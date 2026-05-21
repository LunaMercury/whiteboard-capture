You are the java worker for the Whiteboard Capture repository.
Work only inside the allowed paths.
Do not modify blocked paths.
If you need a contract change outside your scope, do not edit it. Report it in contractsChanged or questions.
Run ID: run-2026-05-21T08-36-01-639Z

Goal:
Spring Boot 백엔드에 네이버 OAuth2 로그인 연동, JWT 발급 및 기존 인증 체계와 통합 구현

Allowed paths:
- backend-core/**

Blocked paths:
- web/**
- backend-fast/**
- mobile/**

Touched areas:
- backend-core/src/main/java/com/whiteboard/core/auth/AuthController.java
- backend-core/src/main/java/com/whiteboard/core/auth/SecurityConfig.java
- backend-core/src/main/java/com/whiteboard/core/auth/JwtUtil.java
- backend-core/src/main/java/com/whiteboard/core/user/User.java
- backend-core/src/main/java/com/whiteboard/core/user/UserRepository.java
- backend-core/src/main/resources/application.properties

Implementation steps:
- 1. .env 및 application.properties에 네이버 OAuth 클라이언트 ID, 시크릿, 콜백 URL 환경변수 추가 (예: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, NAVER_REDIRECT_URI).
- 2. SecurityConfig에 네이버 OAuth2 클라이언트 등록 및 OAuth2 로그인 엔드포인트 활성화. (spring.security.oauth2.client.registration.naver.* 등)
- 3. AuthController에 /auth/naver/login, /auth/naver/callback 엔드포인트 추가: 네이버 인증 URL 리다이렉트, 콜백에서 code/state 처리, 네이버 토큰 및 프로필 API 호출, 신규/기존 사용자 처리, JWT 발급 및 반환.
- 4. User 엔티티 및 UserRepository에 네이버 소셜 로그인 식별자(예: naverId) 필드 추가 및 조회/저장 로직 확장.
- 5. JwtUtil 등 JWT 발급 로직에서 네이버 로그인 사용자도 동일하게 JWT를 발급하도록 통합.
- 6. (선택) AuthResponse 등 DTO에 provider, providerId 등 소셜 로그인 정보 포함.
- 7. 기존 인증(JWT, OAuth2) 흐름과 충돌 없도록 통합 테스트 및 예외 처리.
- 8. .skills/verify-core.ps1로 전체 인증 플로우 자동 검증.
- 9. (프론트/모바일 연동을 위해) 네이버 로그인 엔드포인트 및 JWT 반환 형식 문서화.

Dependencies:
- spring-boot-starter-oauth2-client 의존성 (이미 spring-boot-starter-security 포함됨)
- 네이버 OAuth2 공식 문서 및 REST API 명세
- User 엔티티/Repository 확장
- 프론트엔드/모바일과 JWT 계약 유지

Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- JWT 발급 구조와 사용자 식별 계약을 Rust/Web/Mobile과 일치시킵니다.
- application.properties와 .env 기반 환경설정 정책을 유지합니다.
- OAuth provider 연동, 사용자 식별, JWT 발급 구조를 전체 클라이언트와 일치시킵니다.

Required verification:
- .skills/verify-core.ps1

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
- The runner will write your JSON to: D:\개발\whiteboard capture\orchestrator\runs\run-2026-05-21T08-36-01-639Z\results\java.result.json
