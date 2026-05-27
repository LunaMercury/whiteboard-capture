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
Goal: React 프론트엔드에 네이버 로그인 버튼 및 인증 플로우(리디렉션, 콜백 처리 등) UI를 구현하고, 백엔드에서 발급된 JWT를 받아 저장 및 활용할 수 있도록 한다.
Touched areas: web/src/components/Login.tsx, web/src/components/Login.module.css, web/src/config.ts
Implementation steps:
- 1. 네이버 로그인 버튼 UI를 Login.tsx에 추가한다. (공식 네이버 CI 가이드에 따라 SVG 또는 이미지 사용)
- 2. 네이버 로그인 버튼 클릭 시, Spring Boot 백엔드의 네이버 OAuth2 인증 엔드포인트(예: /oauth2/authorization/naver)로 리디렉션한다. (config.ts에 해당 URL을 명시)
- 3. 네이버 인증 후 백엔드에서 프론트엔드로 리디렉션될 때, 쿼리스트링 또는 해시로 JWT 토큰이 전달되도록 한다. (예: /login/callback?token=...)
- 4. Login.tsx에서 콜백 경로(/login/callback) 진입 시, URL에서 JWT 토큰을 추출하여 localStorage/sessionStorage에 저장하고, 전역 인증 상태를 갱신한다.
- 5. 인증 성공 시 대시보드로 자동 이동하도록 처리한다.
- 6. 네이버 로그인 버튼 및 콜백 처리 UI에 대해 접근성, 반응형, 스타일을 Login.module.css에 추가한다.
- 7. 기존 Google 로그인과 동일한 인증 상태 관리 로직을 재사용한다. (중복 코드 최소화)
- 8. config.ts에 네이버 OAuth 관련 백엔드 엔드포인트 및 클라이언트 ID 등 환경변수 연동을 추가한다.
Dependencies:
- Spring Boot 백엔드의 네이버 OAuth2 엔드포인트 및 JWT 발급/리디렉션 구현 (AuthController, SecurityConfig 등)
- VITE_API_BASE_URL 환경변수 및 네이버 OAuth2 관련 백엔드 설정
Verification:
- .skills/verify-web.ps1
Risks:
- 네이버 인증 후 JWT 토큰이 프론트엔드로 안전하게 전달되는지(쿼리스트링/해시/쿠키 등) 백엔드와 협의 필요
- 네이버 OAuth2 인증 실패/취소 시 UI에서 적절한 에러 메시지 및 예외 처리 필요
- 네이버 로그인 버튼 디자인이 공식 가이드에 부합하는지 확인 필요
- JWT 저장 방식(localStorage 등)에서 XSS 등 보안 이슈에 유의 필요

### rust
Mode: review
Goal: rust 모듈 관점에서 변경 계약과 호환성, 검증 포인트를 검토합니다.
Touched areas: backend-fast/src/handlers.rs, backend-fast/src/services.rs, backend-fast/src/main.rs
Implementation steps:
- 1. Java(Spring Boot)에서 네이버 OAuth2 인증 성공 시 발급하는 JWT의 payload 구조와 claim(예: sub, provider, email 등)이 기존 JWT와 동일한지 확인합니다.
- 2. backend-fast/src/services.rs 또는 JWT 검증 관련 코드에서 JWT 파싱 시 provider(google, naver 등) 구분이 필요한지, 혹은 claim 구조가 달라질 경우 예외가 발생하지 않는지 검토합니다.
- 3. JWT_SECRET_KEY가 동일하게 공유되고 있는지, 네이버 로그인으로 발급된 JWT도 정상적으로 verify되는지 로컬 환경(run.bat)에서 end-to-end 테스트를 진행합니다.
- 4. JWT 내 provider 구분이 필요한 경우, Rust 쪽에서 provider 필드가 누락되었을 때의 fallback 처리나, 신규 provider 점검에 따른 확장성(예: enum Provider { Google, Naver })을 고려한 코드 구조를 리뷰합니다.
- 5. 인증 실패/claim 불일치/만료 등 예외 상황에서 적절한 에러 메시지와 HTTP 상태코드가 반환되는지 확인합니다.
Dependencies:
- Java(Spring Boot)에서 네이버 OAuth2 인증 및 JWT 발급 구현이 선행되어야 함 (backend-core)
- JWT_SECRET_KEY가 .env 및 환경변수로 일치하게 전달되어야 함
Verification:
- .skills/verify-fast.ps1
- .skills/verify-core.ps1
- .skills/verify-all.ps1
Risks:
- 네이버 로그인으로 발급된 JWT의 claim 구조가 기존 Google 기반 JWT와 다를 경우, Rust의 JWT 파싱/검증 로직에서 에러가 발생할 수 있음. 이 경우 claim 매핑 로직 보완이 필요함.
- JWT_SECRET_KEY가 불일치하거나, 네이버 로그인 JWT에 별도의 서명이 적용될 경우 인증 실패가 발생할 수 있음.
- 네이버 OAuth2 provider 추가에 따른 Rust 코드의 확장성(추후 카카오 등 추가 시)도 고려해야 함.

### java
Mode: implement
Goal: Spring Boot 기반 백엔드에 네이버 OAuth2 로그인을 추가하고, 인증 성공 시 JWT를 발급하여 기존 인증 플로우와 통합한다.
Touched areas: backend-core/src/main/resources/application.properties, backend-core/src/main/java/com/whiteboard/core/auth/SecurityConfig.java, backend-core/src/main/java/com/whiteboard/core/auth/AuthController.java, backend-core/src/main/java/com/whiteboard/core/auth/CustomUserDetailsService.java, backend-core/src/main/java/com/whiteboard/core/auth/JwtUtil.java, backend-core/src/main/java/com/whiteboard/core/user/User.java, backend-core/src/main/java/com/whiteboard/core/user/UserRepository.java
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
Verification:
- .skills/verify-core.ps1
Risks:
- 네이버 OAuth2 인증 콜백 경로가 프론트엔드와 정확히 일치하지 않으면 인증이 실패할 수 있음. 프론트엔드와 리디렉션 URI를 반드시 맞춰야 함.
- User 엔티티에 provider/providerId 필드가 없다면 마이그레이션 필요. (엔티티 수정 및 DB 반영)
- JWT 발급 로직이 기존 Google/IDPW와 완전히 동일해야 Rust(backend-fast)에서 정상적으로 검증 가능함. JWT claim 구조 및 secret key 일치 여부 반드시 확인.
- 네이버 OAuth2 인증 응답에서 이메일 등 필수 정보가 누락될 수 있으므로, 사용자 정보 매핑 시 예외 처리 필요.
- 테스트 환경에서 네이버 OAuth2 클라이언트 등록이 되어 있지 않으면 로컬 인증 테스트가 불가할 수 있음.

### mobile
Mode: review
Goal: 네이버 로그인(OAuth2) 기능 추가에 대해 모바일(Android) 모듈의 영향 및 호환성, 정책 준수 여부를 검토합니다.
Touched areas: mobile/android_context.md
Implementation steps:
- 네이버 로그인 연동이 모바일(Android) 앱에 요구되는지 명확히 확인합니다. 현재 요구사항 및 정책상 이번 작업에서는 모바일 검토이 제외되어 있습니다.
- 향후 모바일에서 네이버 로그인을 지원할 경우, Android OAuth2 연동(네이버 SDK 또는 Custom OAuth Flow), JWT 수신 및 저장, Rust/Java 백엔드와의 인증 플로우 호환성 검토가 필요합니다.
- 정책상 로그인 제공자 점검 작업에는 모바일도 최소 리뷰 이상 참여해야 하므로, 백엔드(JAVA/RUST)에서 발급하는 JWT가 모바일에서도 동일하게 검증 및 활용 가능한지 확인합니다.
Dependencies:
- backend-core (Spring Boot)에서 네이버 OAuth2 인증 및 JWT 발급 구현
- backend-fast (Rust)에서 JWT 파싱 및 검증 로직이 네이버 계정도 지원하는지 확인
Verification:
- .skills/verify-mobile.ps1
Risks:
- 현재 mobile/app/src/main/java/ 이하에 네이버 로그인 관련 코드가 존재하지 않음. 추후 모바일 네이버 로그인 연동 요청이 있을 경우 신규 구현 필요.
- 네이버 로그인 연동이 모바일 요구사항에 포함될 경우, 네이버 OAuth2 Android SDK 도입 및 인증 콜백 처리, JWT 저장/활용 로직 추가가 필요함.
- 백엔드에서 발급하는 JWT 포맷이 모바일(Android)에서도 완벽히 호환되는지 반드시 검증 필요.

## Worker Task Packets
### frontend
Mode: implement
Goal: React 프론트엔드에 네이버 로그인 버튼 및 인증 플로우(리디렉션, 콜백 처리 등) UI를 구현하고, 백엔드에서 발급된 JWT를 받아 저장 및 활용할 수 있도록 한다.
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
Goal: 네이버 OAuth2 로그인을 통한 JWT 발급 및 인증 플로우가 Rust 백엔드(backend-fast)에서 정상적으로 검증되고, 기존 JWT 파싱/검증 로직이 네이버 계정 기반 JWT에도 호환되는지 확인합니다.
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
Policy checks:
- JWT_SECRET_KEY, claim 구조, 만료 정책 동기화 여부 확인
- OAuth redirect URI와 토큰 전달 방식 합의 여부 확인
- HTTPS/WSS 사용 경로와 민감 정보(.env, client secret) 노출 금지 여부 확인
- JWT 저장 위치와 XSS/CSRF 완화 방안이 security_guidelines.md 기준을 따르는지 확인
Expected handoff: changed_files, summary, contracts_changed, verification_run, risks, questions

### java
Mode: implement
Goal: Spring Boot 기반 백엔드에 네이버 OAuth2 로그인을 추가하고, 인증 성공 시 JWT를 발급하여 기존 인증 플로우와 통합한다.
Allowed paths: backend-core/**
Blocked paths: web/**, backend-fast/**, mobile/**
Touched areas: backend-core/src/main/resources/application.properties, backend-core/src/main/java/com/whiteboard/core/auth/SecurityConfig.java, backend-core/src/main/java/com/whiteboard/core/auth/AuthController.java, backend-core/src/main/java/com/whiteboard/core/auth/CustomUserDetailsService.java, backend-core/src/main/java/com/whiteboard/core/auth/JwtUtil.java, backend-core/src/main/java/com/whiteboard/core/user/User.java, backend-core/src/main/java/com/whiteboard/core/user/UserRepository.java
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
Goal: 네이버 로그인(OAuth2) 기능 추가에 대해 모바일(Android) 모듈의 영향 및 호환성, 정책 준수 여부를 검토합니다.
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
Summary: 네이버 로그인(OAuth2) 기능 추가에 대한 전체 계획과 작업 패킷이 준비되어 있습니다. 각 모듈별 역할 분담, 정책 준수, 보안 요구사항, 계약 일치 여부가 명확히 정의되어 있으나, 실제 구현은 아직 시작되지 않았으며 worker 실행 결과도 수집되지 않았습니다. 아래는 검토 결과 요약입니다.
Findings:
- 매니저 결정과 스페셜리스트 계획 모두 정책(AGENTS.md, security_guidelines.md, module context)에 부합합니다.
- 네이버 OAuth2는 인증, JWT 발급, 검증 경로에 영향을 주므로 Java(Spring Boot)와 Rust(backend-fast)가 반드시 참여해야 하며, 프론트엔드는 UI/플로우 구현, 모바일은 정책상 리뷰만 참여합니다.
- 각 모듈별 작업 패킷은 실제 경로, 정책, 계약, 검증 스크립트, 위험요소를 명확히 명시하고 있습니다.
Contract checks:
- JWT_SECRET_KEY, claim 구조, 만료 정책이 Spring과 Rust에서 반드시 동기화되어야 함.
- OAuth redirect URI, JWT 전달 방식(쿼리스트링/해시/쿠키 등)은 프론트엔드와 백엔드가 합의한 계약만 사용해야 함.
- 환경변수(VITE_API_BASE_URL 등)와 인증 계약을 임의로 변경하면 안 됨.
- User 엔티티에 provider/providerId 필드 추가 시 DB 마이그레이션 필요 여부 확인.
- JWT 저장 위치(localStorage 등)는 security_guidelines.md의 XSS/CSRF 방지 기준을 따라야 함.
- JWT_SECRET_KEY, claim 구조, 만료 정책 동기화 여부 확인
- OAuth redirect URI와 토큰 전달 방식 합의 여부 확인
- HTTPS/WSS 사용 경로와 민감 정보(.env, client secret) 노출 금지 여부 확인
- JWT 저장 위치와 XSS/CSRF 완화 방안이 security_guidelines.md 기준을 따르는지 확인
Recommended verification:
- .skills/verify-web.ps1 (프론트엔드)
- .skills/verify-core.ps1 (Spring Boot)
- .skills/verify-fast.ps1 (Rust)
- .skills/verify-all.ps1 (통합)
- .skills/verify-mobile.ps1 (모바일 영향도 리뷰)
Release blockers:
- 네이버 OAuth2 인증 콜백 URI가 프론트엔드와 백엔드에서 정확히 일치하지 않으면 인증이 실패할 수 있음. 반드시 URI를 맞춰야 함.
- JWT claim 구조가 기존 Google/IDPW와 다를 경우 Rust(backend-fast)에서 인증이 실패할 수 있음. claim 구조 일치 여부를 반드시 검증해야 함.
- User 엔티티에 provider/providerId 필드가 없다면 DB 마이그레이션이 필요하며, 이 과정에서 데이터 손실/불일치 위험이 있음.
- 네이버 OAuth2 클라이언트 등록이 테스트 환경에 미비할 경우 로컬 인증 테스트가 불가함.
- JWT 저장 방식(localStorage 등)에서 XSS/CSRF 등 보안 이슈가 발생할 수 있으므로 security_guidelines.md 기준을 반드시 준수해야 함.
