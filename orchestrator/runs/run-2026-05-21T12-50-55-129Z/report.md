# Orchestration Result

Request: 네이버 로그인 기능을 만들어줘

## Applied Templates
```yaml
categories:
  - auth
flags:
  web_only: false
  mobile_requested: false
  service_wide: false
  hot_path_redis: false
templates:
  auth:
    note: "auth/JWT 작업에는 backend-core 구현과 backend-fast 리뷰가 기본으로 포함됩니다."
    variants:
      webOnly: "웹 전용 인증 요청이면 모바일은 제외할 수 있습니다."
      nonWebOnly: "사용자 대상 로그인 제공자 추가 작업은 모바일도 최소 리뷰 이상 참여합니다."
    verifier_checks:
      - "JWT_SECRET_KEY, claim 구조, 만료 정책 동기화 여부 확인"
      - "OAuth redirect URI와 토큰 전달 방식 합의 여부 확인"
      - "HTTPS/WSS 사용 경로와 민감 정보(.env, client secret) 노출 금지 여부 확인"
      - "JWT 저장 위치와 XSS/CSRF 완화 방안이 security_guidelines.md 기준을 따르는지 확인"
```

## Manager Summary
네이버 로그인 기능을 만들어줘 요청에 대해 Java(Spring Boot)는 구현, Rust(backend-fast)는 리뷰, 웹 프론트엔드는 구현, 모바일(Android)은 리뷰 모드로 참여합니다. 최종 참여 수준은 프로젝트 강제 정책과 저장소 구조를 기준으로 정해졌습니다.

## Integration Notes
- Java(Spring Boot)는 OAuth와 JWT 발급 로직을 구현해야 합니다.
- Rust(backend-fast)는 JWT 검증과 업로드/웹소켓 인증 경로 호환성을 검토해야 합니다.
- 웹 프론트엔드는 로그인 UI와 인증 플로우 연동을 구현해야 합니다.
- 모바일(Android)은 모바일 로그인 진입점과 JWT 저장/복원 흐름 영향 여부를 검토해야 합니다.

## Exclusion Reasons
- frontend: participating
- rust: participating
- java: participating
- mobile: participating

## Specialist Plans
### frontend
Mode: implement
Goal: React 프론트엔드에 네이버 소셜 로그인 UI 및 인증 플로우를 추가하고, Spring Boot 백엔드의 네이버 OAuth 2.0 엔드포인트와 연동하여 JWT를 받아 로그인 상태를 관리한다.
Touched areas: web/src/components/Login.tsx, web/src/components/Login.module.css, web/src/config.ts
Implementation steps:
- 1. 네이버 로그인 버튼 UI를 Login.tsx에 추가한다. (공식 네이버 CI 가이드에 따라 버튼 스타일 적용, Login.module.css에 스타일 추가)
- 2. 네이버 OAuth 2.0 인증 요청 URL을 config.ts에 상수로 정의한다. (백엔드에서 제공하는 네이버 로그인 엔드포인트로 리디렉션)
- 3. 사용자가 네이버 로그인 버튼을 클릭하면, 네이버 인증 플로우(백엔드 엔드포인트로 이동)를 시작한다. (window.location.href 사용)
- 4. 네이버 인증 후 백엔드에서 JWT를 발급받아 프론트엔드로 리디렉션되면, 쿼리스트링 또는 해시에서 JWT를 추출하여 localStorage/sessionStorage에 저장한다. (Login.tsx에서 useEffect로 처리)
- 5. JWT가 저장되면 로그인 상태로 전환하고, 대시보드 등 보호된 컴포넌트 접근을 허용한다.
- 6. 기존 Google/IDPW 로그인과 동일한 방식으로 JWT 인증 헤더를 API/WebSocket에 적용한다.
- 7. 로그인 실패/취소/에러 상황에 대한 안내 메시지 및 UI 피드백을 추가한다.
Dependencies:
- Spring Boot 백엔드의 네이버 OAuth 2.0 인증 엔드포인트 및 JWT 발급/리디렉션 구현 (backend-core)
- JWT 토큰 형식 및 저장 방식은 기존 Google 로그인과 동일하게 유지
- 백엔드에서 리디렉션 URI 및 JWT 전달 방식(쿼리/해시 등)과의 계약 확인 필요
Verification:
- .skills/verify-web.ps1
- .skills/verify-core.ps1
- .skills/verify-fast.ps1
- .skills/verify-all.ps1
Risks:
- 네이버 로그인 콜백 URI가 프론트엔드와 정확히 일치해야 하며, 백엔드(Spring Boot)와의 리디렉션 및 JWT 전달 방식이 사전에 합의되어야 함.
- 네이버 OAuth 인증 실패/취소 시 UI에서 적절한 에러 처리가 필요함.
- 네이버 로그인 버튼 디자인은 공식 가이드 준수 필요.

### rust
Mode: review
Goal: 네이버 OAuth 2.0 로그인 도입에 따라 Rust 핫패스(backend-fast)의 JWT 검증 및 인증 경로 보호가 올바르게 동작하는지 검토하고, Java(Spring Boot)에서 발급한 JWT가 Rust에서 정상적으로 수용되는지 보장합니다.
Touched areas: backend-fast/src/handlers.rs, backend-fast/src/services.rs, backend-fast/src/main.rs
Implementation steps:
- 1. Java(Spring Boot)에서 네이버 OAuth 2.0 인증 및 JWT 발급 로직이 점검될 예정이므로, Rust에서 사용하는 JWT 파싱/검증 로직이 기존과 동일한 방식(alg, secret, claim 구조 등)으로 동작하는지 확인합니다.
- 2. backend-fast/src/services.rs 내 JWT 검증 함수가 Java에서 발급한 토큰(네이버 로그인 포함)을 올바르게 파싱하는지 테스트합니다. (예: iss, sub, exp, user_id 등 claim 구조 일치 여부)
- 3. backend-fast/src/handlers.rs에서 업로드, WebSocket 등 인증이 필요한 엔드포인트가 JWT 미포함/유효하지 않은 경우 401을 반환하는지 재확인합니다.
- 4. ALLOWED_WEB_ORIGINS, PUBLIC_BASE_URL 등 환경변수 기반 CORS 정책이 네이버 로그인 후 리다이렉트 플로우에도 문제없는지 점검합니다.
- 5. 필요시 README 또는 주석에 '네이버 OAuth 점검 시 JWT claim 구조 변경사항 없음' 등 리뷰 결과를 명시합니다.
Dependencies:
- Java(Spring Boot)에서 JWT 발급 방식이 변경될 경우(예: claim 추가/변경) Rust 쪽 파싱 로직도 반드시 동기화해야 함.
- .env 및 환경변수(JWT_SECRET_KEY 등)는 Java와 Rust가 동일하게 유지되어야 함.
Verification:
- .skills/verify-fast.ps1
- .skills/verify-core.ps1
- .skills/verify-all.ps1
Risks:
- Java(Spring Boot)에서 JWT claim 구조(예: user_id, provider 등)가 변경되면 Rust의 파싱/검증 로직이 실패할 수 있음. 이 경우 backend-fast/src/services.rs의 JWT 파싱 로직을 반드시 동기화해야 함.
- 네이버 OAuth 인증 후 발급되는 JWT가 기존 Google/IDPW 로그인과 동일한 claim 구조를 유지하는지 반드시 확인 필요.
- JWT_SECRET_KEY가 일치하지 않으면 인증이 모두 실패하므로, 환경변수 관리에 주의해야 함.
- 네이버 로그인 도입으로 인한 인증 플로우 변경이 업로드/웹소켓 핫패스에 미치는 영향(예: 토큰 만료, CORS, 리다이렉트 등)도 통합 테스트 필요.

### java
Mode: implement
Goal: Spring Boot 기반 백엔드에 네이버 OAuth 2.0 소셜 로그인 기능을 추가하여, 네이버 계정으로 로그인 시 JWT를 발급하고, 기존 인증/회원 관리 체계와 통합한다.
Touched areas: backend-core/src/main/java/com/whiteboard/core/auth/AuthController.java, backend-core/src/main/java/com/whiteboard/core/auth/SecurityConfig.java, backend-core/src/main/java/com/whiteboard/core/user/User.java, backend-core/src/main/java/com/whiteboard/core/user/UserRepository.java
Implementation steps:
- 1. build.gradle에 네이버 OAuth2 클라이언트 의존성(spring-security-oauth2-client) 추가.
- 2. application.properties에 네이버 OAuth2 클라이언트 ID, Secret, Redirect URI 등 설정 보강.
- 3. SecurityConfig에 네이버 OAuth2 클라이언트 등록 및 인증 플로우 허용 경로 추가.
- 4. /auth/naver/login 엔드포인트: 네이버 인증 URL로 리다이렉트하는 컨트롤러 메서드 구현.
- 5. /auth/naver/callback 엔드포인트: 네이버에서 콜백 시 code/state를 받아 액세스 토큰 요청 및 사용자 정보 조회, 신규/기존 사용자 처리, JWT 발급 및 반환 로직 구현.
- 6. NaverOAuthService.java 신규 생성: 네이버 토큰 교환, 사용자 정보 조회, 회원가입/로그인 통합 처리, JWT 발급 로직 구현.
- 7. User 엔티티 및 UserRepository에 네이버 소셜 ID(네이버 고유 식별자) 필드 및 조회 메서드 추가.
- 8. AuthController에 네이버 로그인 관련 엔드포인트 추가 및 기존 AuthResponse/JWT 발급 로직과 통합.
- 9. (선택) NaverOAuthCallbackRequest DTO 생성: 콜백 파라미터(code, state) 매핑용.
- 10. 기존 인증(JWT) 필터 및 유저 세부정보 서비스가 네이버 소셜 로그인 유저도 정상 처리하도록 보강.
- 11. (테스트) 네이버 로그인 플로우 전체 통합 테스트 및 예외 처리 보강.
Dependencies:
- spring-security-oauth2-client (build.gradle)
- UserRepository, User 엔티티
- JwtUtil, AuthResponse 등 기존 인증 모듈
Verification:
- .skills/verify-core.ps1
- .skills/verify-all.ps1
Risks:
- 네이버 OAuth2 인증 플로우는 외부 API(네이버)와의 통신이므로, 네트워크 장애나 네이버 API 변경에 취약할 수 있음.
- User 엔티티에 네이버 고유 ID 필드 추가 시 DB 마이그레이션 필요(기존 데이터 영향 주의).
- 프론트엔드와의 콜백 URI, JWT 저장 방식 등 연동 규약이 맞지 않으면 인증 실패 가능성 있음.
- 네이버 OAuth2 인증 실패/취소/예외 상황에 대한 예외 처리 및 사용자 경험 보강 필요.
- 테스트 환경에서는 네이버 개발자 콘솔에 등록된 Redirect URI와 실제 서버 주소가 일치해야 함.

### mobile
Mode: review
Goal: 네이버 소셜 로그인(OAuth 2.0) 기능 추가에 대한 모바일(Android) 모듈의 영향 및 호환성 검토
Touched areas: mobile/app/src/main/java/com/example/whiteboardcapture/MainActivity.kt
Implementation steps:
- 현재 요청에서는 모바일(Android) 앱에 네이버 로그인 UI 또는 인증 플로우 점검 요구가 명시되지 않았으므로, 직접적인 코드 검토은 생략합니다.
- 향후 네이버 로그인을 모바일에 도입할 경우, 네이버 OAuth SDK(Android) 연동, JWT 발급 및 Rust 업로드 경로와의 연동, 보안 검토가 필요합니다.
- 모바일에서 네이버 로그인 도입 시, Spring Boot(Java)에서 발급한 JWT를 정상적으로 수신·저장하고, 기존 Google/ID-PW 로그인과 동일한 방식으로 업로드 API에 인증 헤더를 포함해야 합니다.
- 네이버 로그인 도입 시, 기존 CameraX 촬영 및 업로드 플로우와의 충돌 여부(예: 로그인 상태 관리, 토큰 만료 처리 등)도 반드시 검토해야 합니다.
Dependencies:
- 네이버 로그인 기능은 backend-core(Java/Spring Boot)에서 OAuth 인증 및 JWT 발급을 담당하므로, 모바일은 해당 API 명세에 맞춰 연동해야 합니다.
- backend-fast(Rust)는 JWT 검증만 담당하므로, 모바일에서 발급받은 JWT가 Rust 업로드/웹소켓 경로에서 정상적으로 인식되는지 확인이 필요합니다.
Verification:
- .skills/verify-mobile.ps1
Risks:
- 현재 mobile 디렉토리 내에는 네이버 로그인 관련 코드, UI, 또는 인증 플로우가 존재하지 않습니다. 추후 요구가 있을 경우 신규 파일/구현이 필요합니다.
- 네이버 로그인 연동 시, 네이버 OAuth Android SDK 및 인증 콜백 처리, JWT 저장 방식, 보안(HTTPS) 적용 등 추가 검토가 필요합니다.
- 네이버 로그인 도입 시, 기존 Google/ID-PW 로그인과의 UX 일관성 및 토큰 관리 정책 충돌 가능성에 유의해야 합니다.

## Worker Task Packets
### frontend
Mode: implement
Goal: React 프론트엔드에 네이버 소셜 로그인 UI 및 인증 플로우를 추가하고, Spring Boot 백엔드의 네이버 OAuth 2.0 엔드포인트와 연동하여 JWT를 받아 로그인 상태를 관리한다.
Allowed paths: web/**
Blocked paths: backend-fast/**, backend-core/**, mobile/**
Touched areas: web/src/components/Login.tsx, web/src/components/Login.module.css, web/src/config.ts
Required verification: .skills/verify-web.ps1, .skills/verify-core.ps1, .skills/verify-fast.ps1, .skills/verify-all.ps1
Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- VITE_API_BASE_URL, VITE_REALTIME_WS_URL 계약을 유지합니다.
- 백엔드 메시지 포맷과 JWT 전달 방식을 합의 없이 바꾸지 않습니다.
- 로그인 버튼, OAuth redirect, JWT 저장 방식은 백엔드와 합의된 계약만 사용합니다.
Expected handoff: changed_files, summary, contracts_changed, verification_run, risks, questions

### rust
Mode: review
Goal: 네이버 OAuth 2.0 로그인 도입에 따라 Rust 핫패스(backend-fast)의 JWT 검증 및 인증 경로 보호가 올바르게 동작하는지 검토하고, Java(Spring Boot)에서 발급한 JWT가 Rust에서 정상적으로 수용되는지 보장합니다.
Allowed paths: backend-fast/**
Blocked paths: web/**, backend-core/**, mobile/**
Touched areas: backend-fast/src/handlers.rs, backend-fast/src/services.rs, backend-fast/src/main.rs
Required verification: .skills/verify-fast.ps1, .skills/verify-core.ps1, .skills/verify-all.ps1
Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- JWT_SECRET_KEY, ALLOWED_WEB_ORIGINS, PUBLIC_BASE_URL 계약을 유지합니다.
- 업로드 hot path와 websocket fan-out의 성능 특성을 해치지 않습니다.
- JWT_SECRET_KEY, claim 구조, 만료 정책이 Spring 발급 토큰과 일치해야 합니다.
Expected handoff: changed_files, summary, contracts_changed, verification_run, risks, questions

### java
Mode: implement
Goal: Spring Boot 기반 백엔드에 네이버 OAuth 2.0 소셜 로그인 기능을 추가하여, 네이버 계정으로 로그인 시 JWT를 발급하고, 기존 인증/회원 관리 체계와 통합한다.
Allowed paths: backend-core/**
Blocked paths: web/**, backend-fast/**, mobile/**
Touched areas: backend-core/src/main/java/com/whiteboard/core/auth/AuthController.java, backend-core/src/main/java/com/whiteboard/core/auth/SecurityConfig.java, backend-core/src/main/java/com/whiteboard/core/user/User.java, backend-core/src/main/java/com/whiteboard/core/user/UserRepository.java
Required verification: .skills/verify-core.ps1, .skills/verify-all.ps1
Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- JWT 발급 구조와 사용자 식별 계약을 Rust/Web/Mobile과 일치시킵니다.
- application.properties와 .env 기반 환경설정 정책을 유지합니다.
- OAuth provider 연동, 사용자 식별, JWT 발급 구조를 전체 클라이언트와 일치시킵니다.
Expected handoff: changed_files, summary, contracts_changed, verification_run, risks, questions

### mobile
Mode: review
Goal: 네이버 소셜 로그인(OAuth 2.0) 기능 추가에 대한 모바일(Android) 모듈의 영향 및 호환성 검토
Allowed paths: mobile/**
Blocked paths: web/**, backend-fast/**, backend-core/**
Touched areas: mobile/app/src/main/java/com/example/whiteboardcapture/MainActivity.kt
Required verification: .skills/verify-mobile.ps1
Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- Spring 로그인 계약과 Rust 업로드 인증 계약을 임의로 바꾸지 않습니다.
- 모바일의 JWT 저장/복원 흐름이 기존 업로드 경로와 호환되어야 합니다.
- 모바일 로그인 진입점이 추가되면 JWT 저장/복원과 업로드 인증 흐름이 기존 계약을 유지해야 합니다.
Expected handoff: changed_files, summary, contracts_changed, verification_run, risks, questions

## Worker Result Packets
### frontend
Status: pending
Summary: frontend worker의 실제 실행 결과가 아직 수집되지 않았습니다.
Changed files: none
Verification run: none
Risks:
- 실행기(worker runner)가 아직 연결되지 않아 결과 packet은 placeholder 상태입니다.
Questions:
- 이 worker를 어떤 실행기로 돌릴지(master 세션, Codex CLI, 별도 API worker) 결정이 필요합니다.

### rust
Status: pending
Summary: rust worker의 실제 실행 결과가 아직 수집되지 않았습니다.
Changed files: none
Verification run: none
Risks:
- 실행기(worker runner)가 아직 연결되지 않아 결과 packet은 placeholder 상태입니다.
Questions:
- 이 worker를 어떤 실행기로 돌릴지(master 세션, Codex CLI, 별도 API worker) 결정이 필요합니다.

### java
Status: pending
Summary: java worker의 실제 실행 결과가 아직 수집되지 않았습니다.
Changed files: none
Verification run: none
Risks:
- 실행기(worker runner)가 아직 연결되지 않아 결과 packet은 placeholder 상태입니다.
Questions:
- 이 worker를 어떤 실행기로 돌릴지(master 세션, Codex CLI, 별도 API worker) 결정이 필요합니다.

### mobile
Status: pending
Summary: mobile worker의 실제 실행 결과가 아직 수집되지 않았습니다.
Changed files: none
Verification run: none
Risks:
- 실행기(worker runner)가 아직 연결되지 않아 결과 packet은 placeholder 상태입니다.
Questions:
- 이 worker를 어떤 실행기로 돌릴지(master 세션, Codex CLI, 별도 API worker) 결정이 필요합니다.

## Verifier Review
Summary: 네이버 로그인(OAuth 2.0) 기능 추가에 대한 전체 설계와 작업 분할, 정책 준수 여부, 위험요소, 실행 가능성에 대한 검토 결과입니다.
Findings:
- 매니저 결정과 스페셜리스트 계획 모두 Whiteboard Capture의 정책(AGENTS.md, security_guidelines.md 등)에 따라 인증/소셜 로그인은 Java(Spring Boot)에서 구현, Rust는 JWT 검증 및 리뷰, 프론트엔드는 UI/플로우 구현, 모바일은 이번 요청에서 제외로 명확히 역할 분담이 이루어졌습니다.
- 각 워커 패킷은 실제로 만질 파일, 구현 단계, 검증 스크립트, 계약 준수 사항을 구체적으로 명시하고 있습니다.
- 프론트엔드는 네이버 로그인 버튼, 인증 플로우, JWT 저장 등 UI/UX와 인증 연동을 담당하며, 백엔드(Spring Boot)에서 JWT 발급 및 리디렉션 방식과의 계약을 명확히 요구하고 있습니다.
- Rust(backend-fast)는 JWT claim 구조, secret key, 만료 정책 등 인증 계약이 변경될 경우 반드시 동기화해야 함을 강조하고 있습니다.
- Java(Spring Boot)는 네이버 OAuth2 인증, JWT 발급, User 엔티티 확장, 예외 처리 등 핵심 인증 로직을 담당하며, DB 마이그레이션 및 외부 API 연동 위험을 인지하고 있습니다.
- 모바일은 이번에 직접 구현하지 않지만, 추후 네이버 로그인 도입 시 고려사항을 명확히 기술하고 있습니다.
Contract checks:
- security_guidelines.md의 인증/인가, 데이터 보호, CORS 정책을 모두 준수하도록 설계되어 있습니다.
- JWT_SECRET_KEY, claim 구조, 환경변수 명칭 등 핵심 계약을 임의로 변경하지 않으며, 변경 시 반드시 마스터 세션에 보고하도록 명시되어 있습니다.
- 프론트엔드와 백엔드 간 JWT 전달 방식(쿼리/해시 등), 리디렉션 URI, 사용자 식별 방식 등은 사전 합의 및 계약에 따라 구현하도록 되어 있습니다.
- 모든 인증 관련 변경은 Rust(backend-fast) 리뷰를 필수로 포함하며, 모바일은 추후 확장 시 계약 준수 검토가 필요합니다.
- JWT_SECRET_KEY, claim 구조, 만료 정책 동기화 여부 확인
- OAuth redirect URI와 토큰 전달 방식 합의 여부 확인
- HTTPS/WSS 사용 경로와 민감 정보(.env, client secret) 노출 금지 여부 확인
- JWT 저장 위치와 XSS/CSRF 완화 방안이 security_guidelines.md 기준을 따르는지 확인
Recommended verification:
- .skills/verify-web.ps1
- .skills/verify-core.ps1
- .skills/verify-fast.ps1
- .skills/verify-all.ps1
Release blockers:
- 네이버 OAuth2 인증 플로우에서 JWT claim 구조, secret key, 만료 정책이 기존 Google/IDPW 로그인과 완전히 일치하지 않으면 Rust(backend-fast)에서 인증이 실패할 수 있습니다. 이 경우 반드시 claim 구조를 동기화해야 하며, 미동기화 시 배포 불가입니다.
- User 엔티티에 네이버 고유 ID 필드 추가 시 DB 마이그레이션이 필요하며, 기존 데이터와의 호환성 문제가 발생할 수 있습니다. 마이그레이션 계획 및 테스트가 없으면 배포 불가입니다.
- 프론트엔드와 백엔드 간 리디렉션 URI, JWT 전달 방식(쿼리/해시 등)이 불일치할 경우 인증 플로우가 동작하지 않으므로, 명확한 계약 및 통합 테스트가 필요합니다.
- 네이버 OAuth2 인증 실패/취소/예외 상황에 대한 예외 처리 및 사용자 경험(UI 피드백)이 미흡할 경우, 사용자 혼란 및 보안 취약점이 발생할 수 있습니다.
