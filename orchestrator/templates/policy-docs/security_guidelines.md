# Security Guidelines

## 인증과 인가

- JWT 서명 알고리즘, claim 구조, 만료 정책은 모든 서버와 클라이언트가 동일하게 이해해야 합니다.
- OAuth client secret, provider access token, 서비스 계정 키는 프론트엔드나 모바일에 노출하지 않습니다.
- 인증이 필요한 API, 업로드, WebSocket 경로는 토큰 누락/만료/서명 오류를 명확하게 거부해야 합니다.

## 데이터 보호

- 민감 정보는 `.env`, 운영 secret store, CI secret에만 저장합니다.
- 로그에 access token, refresh token, client secret, 개인식별정보를 출력하지 않습니다.
- 캐시를 도입할 경우 TTL, 무효화 정책, 장애 시 fallback을 명확히 정의합니다.

## 클라이언트 보안

- 브라우저 토큰 저장 방식은 XSS/CSRF 위험을 고려해 결정합니다.
- 운영 환경에서는 HTTPS/WSS를 사용합니다.
- OAuth redirect URI와 허용 origin은 환경별로 명시적으로 관리합니다.

