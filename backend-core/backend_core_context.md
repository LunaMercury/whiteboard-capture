# 코어 백엔드 컨텍스트 (Backend Core Context)

*   **스택**: Java 17+, Spring Boot 4.0.6, Spring Security, Spring Data JPA.
*   **역할**: 속도가 상대적으로 덜 중요한 'Cold Path' (인증, 사용자 관리 등) 담당.

## 엔터프라이즈급 모듈화 및 MVC 아키텍처
유지보수와 확장이 용이하도록 기능을 명확히 분리하는 엔터프라이즈급 설계를 적용합니다.
*   **Controller Layer**: HTTP 요청/응답 라우팅. 비즈니스 로직 포함 금지.
*   **Service Layer**: 핵심 비즈니스 로직 수행 및 트랜잭션 관리 (`@Transactional`).
*   **Repository Layer**: 데이터베이스 접근 및 쿼리 실행.
*   **DTO Layer**: 클라이언트와 서버 간 데이터 전송 객체 분리. Entity를 직접 외부로 노출하지 않음.
*   **도메인별 패키지 구조**: 기능(Feature) 기반으로 패키지를 분리합니다. (예: `com.whiteboard.auth`, `com.whiteboard.user`, `com.whiteboard.history`)

## 주요 도메인
*   `/auth`: ID/PW 회원가입, 로그인, 구글 OAuth 2.0 처리, JWT 발급.
*   `/users`: 사용자 설정, 계정 관리.
*   `/history`: 과거 업로드된 최대 100개의 사진 목록 조회 기능.

*   **유의사항**: 인증 토큰(JWT)에 대한 검증 로직은 Rust 서버와 동일하게 유지되어야 함 (같은 Secret Key 공유).
