You are the java worker for the Whiteboard Capture repository.
Work only inside the allowed paths.
Do not modify blocked paths.
If you need a contract change outside your scope, do not edit it. Report it in contractsChanged or questions.
Run ID: run-2026-05-27T06-56-46-393Z

Goal:
Spring Boot(backend-core)에서 네이버 OAuth 2.0 로그인 연동, JWT 발급, 사용자 계정 연동 및 인증 플로우 구현

Allowed paths:
- backend-core/**

Blocked paths:
- web/**
- backend-fast/**
- mobile/**

Touched areas:
- backend-core/src/main/resources/application.properties
- backend-core/src/main/java/com/whiteboard/core/auth/AuthController.java
- backend-core/src/main/java/com/whiteboard/core/auth/SecurityConfig.java
- backend-core/src/main/java/com/whiteboard/core/auth/CustomUserDetailsService.java
- backend-core/src/main/java/com/whiteboard/core/auth/JwtUtil.java
- backend-core/src/main/java/com/whiteboard/core/user/User.java
- backend-core/src/main/java/com/whiteboard/core/user/UserRepository.java

Implementation steps:
- application.properties에 이미 정의된 네이버 OAuth2 클라이언트 설정을 확인 및 보완한다.
- SecurityConfig.java에서 OAuth2 Client(네이버) 인증 엔드포인트를 활성화하고, 성공 시 커스텀 핸들러에서 JWT를 발급하도록 설정한다.
- AuthController.java에 네이버 OAuth2 인증 콜백 엔드포인트를 추가하고, 인증 성공 시 JWT를 발급하여 프론트엔드에 전달한다.
- CustomUserDetailsService.java에서 네이버 OAuth2 사용자 정보를 받아 신규/기존 사용자 계정과 연동하는 로직을 구현한다.
- User.java 및 UserRepository.java에서 네이버 계정 식별자(예: naverId) 필드를 추가하고, 최초 로그인 시 계정 생성/연동 로직을 구현한다.
- JwtUtil.java에서 JWT 발급 및 검증 로직이 네이버 로그인에도 동일하게 동작하도록 보장한다.
- 필요시 AuthResponse, AuthRequest 등 DTO를 확장하여 네이버 로그인 결과를 처리한다.

Dependencies:
- Spring Security OAuth2 Client (이미 build.gradle에 포함)
- application.properties의 네이버 OAuth2 설정 값 (NAVER_CLIENT_ID 등)

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
- The runner will write your JSON to: D:\개발\whiteboard capture\orchestrator\runs\run-2026-05-27T06-56-46-393Z\results\java.result.json
