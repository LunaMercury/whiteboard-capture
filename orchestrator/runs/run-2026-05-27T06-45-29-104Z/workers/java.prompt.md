You are the java worker for the Whiteboard Capture repository.
Work only inside the allowed paths.
Do not modify blocked paths.
If you need a contract change outside your scope, do not edit it. Report it in contractsChanged or questions.
Run ID: run-2026-05-27T06-45-29-104Z

Goal:
Spring Boot 기반 백엔드에 네이버 OAuth 2.0 로그인 기능을 추가하여, 네이버 계정으로 로그인 시 JWT를 발급하고 신규/기존 사용자 계정과 연동되도록 구현합니다.

Allowed paths:
- backend-core/**

Blocked paths:
- web/**
- backend-fast/**
- mobile/**

Touched areas:
- backend-core/src/main/java/com/whiteboard/core/auth/AuthController.java
- backend-core/src/main/java/com/whiteboard/core/auth/SecurityConfig.java
- backend-core/src/main/resources/application.properties

Implementation steps:
- 1. build.gradle에 네이버 OAuth2 클라이언트 연동에 필요한 spring-security-oauth2-client 의존성이 이미 포함되어 있는지 확인(이미 있음).
- 2. application.properties에 네이버 OAuth2 클라이언트 설정(NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, NAVER_REDIRECT_URI 등) 값이 있는지 확인 및 필요시 .env와 동기화.
- 3. SecurityConfig.java에서 OAuth2 로그인 엔드포인트(/oauth2/authorization/naver) 및 콜백 경로를 활성화하고, OAuth2UserService를 커스터마이징하여 네이버 사용자 정보(이메일, 이름 등)를 파싱하도록 구현.
- 4. AuthController.java에 네이버 OAuth 인증 성공 시 JWT를 발급하고, 신규 사용자는 UserRepository를 통해 자동 회원가입 처리, 기존 사용자는 계정 연동 처리 로직 추가.
- 5. JWT 발급 및 응답 포맷(AuthResponse 등) 일관성 유지. 프론트엔드에서 사용할 수 있도록 JWT와 사용자 정보를 반환.
- 6. (선택) 네이버 OAuth 인증 실패/취소 시 에러 핸들링 및 리다이렉트 처리.
- 7. 기존 JWT 발급/검증 로직(JwtUtil 등)과 통합 테스트.
- 8. .skills/verify-core.ps1 스크립트로 전체 인증 플로우 및 JWT 발급 정상 동작 여부 검증.

Dependencies:
- spring-security-oauth2-client (이미 build.gradle에 포함)
- UserRepository, JwtUtil 등 기존 인증/계정 관리 컴포넌트

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
- The runner will write your JSON to: D:\개발\whiteboard capture\orchestrator\runs\run-2026-05-27T06-45-29-104Z\results\java.result.json
