# 고속 백엔드 파이프라인 컨텍스트 (Backend Fast Context)

*   **스택**: Rust, Tokio, Axum (또는 Actix-web), SQLx (비동기 DB 연결), Tungstenite (WebSocket).
*   **역할**: 가장 빠른 속도가 요구되는 'Hot Path' (이미지 수신 및 웹소켓 알림) 전담.

## 모듈화 및 아키텍처 설계
단일 파일에 모든 로직을 넣지 않고, 유지보수가 용이하도록 관심사 분리(Separation of Concerns)를 통해 엔터프라이즈급으로 모듈화합니다.
*   **Handlers (Controllers)**: HTTP/WebSocket 요청 수신 및 응답 처리 모듈.
*   **Services (Business Logic)**: 이미지 압축, 100개 제한 검사 등 핵심 비즈니스 로직.
*   **Repositories (DB Access)**: SQLx를 이용한 PostgreSQL 직접 접근 로직 격리. DB 트랜잭션 관리.
*   **Infrastructure**: Oracle Cloud 통신(OCI 클라이언트), WebSocket 커넥션 매니저.

## 주요 흐름
1.  모바일 앱에서 Multipart 형식으로 사진 수신.
2.  Oracle Cloud Object Storage 비동기 업로드.
3.  업로드 완료 시 PostgreSQL 직접 접속하여 메타데이터 Insert (이전 100개 초과 데이터 확인 후 자동 삭제 로직 포함).
4.  저장 직후, 해당 사용자의 Web 클라이언트와 연결된 WebSocket 세션을 찾아 알림 전송.
