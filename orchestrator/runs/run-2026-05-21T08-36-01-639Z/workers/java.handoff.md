# Worker Handoff

- Run ID: run-2026-05-21T08-36-01-639Z
- Role: java
- Status: running

## Goal
Spring Boot 백엔드에 네이버 OAuth2 로그인 연동, JWT 발급 및 기존 인증 체계와 통합 구현

## Summary
네이버 OAuth2 연동, User 모델 확장(naverId), 네이버 로그인 엔드포인트(/auth/naver/login, /auth/naver/callback), JWT 통합 발급 및 application.properties 환경변수 추가

## Proposed Edits
### backend-core/src/main/resources/application.properties
- action: update
- summary: 네이버 OAuth2 client registration 정보(NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, NAVER_REDIRECT_URI 등) 추가
- instructions:
  - spring.security.oauth2.client.registration.naver.client-id, client-secret, redirect-uri, authorization-grant-type, scope 등 네이버 OAuth2 설정 추가
  - 네이버 OAuth 콜백 URI와 일치하도록 redirect-uri 명시
  - oauth2.client.provider.naver.authorization-uri/token-uri/user-info-uri 등도 지정

### backend-core/src/main/java/com/whiteboard/core/auth/SecurityConfig.java
- action: update
- summary: 네이버 OAuth2 클라이언트 등록 및 /auth/naver/login 경로에 대한 보안 전략 추가
- instructions:
  - OAuth2 client registration에 'naver' provider 등록
  - antMatchers 또는 .requestMatchers에 /auth/naver/** 패턴 추가하여 익명 접근 허용
  - oauth2Login().loginPage 설정 등 필요시 추가

### backend-core/src/main/java/com/whiteboard/core/auth/AuthController.java
- action: update
- summary: /auth/naver/login, /auth/naver/callback 엔드포인트 추가 및 네이버 OAuth2 코드/토큰 플로우, 프로필 요청, JWT 발급
- instructions:
  - /auth/naver/login에서 네이버 인증 URL로 리다이렉트하는 엔드포인트 추가
  - /auth/naver/callback에서 code/state 파라미터 확인, 네이버 토큰 교환 REST API 호출
  - access token으로 네이버 사용자 프로필 요청 (openAPI e.g. https://openapi.naver.com/v1/nid/me)
  - naverId 기반으로 신규/기존 사용자 식별, JWT 발급 및 AuthResponse 반환
  - 에러 상황(토큰 오류/프로필 오류) 예외 처리 포함

### backend-core/src/main/java/com/whiteboard/core/user/User.java
- action: update
- summary: User 엔티티에 naverId 필드 추가 및 JPA 매핑
- instructions:
  - private String naverId 필드 추가
  - @Column(nullable = true, unique = true) 어노테이션 사용
  - getter/setter 구현, equals/hashCode에 포함 여부 점검

### backend-core/src/main/java/com/whiteboard/core/user/UserRepository.java
- action: update
- summary: NaverId로 사용자 조회하는 메서드 추가
- instructions:
  - Optional<User> findByNaverId(String naverId) 메서드 추가

### backend-core/src/main/java/com/whiteboard/core/auth/JwtUtil.java
- action: update
- summary: 네이버 로그인 사용자가 동일하게 JWT 발급 받을 수 있도록 claims 처리 통합 및 provider/providerId 정보 포함
- instructions:
  - JWT생성시, provider(provider: 'naver'), providerId(네이버 고유ID) claims와 함께 기존 claims 포함
  - 기존 계정(JWT)과 네이버 계정(JWT) 발급 로직 충돌 없게 분기 정리

## Verification
- none

## Risks
- naverId 필드 추가로 User DB 스키마 변경 필요
- JWT payload에 provider/providerId 추가시 계약 미준수 가능성
- 기존 OAuth2/JWT 인증 플로우와 통합 충돌 가능성
- 네이버 로그인 콜백에서 토큰 오류/프로필 API 예외 발생 시 방어 코드 필요
- application.properties의 OAuth2 클라이언트 설정 누락/오타 위험

## Questions
- JWT payload에 provider/providerId(예: 'naver', 'naver_123...')를 항상 포함해야 하나요? 기존 클라이언트는 이를 신뢰하나요?
- User Repository에 네이버 고유 ID(naverId)로 중복 사용자 식별만 충분한지, 혹시 email 등 추가정보도 필수인가요?
- AuthResponse 반환 시, 네이버 계정에는 이메일이 없는 경우가 있는데 이 필드는 필수인가요?
