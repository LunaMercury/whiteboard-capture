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
Goal: 웹 프론트엔드(React)에서 네이버 로그인 버튼 및 인증 플로우 UI를 구현하고, Spring Boot 백엔드와 연동하여 JWT 기반 로그인 상태를 관리한다.
Touched areas: web/src/components/Login.tsx, web/src/components/Login.module.css, web/src/config.ts
Implementation steps:
- 1. web/src/components/Login.tsx에 네이버 로그인 버튼 UI를 추가한다. (공식 네이버 CI 가이드 준수, BEM 네이밍 및 Glassmorphism 스타일 적용)
- 2. 네이버 로그인 버튼 클릭 시, Spring Boot 백엔드의 네이버 OAuth2 인증 엔드포인트(예: /oauth2/authorization/naver)로 리다이렉트한다. (config.ts에 백엔드 OAuth URL 상수 추가)
- 3. 네이버 인증 후 백엔드에서 콜백(redirect_uri)로 JWT 토큰을 발급받아 프론트엔드로 전달하도록 한다. (백엔드 구현 필요, 프론트는 JWT를 쿼리스트링/로컬스토리지 등에서 수신)
- 4. 프론트엔드는 콜백 URL에서 JWT 토큰을 추출하여 안전하게 저장(localStorage 등)하고, 로그인 상태를 갱신한다.
- 5. 로그인 성공 시 대시보드 등으로 자동 이동, 실패 시 에러 메시지 표시.
- 6. 기존 Login.module.css에 네이버 버튼 스타일 추가(BEM, Glassmorphism, 애니메이션 포함).
- 7. web/src/config.ts에 네이버 OAuth 관련 백엔드 URL 상수 추가 및 기존 인증 플로우와 통합.
- 8. (선택) 네이버 로그인 상태를 명확히 구분할 수 있도록 UI에 '네이버로 로그인됨' 뱃지/아이콘 표시.
- 9. 입력값/토큰 등 모든 사용자 입력에 대해 XSS, CSRF 등 보안 검증을 적용한다.
Dependencies:
- Spring Boot 백엔드의 네이버 OAuth2 엔드포인트(/oauth2/authorization/naver) 및 JWT 발급/콜백 처리 구현 필요
- web/src/config.ts의 API URL 상수와 백엔드 설정(application.properties) 일치 필요
Verification:
- .skills/verify-web.ps1
- .skills/verify-core.ps1
- .skills/verify-fast.ps1
- .skills/verify-all.ps1
Risks:
- 네이버 OAuth 콜백 처리 시 JWT 토큰 전달 방식(쿼리스트링, 쿠키 등)에 따라 보안 취약점이 발생할 수 있으므로 HTTPS 환경에서만 테스트/운영해야 함.
- Spring Boot 백엔드에서 네이버 OAuth2 및 JWT 발급이 정상적으로 구현되어 있어야 하며, 미구현 시 프론트엔드만으로 테스트 불가.
- 네이버 공식 CI 및 Glassmorphism 스타일을 동시에 적용할 때 디자인 가이드 위반 소지가 있으니, 버튼 내 로고/색상은 공식 가이드 우선 준수.
- 콜백 URL이 프론트엔드 라우터에 등록되어 있지 않으면 인증 후 정상 동작하지 않을 수 있음.

### rust
Mode: review
Goal: rust 모듈 관점에서 변경 계약과 호환성, 검증 포인트를 검토합니다.
Touched areas: backend-fast/src/handlers.rs, backend-fast/src/services.rs, backend-fast/src/main.rs
Implementation steps:
- 1. Java(Spring Boot)에서 네이버 OAuth 인증 및 JWT 발급 로직이 점검될 예정이므로, Rust에서는 JWT의 payload와 서명 검증이 네이버 로그인 사용자에 대해서도 동일하게 동작하는지 확인해야 합니다.
- 2. JWT 검증 로직(backend-fast/src/services.rs 또는 handlers.rs 내 관련 함수)이 'sub', 'user_id', 'provider' 등 네이버 로그인 사용자의 claim 구조를 올바르게 파싱하는지 점검합니다.
- 3. JWT_SECRET_KEY가 .env 및 런타임 환경에서 일관되게 전달되는지, 네이버 로그인 사용자도 기존 Google/자체 로그인과 동일하게 인증 경로를 통과하는지 테스트합니다.
- 4. (필요시) JWT payload 내 'provider' 필드 등 신규 claim이 점검될 경우, Rust의 JWT 파싱 구조체(serde 등)가 이를 허용하도록 업데이트합니다.
- 5. WebSocket 및 이미지 업로드 엔드포인트에서 네이버 로그인 사용자의 JWT가 정상적으로 인증/인가되는지 통합 테스트를 수행합니다.
Dependencies:
- Java(Spring Boot)에서 JWT 발급 시 네이버 로그인 사용자를 위한 claim 구조 및 secret key 일치 필요
- .env 및 런타임 환경에서 JWT_SECRET_KEY 일관성 유지
Verification:
- .skills/verify-fast.ps1
- .skills/verify-all.ps1
Risks:
- Java(Spring Boot)에서 JWT claim 구조가 변경될 경우, Rust의 JWT 파싱 구조체와 불일치 위험이 있음. 이 경우 Rust 쪽 구조체 및 검증 로직을 반드시 동기화해야 함.
- 네이버 로그인 사용자의 JWT에 provider 등 신규 필드가 추가될 경우, Rust에서 해당 필드를 무시하거나 허용하도록 구조체를 수정해야 함.
- JWT_SECRET_KEY가 환경변수로 일관되게 전달되지 않으면 인증 실패가 발생할 수 있음. run.bat/.env/.skills 스크립트의 환경변수 전달 경로를 반드시 점검해야 함.

### java
Mode: implement
Goal: Spring Boot(backend-core)에서 네이버 OAuth 2.0 로그인 연동, JWT 발급, 사용자 계정 연동 및 인증 플로우 구현
Touched areas: backend-core/src/main/resources/application.properties, backend-core/src/main/java/com/whiteboard/core/auth/AuthController.java, backend-core/src/main/java/com/whiteboard/core/auth/SecurityConfig.java, backend-core/src/main/java/com/whiteboard/core/auth/CustomUserDetailsService.java, backend-core/src/main/java/com/whiteboard/core/auth/JwtUtil.java, backend-core/src/main/java/com/whiteboard/core/user/User.java, backend-core/src/main/java/com/whiteboard/core/user/UserRepository.java
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
Verification:
- .skills/verify-core.ps1
- .skills/verify-all.ps1
Risks:
- 네이버 OAuth2 인증 플로우에서 redirect-uri, state 파라미터 불일치 등으로 인한 인증 실패 가능성.
- User 엔티티에 naverId 등 신규 필드 추가 시 DB 마이그레이션 필요(ddl-auto=update로 자동 반영 예상).
- JWT 발급 후 Rust(backend-fast)에서 동일한 시크릿으로 검증되는지 반드시 확인 필요.
- 프론트엔드와의 연동(콜백 URL, JWT 전달 방식 등)에서 불일치 발생 가능성.

### mobile
Mode: review
Goal: 네이버 OAuth 2.0 로그인을 통한 인증 기능 추가 요청에 대해 모바일(Android) 모듈의 영향 및 연동 필요성 검토
Touched areas: mobile/android_context.md
Implementation steps:
- 네이버 로그인이 모바일(Android) 앱에서 직접적으로 요구되지 않았으므로, 현재 mobile 모듈의 코드 및 리소스에는 변경이 필요하지 않음.
- 향후 모바일 앱에서 네이버 로그인을 지원할 경우, 네이버 SDK 연동, 인증 콜백 처리, JWT 발급 연동, Rust/Java 백엔드와의 인증 플로우 검토가 필요함.
Dependencies:
- backend-core(Java): 네이버 OAuth 인증 및 JWT 발급 구현
- backend-fast(Rust): JWT 검증 및 업로드/웹소켓 경로 보호 리뷰
- web(frontend): 네이버 로그인 UI 및 인증 플로우 구현
Verification:
- .skills/verify-mobile.ps1
Risks:
- 모바일(Android)에서 네이버 로그인을 추후 지원할 경우, 네이버 SDK 도입 및 인증 플로우 설계가 별도로 필요함. 현재는 요구사항에 포함되지 않아 변경 없음.

## Worker Task Packets
### frontend
Mode: implement
Goal: 웹 프론트엔드(React)에서 네이버 로그인 버튼 및 인증 플로우 UI를 구현하고, Spring Boot 백엔드와 연동하여 JWT 기반 로그인 상태를 관리한다.
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
Policy checks:
- JWT_SECRET_KEY, claim 구조, 만료 정책 동기화 여부 확인
- OAuth redirect URI와 토큰 전달 방식 합의 여부 확인
- HTTPS/WSS 사용 경로와 민감 정보(.env, client secret) 노출 금지 여부 확인
- JWT 저장 위치와 XSS/CSRF 완화 방안이 security_guidelines.md 기준을 따르는지 확인
Expected handoff: changed_files, summary, contracts_changed, verification_run, risks, questions

### rust
Mode: review
Goal: 네이버 OAuth 2.0 로그인 기능 추가에 대한 Rust(backend-fast) 모듈의 보안 및 JWT 검증 경로 리뷰
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
Goal: Spring Boot(backend-core)에서 네이버 OAuth 2.0 로그인 연동, JWT 발급, 사용자 계정 연동 및 인증 플로우 구현
Allowed paths: backend-core/**
Blocked paths: web/**, backend-fast/**, mobile/**
Touched areas: backend-core/src/main/resources/application.properties, backend-core/src/main/java/com/whiteboard/core/auth/AuthController.java, backend-core/src/main/java/com/whiteboard/core/auth/SecurityConfig.java, backend-core/src/main/java/com/whiteboard/core/auth/CustomUserDetailsService.java, backend-core/src/main/java/com/whiteboard/core/auth/JwtUtil.java, backend-core/src/main/java/com/whiteboard/core/user/User.java, backend-core/src/main/java/com/whiteboard/core/user/UserRepository.java
Required verification: .skills/verify-core.ps1, .skills/verify-all.ps1
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
Goal: 네이버 OAuth 2.0 로그인을 통한 인증 기능 추가 요청에 대해 모바일(Android) 모듈의 영향 및 연동 필요성 검토
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
Summary: 네이버 로그인(OAuth 2.0) 기능 추가에 대한 전체 계획과 각 모듈별 실행 패킷을 검토한 결과, 정책 및 보안 기준에 부합하는지, 계약 위반이나 누락, 위험 요소가 있는지 아래와 같이 정리합니다.
Findings:
- 모든 주요 정책(AGENTS.md, security_guidelines.md, system_architecture.md 등)에 따라 네이버 OAuth2는 반드시 Java(Spring Boot)에서 인증 및 JWT 발급, Rust에서 JWT 검증, 프론트엔드에서 UI/플로우 구현이 필요함.
- 모바일(Android)은 이번 요청에서 직접 구현은 제외되었으나, 정책상 리뷰는 포함되어 있음(향후 확장성 고려).
- 각 모듈의 specialist plan과 worker task packet이 정책에 맞게 역할 분담 및 경로를 명확히 하고 있음.
- 프론트엔드, 백엔드 모두 JWT 전달 방식, claim 구조, 환경변수 계약, 보안(HTTPS, XSS/CSRF) 등 핵심 계약을 명시적으로 준수하도록 설계됨.
Contract checks:
- JWT_SECRET_KEY, claim 구조, 만료 정책이 Spring과 Rust에서 반드시 동기화되어야 함.
- OAuth redirect URI, JWT 전달 방식(쿼리스트링/쿠키 등)은 백엔드-프론트엔드 간 합의된 계약만 사용해야 하며, 변경 시 반드시 master 세션에 보고해야 함.
- 환경변수(VITE_API_BASE_URL, VITE_REALTIME_WS_URL, JWT_SECRET_KEY 등)와 인증 계약을 임의로 바꾸지 않음.
- User 엔티티 확장(naverId 등) 시 DB 마이그레이션 정책(ddl-auto=update)과 데이터 일관성 유지 필요.
- 보안 가이드라인(security_guidelines.md) 기준: HTTPS/WSS, 민감 정보 노출 금지, JWT 저장 위치의 XSS/CSRF 완화 방안 적용 필요.
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
- Spring Boot에서 네이버 OAuth2 인증 및 JWT 발급이 미구현되면 프론트엔드/러스트 연동이 불가하므로 반드시 선행 구현 필요.
- JWT claim 구조가 변경될 경우 Rust의 파싱 구조체와 동기화되지 않으면 인증 실패 및 보안 취약점 발생 가능(동기화 필수).
- OAuth 콜백 URL, JWT 전달 방식이 프론트엔드 라우터와 불일치하면 인증 플로우가 정상 동작하지 않을 수 있음(사전 합의 및 테스트 필요).
- User 엔티티에 naverId 등 신규 필드 추가 시 DB 마이그레이션이 누락되면 런타임 오류 발생 가능(ddl-auto=update로 자동 반영 예상, 수동 확인 필요).
- HTTPS 환경이 아닌 경우 JWT, OAuth 인증 정보가 노출될 수 있으므로 반드시 HTTPS/WSS 환경에서만 테스트 및 운영해야 함.
