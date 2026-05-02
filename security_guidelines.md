# 보안 원칙 (Security Guidelines)

이 프로젝트는 학생들의 필기와 개인 정보가 오가는 만큼, 철저한 보안이 필수적입니다.

## 1. 인증 및 인가 (Authentication & Authorization)
*   **OAuth 2.0 & JWT**: Google 로그인 및 자체 로그인은 모두 JWT를 기반으로 세션을 유지합니다.
*   **비밀번호 해싱**: 자체 회원가입 시 비밀번호는 BCrypt(또는 Argon2)를 통해 안전하게 해시하여 저장합니다.
*   **접근 제어**: 사용자는 오직 자신의 ID로 생성된 사진과 메타데이터만 조회 및 접근할 수 있습니다.

## 2. 데이터 보호 (Data Protection)
*   **전송 중 암호화**: 모든 클라이언트-서버 통신은 HTTPS 및 Secure WebSockets(WSS)를 통해 암호화되어야 합니다.
*   **저장 데이터 보호**: Oracle Cloud Object Storage에 저장되는 사진은 기본적으로 비공개(Private) 설정되며, 백엔드에서 생성된 만료 시간이 짧은 서명된 URL(Pre-signed URL)로만 접근할 수 있습니다.
*   **데이터 최소화**: 100개 제한 정책을 통해 오래된 사진은 물리적으로 완전히 삭제(Hard Delete)합니다.

## 3. 애플리케이션 보안 (Application Security)
*   **입력 검증**: SQL 인젝션, XSS 등을 방지하기 위해 프론트엔드와 백엔드 양측에서 모든 사용자 입력을 철저히 검증 및 살균(Sanitization)합니다.
*   **CORS & CSRF**: 프론트엔드 URL에 대해서만 엄격한 CORS 정책을 적용하고, 필요한 경우 CSRF 방어 메커니즘을 추가합니다.
