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
Goal: 웹 프론트엔드(React)에서 네이버 로그인(OAuth 2.0) 기능을 추가하여 사용자가 네이버 계정으로 로그인할 수 있도록 한다. 로그인 버튼, 인증 플로우, 콜백 처리, JWT 저장 및 로그인 상태 관리 UI를 구현한다.
Touched areas: web/src/components/Login.tsx, web/src/components/Login.module.css, web/src/config.ts
Implementation steps:
- 1. 네이버 로그인 버튼 UI를 'Login.tsx'에 추가한다. (공식 네이버 CI 및 스타일 가이드 준수, BEM 네이밍 및 CSS 모듈 적용)
- 2. 네이버 OAuth2 인증 요청 URL을 'config.ts'에 상수로 정의한다. (백엔드 Spring Boot의 '/oauth2/authorization/naver' 엔드포인트로 리디렉션)
- 3. 사용자가 네이버 로그인 버튼을 클릭하면, 해당 URL로 리디렉션하여 인증을 시작한다.
- 4. 인증 후 백엔드에서 콜백을 받아 JWT를 발급하고, 프론트엔드로 리디렉션 시 쿼리스트링 또는 해시(fragment)로 JWT를 전달받는다. (예: /login?token=...)
- 5. 'Login.tsx'에서 URL 파라미터로 전달된 JWT를 감지하여 안전하게 localStorage/sessionStorage에 저장하고, 로그인 상태로 전환한다.
- 6. 로그인 성공 시 대시보드로 자동 이동 및 사용자 정보 표시(옵션).
- 7. 로그인 실패/취소/에러 시 사용자에게 안내 메시지 표시.
- 8. 기존 Google/IDPW 로그인 UI와 통합하여 소셜 로그인 선택지를 명확히 구분한다.
- 9. 보안: XSS, CSRF, URL 파라미터 검증 및 JWT 저장 시 security_guidelines.md 정책 준수.
- 10. UI/UX: Glassmorphism 등 프리미엄 디자인, 애니메이션 효과 적용 (css_rules.md 참고).
Dependencies:
- backend-core의 네이버 OAuth2 엔드포인트 및 JWT 발급/리디렉션 구현
- VITE_API_BASE_URL 등 환경변수 설정
- security_guidelines.md, css_rules.md, frontend_context.md 정책 준수
Verification:
- .skills/verify-web.ps1
Risks:
- 네이버 인증 콜백에서 JWT를 안전하게 전달받지 못하면 로그인 상태가 불안정해질 수 있음 (백엔드와 전달 방식 협의 필요)
- 네이버 OAuth2 클라이언트 ID/Secret, 리디렉션 URI가 올바르게 설정되어야 정상 동작함
- JWT 저장 방식(localStorage 등)에서 XSS 취약점이 발생하지 않도록 주의 필요
- 네이버 로그인 UI/버튼 디자인이 공식 가이드와 다를 경우 CI 위반 가능성 있음
- 로그인 상태 관리 로직이 기존 Google/IDPW와 충돌하지 않도록 주의

### rust
Mode: review
Goal: rust 모듈 관점에서 변경 계약과 호환성, 검증 포인트를 검토합니다.
Touched areas: backend-fast/src/handlers.rs, backend-fast/src/services.rs, backend-fast/src/main.rs
Implementation steps:
- 1. Java(Spring Boot, backend-core)에서 네이버 OAuth 2.0 인증, 콜백, JWT 발급, 사용자 계정 연동 로직을 검토하는지 확인합니다.
- 2. Rust(backend-fast)는 직접 네이버 OAuth 인증을 검토하지 않으나, 업로드/웹소켓 등 모든 인증 경로에서 Java가 발급한 JWT를 검증해야 하므로, JWT 파싱 및 검증 로직이 네이버 로그인으로 발급된 토큰에도 정상 동작하는지 확인합니다.
- 3. JWT 내 클레임(예: sub, provider 등)에 네이버 로그인 사용자를 구분할 수 있는 정보가 포함되는지 확인하고, Rust의 JWT 검증 로직이 이를 문제없이 처리하는지 검토합니다.
- 4. ALLOWED_WEB_ORIGINS, PUBLIC_BASE_URL 등 환경변수 및 CORS 정책이 네이버 로그인 플로우(리디렉션 등)에 영향이 없는지 점검합니다.
- 5. (필요시) backend-fast/src/handlers.rs, services.rs, main.rs 내 JWT 검증 미들웨어/핸들러에서 네이버 로그인 유저의 JWT도 정상적으로 인증되는지 테스트 케이스를 점검하거나 검토합니다.
Dependencies:
- Java(backend-core)에서 JWT 발급 및 네이버 OAuth 연동이 정상적으로 구현되어야 함
- JWT_SECRET_KEY 환경변수 일치 필요
Verification:
- .skills/verify-fast.ps1
- .skills/verify-core.ps1
- .skills/verify-all.ps1
Risks:
- Java(Spring Boot)에서 발급하는 JWT의 클레임 구조가 변경될 경우, Rust의 JWT 파싱/검증 로직이 깨질 수 있음. (예: provider, sub 등 필드 추가/변경)
- 네이버 로그인 사용자의 JWT가 기존 로컬/구글 로그인과 구분되는 방식(클레임 등)이 일관되지 않으면 Rust 핫패스 인증 경로에서 인증 실패 가능성 있음.
- JWT_SECRET_KEY가 불일치하면 인증이 모두 실패하므로, 환경변수 관리에 주의 필요.

### java
Mode: implement
Goal: Spring Boot 기반 백엔드에 네이버 OAuth 2.0 로그인(소셜 로그인) 기능을 추가하여, 네이버 계정으로 로그인 시 JWT를 발급하고 기존 사용자 계정과 연동/생성 처리까지 구현합니다.
Touched areas: backend-core/src/main/java/com/whiteboard/core/auth, backend-core/src/main/java/com/whiteboard/core/user, backend-core/src/main/java/com/whiteboard/core/auth/dto
Implementation steps:
- 1. build.gradle에 네이버 OAuth2 클라이언트 지원을 위한 spring-security-oauth2-client 의존성 추가(최신 버전).
- 2. application.properties에 이미 존재하는 네이버 OAuth2 설정(NAVER_CLIENT_ID 등)이 실제로 동작하도록 SecurityConfig 및 OAuth2 관련 설정 보강.
- 3. com.whiteboard.core.auth 패키지에 Naver OAuth2 인증 처리용 커스텀 OAuth2UserService 구현(NaverOAuth2UserService 등). 네이버에서 받은 profile 정보를 파싱하여 User 엔티티와 연동(신규 생성 또는 기존 계정 매핑).
- 4. OAuth2 로그인 성공 시 JWT를 발급하는 OAuth2SuccessHandler 구현 및 SecurityConfig에 등록. (JWT 발급 로직은 기존 JwtUtil 활용)
- 5. AuthController에 /auth/naver/login, /auth/naver/callback 등 엔드포인트 추가(프론트엔드와 연동되는 REST 방식 또는 OAuth2 리다이렉트 방식 모두 지원).
- 6. User 엔티티에 네이버 고유 ID, 이메일, 이름 등 필드 추가(필요시 마이그레이션).
- 7. AuthResponse 등 DTO에 네이버 로그인 결과(JWT, 사용자 정보 등) 반환 구조 반영.
- 8. (선택) 기존 CustomUserDetailsService가 소셜 로그인 계정도 지원하도록 확장.
- 9. 통합 테스트: 네이버 OAuth2 플로우 전체를 Postman 등으로 검증, JWT 발급 및 사용자 정보 연동 확인.
- 10. 정책 준수: JWT_SECRET_KEY, OAuth2 client 정보 등은 .env/application.properties에서 관리, 민감 정보 노출 금지.
- 11. 문서화: 주요 인증 플로우, 엔드포인트, 예외 처리 등 Javadoc 및 README/코드 주석 보강.
- 12. 검증 스크립트(.skills/verify-core.ps1)로 전체 인증 플로우 자동 테스트.
- 13. Rust(backend-fast)와 JWT 호환성(서명, 클레임 등) 재확인 및 필요시 리뷰 요청.
Dependencies:
- spring-security-oauth2-client (최신)
- 기존 spring-boot-starter-security, spring-boot-starter-webmvc, jjwt-api 등
- 네이버 OAuth2 client id/secret (.env, application.properties)
- JwtUtil, UserRepository, User 엔티티 등 내부 클래스
Verification:
- .skills/verify-core.ps1
Risks:
- 네이버 OAuth2UserService 구현 시 네이버의 프로필 응답(JSON 구조)이 표준 OAuth2와 다르므로 커스텀 파싱 필요.
- User 엔티티에 네이버 고유 ID 등 필드 추가 시 기존 DB 마이그레이션 필요(DDL 변경).
- JWT 발급 시 Rust(backend-fast)와의 호환성(alg, claim 등) 반드시 검증 필요.
- 프론트엔드/모바일과의 콜백 URI, JWT 전달 방식(헤더/쿠키 등) 합의 필요.
- 네이버 OAuth2 client id/secret 등 민감 정보가 깃에 노출되지 않도록 주의.
- 테스트 환경에서는 네이버 OAuth2 redirect URI가 localhost로 등록되어야 함.

### mobile
Mode: review
Goal: 모바일(Android) 앱에서 네이버 로그인(OAuth 2.0) 연동이 필요한 경우, 전체 인증 플로우가 정책 및 아키텍처에 맞게 구현되는지 검토하고, JWT 발급 및 저장, Rust 업로드 경로와의 연동이 올바른지 리뷰합니다.
Touched areas: mobile/app/src/main/java/com/example/whiteboardcapture/MainActivity.kt
Implementation steps:
- 네이버 로그인 연동이 실제로 필요한지 요구사항을 우선 확인합니다.
- 필요하다면, 네이버 SDK 또는 OAuth 2.0 인증 플로우를 Android에 맞게 연동하는 코드가 점검되어야 합니다.
- 로그인 성공 시 backend-core(Spring Boot)에서 JWT를 발급받고, 앱 내에 안전하게 저장해야 합니다.
- JWT를 Rust 업로드 엔드포인트에 Authorization 헤더로 전달하는지 확인합니다.
- 네이버 로그인 실패/취소/에러 처리 및 UI 피드백이 명확히 검토되어야 합니다.
- 보안 정책(HTTPS, 토큰 저장, 네트워크 예외 처리 등)이 준수되는지 검토합니다.
Dependencies:
- backend-core에서 네이버 OAuth2 인증 엔드포인트 및 JWT 발급 API가 구현되어 있어야 함
- Rust(backend-fast)에서 JWT 검증 및 업로드 경로 보호가 정상 동작해야 함
Verification:
- .skills/verify-mobile.ps1
- .skills/verify-core.ps1
- .skills/verify-fast.ps1
Risks:
- 현재 mobile 디렉토리 내에 네이버 로그인 관련 코드가 존재하지 않으므로, 신규 파일/클래스 추가가 필요합니다.
- 네이버 SDK 연동 시 AndroidManifest.xml 및 build.gradle 수정이 필요할 수 있으나, 해당 파일이 아직 준비되지 않았을 수 있습니다.
- 네이버 로그인 연동이 실제 요구사항이 아니라면, 불필요한 구현이 될 수 있습니다.
- JWT 저장 및 Rust 업로드 연동이 누락되면 인증이 정상적으로 동작하지 않을 수 있습니다.

## Worker Task Packets
### frontend
Mode: implement
Goal: 웹 프론트엔드(React)에서 네이버 로그인(OAuth 2.0) 기능을 추가하여 사용자가 네이버 계정으로 로그인할 수 있도록 한다. 로그인 버튼, 인증 플로우, 콜백 처리, JWT 저장 및 로그인 상태 관리 UI를 구현한다.
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
Expected handoff: changed_files, summary, contracts_changed, verification_run, risks, questions

### rust
Mode: review
Goal: 네이버 OAuth 2.0 로그인 기능 추가에 대한 Rust(backend-fast) 모듈의 리뷰 및 보안/계약 검증
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
Goal: Spring Boot 기반 백엔드에 네이버 OAuth 2.0 로그인(소셜 로그인) 기능을 추가하여, 네이버 계정으로 로그인 시 JWT를 발급하고 기존 사용자 계정과 연동/생성 처리까지 구현합니다.
Allowed paths: backend-core/**
Blocked paths: web/**, backend-fast/**, mobile/**
Touched areas: backend-core/src/main/java/com/whiteboard/core/auth, backend-core/src/main/java/com/whiteboard/core/user, backend-core/src/main/java/com/whiteboard/core/auth/dto
Required verification: .skills/verify-core.ps1
Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- JWT 발급 구조와 사용자 식별 계약을 Rust/Web/Mobile과 일치시킵니다.
- application.properties와 .env 기반 환경설정 정책을 유지합니다.
- OAuth provider 연동, 사용자 식별, JWT 발급 구조를 전체 클라이언트와 일치시킵니다.
Expected handoff: changed_files, summary, contracts_changed, verification_run, risks, questions

### mobile
Mode: review
Goal: 모바일(Android) 앱에서 네이버 로그인(OAuth 2.0) 연동이 필요한 경우, 전체 인증 플로우가 정책 및 아키텍처에 맞게 구현되는지 검토하고, JWT 발급 및 저장, Rust 업로드 경로와의 연동이 올바른지 리뷰합니다.
Allowed paths: mobile/**
Blocked paths: web/**, backend-fast/**, backend-core/**
Touched areas: mobile/app/src/main/java/com/example/whiteboardcapture/MainActivity.kt
Required verification: .skills/verify-mobile.ps1, .skills/verify-core.ps1, .skills/verify-fast.ps1
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
Summary: 네이버 로그인(OAuth 2.0) 기능 추가에 대한 전체 설계와 작업 분할, 정책 준수 여부, 위험 요소를 검토한 결과, 각 모듈별 계획과 작업 패킷이 정책에 부합하며, 실제 구현 전 단계에서 주요 보안 및 계약상 유의사항이 명확히 정의되어 있습니다. 단, 실제 구현 결과(worker 실행 결과)는 아직 수집되지 않았으므로, 실행 후 검증이 필요합니다.
Findings:
- 네이버 로그인은 인증/소셜 로그인 관련이므로 Java(Spring Boot, backend-core)가 반드시 구현에 참여해야 하며, Rust(backend-fast)는 JWT 검증 및 업로드/웹소켓 경로 보호를 위해 리뷰에 참여해야 함(정책상 필수).
- 프론트엔드는 네이버 로그인 UI, 인증 플로우, JWT 저장 및 로그인 상태 관리 UI를 구현해야 하며, 모바일(Android)은 네이버 로그인 연동이 필요할 경우 리뷰 이상 참여해야 함.
- 각 모듈별 작업 계획이 정책 문서(security_guidelines.md, system_architecture.md 등)와 일치하며, 계약 위반이나 모듈 누락 없이 역할이 분배됨.
- JWT 발급 구조, 환경변수, 인증 계약 등은 기존 정책을 임의로 변경하지 않고, 변경이 필요한 경우 master 세션에 명시적으로 보고하도록 되어 있음.
- 보안 정책(HTTPS, JWT 저장, XSS/CSRF 방지, 민감 정보 관리 등)과 UI/UX 정책(css_rules.md, frontend_context.md 등)도 작업 계획에 반영됨.
Contract checks:
- security_guidelines.md의 인증/인가, 데이터 보호, 애플리케이션 보안 정책을 준수함.
- system_architecture.md의 모듈 분리 및 JWT 공유 정책을 준수함.
- frontend_context.md, css_rules.md의 UI/UX, 스타일링, 인증 플로우 정책을 준수함.
- backend_core_context.md, backend_fast_context.md의 인증, JWT, OAuth2 연동 정책을 준수함.
- 모든 작업 패킷에서 환경변수, JWT 구조, 인증 계약을 임의로 변경하지 않으며, 변경 시 반드시 보고하도록 명시됨.
Recommended verification:
- .skills/verify-web.ps1 (프론트엔드)
-  .skills/verify-core.ps1 (Spring Boot)
-  .skills/verify-fast.ps1 (Rust)
-  .skills/verify-all.ps1 (통합)
-  .skills/verify-mobile.ps1 (모바일, 필요시)
Release blockers:
- 실제 worker 실행 결과가 아직 수집되지 않아, 구현이 완료되었는지, 계약 위반이나 보안 결함이 없는지 최종 검증이 불가함.
- 네이버 OAuth2 연동 시, JWT 전달 방식(쿼리스트링/헤더/쿠키 등)과 콜백 URI가 프론트엔드, 모바일, 백엔드 간 합의된 계약과 일치해야 하며, 이 부분이 실제 구현에서 어긋나면 인증이 실패할 수 있음.
- User 엔티티 및 DB 마이그레이션(네이버 고유 ID 등 필드 추가)이 누락되면 기존 사용자와의 연동이 깨질 수 있음.
- JWT 클레임 구조가 Rust와 호환되지 않으면 업로드/웹소켓 인증이 실패할 수 있음.
- 네이버 OAuth2 client id/secret 등 민감 정보가 깃에 노출되지 않도록 환경설정 관리에 주의 필요.
