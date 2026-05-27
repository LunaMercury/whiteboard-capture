You are the java worker for the Whiteboard Capture repository.
Work only inside the allowed paths.
Do not modify blocked paths.
If you need a contract change outside your scope, do not edit it. Report it in contractsChanged or questions.
Run ID: run-2026-05-27T06-00-32-361Z

Goal:
Spring Boot 기반 백엔드에 네이버 OAuth2 로그인을 추가하고, 인증 성공 시 JWT를 발급하여 기존 인증 플로우와 통합한다.

Allowed paths:
- backend-core/**

Blocked paths:
- web/**
- backend-fast/**
- mobile/**

Touched areas:
- backend-core/src/main/resources/application.properties
- backend-core/src/main/java/com/whiteboard/core/auth/SecurityConfig.java
- backend-core/src/main/java/com/whiteboard/core/auth/AuthController.java
- backend-core/src/main/java/com/whiteboard/core/auth/CustomUserDetailsService.java
- backend-core/src/main/java/com/whiteboard/core/auth/JwtUtil.java
- backend-core/src/main/java/com/whiteboard/core/user/User.java
- backend-core/src/main/java/com/whiteboard/core/user/UserRepository.java

Implementation steps:
- 1. application.properties에 네이버 OAuth2 클라이언트 설정(NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, NAVER_REDIRECT_URI 등) 추가 및 환경변수 연동 확인.
- 2. SecurityConfig.java에서 OAuth2 Client 등록 및 네이버 제공자 세부 설정 추가. OAuth2 로그인 성공 시 커스텀 SuccessHandler에서 JWT 발급 로직 연동.
- 3. AuthController.java에 네이버 OAuth2 인증 콜백 엔드포인트 구현(프론트엔드에서 네이버 로그인 버튼 클릭 시 리디렉션 처리).
- 4. CustomUserDetailsService.java에서 네이버 계정 정보로 사용자 자동 등록/매핑 로직 추가(최초 로그인 시 User 엔티티 생성, 이후 로그인 시 기존 계정 매핑).
- 5. JwtUtil.java에서 네이버 로그인 사용자도 동일하게 JWT 발급 및 검증 가능하도록 구현.
- 6. User.java, UserRepository.java에서 네이버 계정 식별자(예: provider, providerId 필드) 추가 및 조회 메서드 보강.
- 7. (선택) AuthResponse, AuthRequest 등 DTO에 provider 정보 명시.
- 8. 기존 Google/IDPW 로그인과 동일하게 JWT를 반환하도록 통합.
- 9. 보안 정책에 따라 네이버 OAuth2 인증 경로에 대한 CORS, CSRF, 입력 검증 등 추가 점검.
- 10. .skills/verify-core.ps1로 전체 인증 플로우 및 JWT 발급 정상 동작 확인.

Dependencies:
- Spring Security OAuth2 Client (이미 build.gradle에 포함됨)
- 네이버 OAuth2 클라이언트 등록 정보 (.env 및 application.properties)
- User 엔티티 및 Repository 구조

Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- JWT 발급 구조와 사용자 식별 계약을 Rust/Web/Mobile과 일치시킵니다.
- application.properties와 .env 기반 환경설정 정책을 유지합니다.
- OAuth provider 연동, 사용자 식별, JWT 발급 구조를 전체 클라이언트와 일치시킵니다.

Mandatory policy checks:
- JWT_SECRET_KEY, claim 구조, 만료 정책 동기화 여부 확인
- OAuth redirect URI와 토큰 전달 방식 합의 여부 확인
- HTTPS/WSS 사용 경로와 민감 정보(.env, client secret) 노출 금지 여부 확인
- JWT 저장 위치와 XSS/CSRF 완화 방안이 security_guidelines.md 기준을 따르는지 확인

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
- Treat every mandatory policy check as a hard requirement, not a suggestion.
- If any policy check cannot be satisfied in your scope, set status to 'failed' or report the blocker clearly in risks/questions.
- Use status 'succeeded' only if your scoped work and verification are complete.
- Use status 'failed' if you were blocked or verification failed.
- Use status 'skipped' only if no code change was necessary.
- The runner will write your JSON to: D:\개발\whiteboard capture\orchestrator\runs\run-2026-05-27T06-00-32-361Z\results\java.result.json
