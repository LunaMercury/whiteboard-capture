You are Codex applying worker-proposed edits for the Whiteboard Capture repository.
Role: java
Run ID: run-2026-05-21T08-36-01-639Z

Goal:
Spring Boot 백엔드에 네이버 OAuth2 로그인 연동, JWT 발급 및 기존 인증 체계와 통합 구현

Allowed paths:
- backend-core/**

Blocked paths:
- web/**
- backend-fast/**
- mobile/**

Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- JWT 발급 구조와 사용자 식별 계약을 Rust/Web/Mobile과 일치시킵니다.
- application.properties와 .env 기반 환경설정 정책을 유지합니다.
- OAuth provider 연동, 사용자 식별, JWT 발급 구조를 전체 클라이언트와 일치시킵니다.

Required verification:
- .skills/verify-core.ps1

Apply the following file-by-file edits carefully:

## backend-core/src/main/resources/application.properties
- action: update
- summary: 네이버 OAuth2 환경변수(client-id, client-secret, redirect-uri) 프로퍼티 추가.
- instructions:
  - spring.security.oauth2.client.registration.naver.client-id=${NAVER_CLIENT_ID}
  - spring.security.oauth2.client.registration.naver.client-secret=${NAVER_CLIENT_SECRET}
  - spring.security.oauth2.client.registration.naver.redirect-uri=${NAVER_REDIRECT_URI}
  - spring.security.oauth2.client.registration.naver.authorization-grant-type=authorization_code
  - spring.security.oauth2.client.registration.naver.client-name=Naver
  - spring.security.oauth2.client.registration.naver.scope=email,profile,openid

## backend-core/src/main/java/com/whiteboard/core/auth/SecurityConfig.java
- action: update
- summary: 네이버 OAuth2 클라이언트 등록 및 OAuth2 로그인 엔드포인트 활성화.
- instructions:
  - OAuth2 클라이언트에 'naver' 등록 spring security 설정 추가
  - oauth2Login().loginPage('/auth/naver/login').defaultSuccessUrl('/auth/naver/callback') 등 엔드포인트 명시
  - 기존 jwt 등 인증 필터와 충돌 없도록 conf 설정 확인

## backend-core/src/main/java/com/whiteboard/core/auth/AuthController.java
- action: update
- summary: /auth/naver/login, /auth/naver/callback 엔드포인트 신설 및 네이버 OAuth2 동작 구현. JWT 발급 및 반환 통합.
- instructions:
  - '/auth/naver/login': 네이버 인증 URL로 리다이렉트 처리
  - '/auth/naver/callback': code/state 파라미터 받아 네이버 토큰/프로필 호출
  - UserRepository 통해 naverId(email 등)로 기존 유저 조회 또는 생성
  - JwtUtil 사용해 동일한 JWT 발급
  - provider, providerId 등 필요시 AuthResponse 형태로 포함

## backend-core/src/main/java/com/whiteboard/core/user/User.java
- action: update
- summary: User 엔티티에 naverId(소셜 providerId) 필드 추가 및 매핑.
- instructions:
  - private String naverId 필드 추가
  - @Column(unique=true, nullable=true) 어노테이션 부여
  - getter/setter 생성
  - 생성자 및 builder 등에서 naverId 포함

## backend-core/src/main/java/com/whiteboard/core/user/UserRepository.java
- action: update
- summary: naverId로 User 조회 메서드 추가.
- instructions:
  - Optional<User> findByNaverId(String naverId); 인터페이스 추가

## backend-core/src/main/java/com/whiteboard/core/auth/JwtUtil.java
- action: update
- summary: JWT 생성시 네이버 로그인 사용자도 적용 및 provider 정보 포함 구조 확장.
- instructions:
  - createJwt에 provider/providerId 등 필드 확장 또는 오버로드 (존재하면 AuthResponse 등 DTO도 수정)
  - 네이버 로그인 사용자에 대해 동일한 JWT 발급로직 적용

Execution rules:
- Edit only files inside allowed paths.
- Do not modify blocked paths.
- Preserve existing project conventions and comments.
- Add or restore concise human-readable comments in complex logic where they improve maintainability.
- Run the required verification commands after editing.
- If a proposed edit conflicts with actual code, adapt carefully and record the deviation in your final summary.
