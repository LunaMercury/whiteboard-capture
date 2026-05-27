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
Goal: 웹 프론트엔드에 네이버 OAuth 2.0 로그인 버튼 및 인증 플로우를 추가하여 사용자가 네이버 계정으로 로그인할 수 있도록 한다.
Touched areas: web/src/components/Login.tsx, web/src/components/Login.module.css, web/src/config.ts
Implementation steps:
- 1. 네이버 로그인 버튼 UI를 Login.tsx에 추가한다. (공식 네이버 CI 가이드에 따라 SVG 또는 이미지 사용)
- 2. 네이버 로그인 버튼 클릭 시 Spring Boot 백엔드의 네이버 OAuth2 인증 엔드포인트(예: /oauth2/authorization/naver)로 리다이렉트한다. (VITE_API_BASE_URL 활용)
- 3. 인증 성공 후 백엔드에서 콜백 URL로 JWT를 발급해 프론트엔드로 전달하도록 한다. (백엔드 구현과 연동 필요)
- 4. 프론트엔드는 콜백 URL(예: /login/oauth2/code/naver)에서 JWT를 파싱하여 localStorage/sessionStorage에 저장하고, 로그인 상태를 갱신한다.
- 5. 로그인 성공 시 대시보드로 이동하도록 라우팅 처리한다. (필요시 useNavigate 등 활용)
- 6. 기존 Login.module.css에 네이버 버튼 스타일을 추가한다. (Glassmorphism, 프리미엄 UI, BEM 네이밍 준수)
- 7. config.ts에 네이버 OAuth 관련 리다이렉트 URI, 클라이언트 ID 등 필요한 상수 정의(환경변수 활용)
- 8. XSS, CSRF 등 보안 가이드라인에 따라 입력값 및 토큰 저장 위치를 검토한다.
- 9. 기존 Google 로그인과 동일한 UX 흐름을 유지한다.
Dependencies:
- Spring Boot 백엔드의 네이버 OAuth2 인증 엔드포인트 및 JWT 발급/콜백 처리 구현 (backend-core)
- VITE_API_BASE_URL 환경변수 설정
Verification:
- .skills/verify-web.ps1
Risks:
- 네이버 OAuth 콜백 URL이 프론트엔드 라우팅에 등록되어 있지 않으면 인증 후 JWT 수신 및 로그인 상태 갱신이 실패할 수 있음.
- 백엔드에서 JWT 발급 및 콜백 처리가 미구현 시 프론트엔드 연동이 불가함.
- 네이버 버튼 디자인이 공식 가이드에 부합하지 않으면 CI 위반 가능성 있음.
- JWT 저장 위치(localStorage 등)와 XSS/CSRF 방어 정책을 반드시 준수해야 함.

### rust
Mode: review
Goal: 네이버 OAuth 2.0 로그인 기능 추가에 대해 Rust(backend-fast) 모듈의 JWT 검증 및 인증 경로 보호가 올바르게 연동되는지 검토하고, 정책 및 보안 요구사항 준수 여부를 확인합니다.
Touched areas: backend-fast/src/handlers.rs, backend-fast/src/services.rs, backend-fast/src/main.rs
Implementation steps:
- 1. Java(Spring Boot)에서 네이버 OAuth 인증 및 JWT 발급 로직이 점검될 예정이므로, Rust에서는 JWT 구조(클레임, 서명 방식, 시크릿 키 등)가 기존과 동일하게 유지되는지 확인해야 합니다.
- 2. Rust의 JWT 검증 로직(예: 업로드, WebSocket 핸들러 등)이 네이버 로그인으로 발급된 JWT도 정상적으로 처리하는지 점검합니다.
- 3. ALLOWED_WEB_ORIGINS, PUBLIC_BASE_URL 등 환경변수 및 CORS 정책이 네이버 로그인 플로우(리디렉션 등)에 영향이 없는지 확인합니다.
- 4. 인증 관련 핸들러(handlers.rs)에서 JWT 미인증 접근 차단이 일관되게 적용되는지, 신규 로그인 방식 점검로 인한 보안 허점이 없는지 리뷰합니다.
- 5. JWT_SECRET_KEY가 Spring과 Rust에서 반드시 동일하게 유지되는지, run.bat/.env/.properties 등 환경변수 전달 경로를 재확인합니다.
- 6. (필요시) JWT 파싱/검증 코드에 네이버 OAuth로 인한 클레임 구조 변화가 있으면 rustdoc 주석 및 테스트 케이스를 보강합니다.
Dependencies:
- Java(Spring Boot)에서 발급하는 JWT 구조 및 시크릿 키 정책
- .env 및 run.bat의 JWT_SECRET_KEY 일치 여부
- 프론트엔드에서 전달하는 JWT 토큰 포맷
Verification:
- .skills/verify-fast.ps1
- .skills/verify-all.ps1
Risks:
- Java(Spring Boot)에서 발급하는 JWT 구조(클레임, 서명 방식 등)가 Rust의 기존 검증 로직과 다를 경우 인증 실패 또는 보안 취약점이 발생할 수 있음.
- JWT_SECRET_KEY가 환경변수로 일관되게 전달되지 않으면 인증 우회 또는 서비스 장애가 발생할 수 있음.
- 네이버 OAuth로 인한 JWT 클레임 구조 변화가 Rust 핸들러에서 누락될 경우, 업로드/웹소켓 경로에서 인증 오류가 발생할 수 있음.
- 정책상 Rust는 직접 구현이 아닌 리뷰만 수행하므로, Java(Spring Boot) 구현 내용이 확정된 후 실제 JWT 샘플을 받아 테스트해야 함.

### java
Mode: implement
Goal: Spring Boot 기반 백엔드에 네이버 OAuth 2.0 로그인 기능을 추가하여, 네이버 계정으로 로그인 시 JWT를 발급하고 신규/기존 사용자 계정과 연동되도록 구현합니다.
Touched areas: backend-core/src/main/java/com/whiteboard/core/auth/AuthController.java, backend-core/src/main/java/com/whiteboard/core/auth/SecurityConfig.java, backend-core/src/main/resources/application.properties
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
Verification:
- .skills/verify-core.ps1
Risks:
- 네이버 OAuth2 인증 성공 후 사용자 정보 파싱 시 네이버 API 응답 포맷이 변경될 경우 파싱 오류 가능성 있음.
- 프론트엔드와 JWT 발급/응답 포맷이 불일치할 경우 로그인 연동 실패 가능성 있음.
- 네이버 OAuth2 리다이렉트 URI가 실제 배포 환경과 일치하지 않으면 인증 실패 발생 가능성 있음.
- User 엔티티에 네이버 계정 연동 필드(예: naverId)가 없다면 추가 구현 필요.

### mobile
Mode: review
Goal: 네이버 OAuth 2.0 로그인 기능 추가에 대한 모바일(Android) 모듈의 정책적/기술적 리뷰 및 호환성 검토
Touched areas: mobile/android_context.md
Implementation steps:
- 네이버 로그인 기능은 현재 웹/PC 로그인 플로우에 한정되어 있으며, 모바일(Android) 앱에는 별도 검토 요구가 없습니다.
- 정책상 인증/로그인 공급자 점검 시 모바일 모듈도 최소 리뷰에 참여해야 하므로, 정책 문서와 현재 코드베이스를 기준으로 영향도를 검토합니다.
- mobile/android_context.md의 주요 기능 및 인증 흐름(구글/IDPW, JWT 획득, CameraX, 업로드 등)과 네이버 OAuth 연동 필요성 여부를 확인합니다.
- 현재 모바일 앱은 Google OAuth 및 자체 ID/PW 로그인만 명시되어 있고, 네이버 OAuth 연동 요구는 없습니다.
- 만약 추후 모바일에서도 네이버 로그인이 필요하다면, 네이버 SDK(Android) 연동, OAuth 인증 플로우, JWT 발급 및 Rust/Java 백엔드와의 연동이 필요합니다.
Dependencies:
- 네이버 OAuth 2.0 인증 및 JWT 발급 로직은 backend-core(Java)에서 구현되어야 하며, Rust(backend-fast)는 JWT 검증만 담당합니다.
- 모바일(Android) 모듈은 현재 네이버 OAuth 연동 요구가 없으므로, 별도 코드 변경이나 통합 테스트는 필요하지 않습니다.
Verification:
- .skills/verify-mobile.ps1
Risks:
- 향후 모바일(Android)에서 네이버 로그인이 요구될 경우, 네이버 SDK(Android) 연동, OAuth 인증 플로우, JWT 발급 및 Rust/Java 백엔드와의 연동이 추가로 필요합니다.
- 현재 mobile 디렉토리 내에 네이버 OAuth 관련 코드, 설정, UI가 존재하지 않으므로, 요구사항 변경 시 신규 파일/구현이 필요합니다.

## Worker Task Packets
### frontend
Mode: implement
Goal: 웹 프론트엔드에 네이버 OAuth 2.0 로그인 버튼 및 인증 플로우를 추가하여 사용자가 네이버 계정으로 로그인할 수 있도록 한다.
Allowed paths: web/**
Blocked paths: backend-fast/**, backend-core/**, mobile/**
Touched areas: web/src/components/Login.tsx, web/src/components/Login.module.css, web/src/config.ts
Required verification: .skills/verify-web.ps1
Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- VITE_API_BASE_URL, VITE_REALTIME_WS_URL 계약을 유지합니다.
- 백엔드 메시지 포맷과 JWT 전달 방식을 합의 없이 바꾸지 않습니다.
- 로그인 버튼, OAuth redirect, JWT 저장 방식은 백엔드와 합의된 계약만 사용합니다.
Policy checks:
- JWT_SECRET_KEY, claim 구조, 만료 정책 동기화 여부 확인
- OAuth redirect URI와 토큰 전달 방식 합의 여부 확인
- HTTPS/WSS 사용 경로와 민감 정보(.env, client secret) 노출 금지 여부 확인
- JWT 저장 위치와 XSS/CSRF 완화 방안이 security_guidelines.md 기준을 따르는지 확인
Expected handoff: changed_files, summary, contracts_changed, verification_run, risks, questions

### rust
Mode: review
Goal: 네이버 OAuth 2.0 로그인 기능 추가에 대해 Rust(backend-fast) 모듈의 JWT 검증 및 인증 경로 보호가 올바르게 연동되는지 검토하고, 정책 및 보안 요구사항 준수 여부를 확인합니다.
Allowed paths: backend-fast/**
Blocked paths: web/**, backend-core/**, mobile/**
Touched areas: backend-fast/src/handlers.rs, backend-fast/src/services.rs, backend-fast/src/main.rs
Required verification: .skills/verify-fast.ps1, .skills/verify-all.ps1
Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- JWT_SECRET_KEY, ALLOWED_WEB_ORIGINS, PUBLIC_BASE_URL 계약을 유지합니다.
- 업로드 hot path와 websocket fan-out의 성능 특성을 해치지 않습니다.
- JWT_SECRET_KEY, claim 구조, 만료 정책이 Spring 발급 토큰과 일치해야 합니다.
Policy checks:
- JWT_SECRET_KEY, claim 구조, 만료 정책 동기화 여부 확인
- OAuth redirect URI와 토큰 전달 방식 합의 여부 확인
- HTTPS/WSS 사용 경로와 민감 정보(.env, client secret) 노출 금지 여부 확인
- JWT 저장 위치와 XSS/CSRF 완화 방안이 security_guidelines.md 기준을 따르는지 확인
Expected handoff: changed_files, summary, contracts_changed, verification_run, risks, questions

### java
Mode: implement
Goal: Spring Boot 기반 백엔드에 네이버 OAuth 2.0 로그인 기능을 추가하여, 네이버 계정으로 로그인 시 JWT를 발급하고 신규/기존 사용자 계정과 연동되도록 구현합니다.
Allowed paths: backend-core/**
Blocked paths: web/**, backend-fast/**, mobile/**
Touched areas: backend-core/src/main/java/com/whiteboard/core/auth/AuthController.java, backend-core/src/main/java/com/whiteboard/core/auth/SecurityConfig.java, backend-core/src/main/resources/application.properties
Required verification: .skills/verify-core.ps1
Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- JWT 발급 구조와 사용자 식별 계약을 Rust/Web/Mobile과 일치시킵니다.
- application.properties와 .env 기반 환경설정 정책을 유지합니다.
- OAuth provider 연동, 사용자 식별, JWT 발급 구조를 전체 클라이언트와 일치시킵니다.
Policy checks:
- JWT_SECRET_KEY, claim 구조, 만료 정책 동기화 여부 확인
- OAuth redirect URI와 토큰 전달 방식 합의 여부 확인
- HTTPS/WSS 사용 경로와 민감 정보(.env, client secret) 노출 금지 여부 확인
- JWT 저장 위치와 XSS/CSRF 완화 방안이 security_guidelines.md 기준을 따르는지 확인
Expected handoff: changed_files, summary, contracts_changed, verification_run, risks, questions

### mobile
Mode: review
Goal: 네이버 OAuth 2.0 로그인 기능 추가에 대한 모바일(Android) 모듈의 정책적/기술적 리뷰 및 호환성 검토
Allowed paths: mobile/**
Blocked paths: web/**, backend-fast/**, backend-core/**
Touched areas: mobile/android_context.md
Required verification: .skills/verify-mobile.ps1
Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- Spring 로그인 계약과 Rust 업로드 인증 계약을 임의로 바꾸지 않습니다.
- 모바일의 JWT 저장/복원 흐름이 기존 업로드 경로와 호환되어야 합니다.
- 모바일 로그인 진입점이 추가되면 JWT 저장/복원과 업로드 인증 흐름이 기존 계약을 유지해야 합니다.
Policy checks:
- JWT_SECRET_KEY, claim 구조, 만료 정책 동기화 여부 확인
- OAuth redirect URI와 토큰 전달 방식 합의 여부 확인
- HTTPS/WSS 사용 경로와 민감 정보(.env, client secret) 노출 금지 여부 확인
- JWT 저장 위치와 XSS/CSRF 완화 방안이 security_guidelines.md 기준을 따르는지 확인
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
Summary: 네이버 OAuth 2.0 로그인 기능 추가에 대한 전체 계획과 각 모듈별 작업 패킷, 정책 준수 여부, 위험 요소, 실행 가능성 등을 검토한 결과입니다. 현재 각 워커의 실제 코드 변경 결과는 수집되지 않았으나, 계획 및 정책 기준으로 사전 검토를 완료했습니다.
Findings:
- 매니저 결정과 스페셜리스트 플랜 모두 정책 문서(AGENTS.md, security_guidelines.md 등)와 일치하며, 각 모듈의 역할 분담이 명확합니다.
- 프론트엔드, 백엔드(Java), Rust(리뷰), 모바일(리뷰) 모두 정책상 요구되는 참여 수준을 충족합니다.
- 네이버 OAuth2 인증 플로우, JWT 발급, 사용자 연동, JWT 검증 등 핵심 경로가 빠짐없이 포함되어 있습니다.
- 모든 작업 패킷이 실제 경로와 정책에 맞게 작성되어 있으며, 임의의 계약 변경 없이 기존 인증/환경변수 계약을 유지합니다.
Contract checks:
- JWT_SECRET_KEY, claim 구조, 만료 정책이 Spring과 Rust에서 반드시 일치해야 함을 명확히 요구하고 있습니다.
- OAuth redirect URI, JWT 전달 방식, 사용자 식별 방식 등은 기존 계약을 임의로 바꾸지 않고, 변경 시 반드시 master 세션에 보고하도록 되어 있습니다.
- 프론트엔드와 백엔드 간 JWT 저장/전달 방식, 환경변수(VITE_API_BASE_URL 등) 사용 정책이 유지됩니다.
- 보안 가이드라인(security_guidelines.md)에서 요구하는 HTTPS/WSS, 민감 정보 노출 방지, XSS/CSRF 완화 방안이 각 플랜에 반영되어 있습니다.
- JWT_SECRET_KEY, claim 구조, 만료 정책 동기화 여부 확인
- OAuth redirect URI와 토큰 전달 방식 합의 여부 확인
- HTTPS/WSS 사용 경로와 민감 정보(.env, client secret) 노출 금지 여부 확인
- JWT 저장 위치와 XSS/CSRF 완화 방안이 security_guidelines.md 기준을 따르는지 확인
Recommended verification:
- .skills/verify-web.ps1 (프론트엔드)
- .skills/verify-core.ps1 (Spring Boot)
- .skills/verify-fast.ps1, .skills/verify-all.ps1 (Rust 및 통합)
- .skills/verify-mobile.ps1 (모바일 영향도 점검)
Release blockers:
- 실제 워커 실행 결과가 아직 수집되지 않아 코드 레벨의 계약 위반, 미구현, 테스트 실패 여부를 확정할 수 없습니다.
- 네이버 OAuth2 인증 성공 후 JWT 발급/파싱 포맷이 프론트엔드, Rust와 완전히 일치하지 않으면 인증 연동이 실패할 수 있습니다.
- JWT_SECRET_KEY, claim 구조, 만료 정책이 Spring과 Rust에서 불일치할 경우 인증 우회 또는 서비스 장애가 발생할 수 있습니다.
- 네이버 OAuth2 리다이렉트 URI가 실제 배포 환경과 불일치하면 인증이 실패할 수 있습니다.
- User 엔티티에 네이버 계정 연동 필드가 없다면 추가 구현이 필요할 수 있습니다.
