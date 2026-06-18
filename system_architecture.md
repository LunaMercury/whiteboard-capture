# 전체 시스템 아키텍처 (System Architecture)

## 1. 시스템 컴포넌트

1.  **Mobile App (Android / Kotlin)**
    *   역할: 사진 촬영 및 자동 업로드 클라이언트.
    *   플로우: 카메라 촬영 -> 메모리 내 이미지 압축 -> Rust 서버로 즉시 전송.
2.  **Rust 파이프라인 (Backend Fast)**
    *   역할: 대용량 이미지 수신, 초고속 DB 메타데이터 저장, 실시간 알림 중계.
    *   특징: 지연 시간(Latency)을 최소화하기 위해 병목이 될 수 있는 업로드 로직과 DB 인서트를 직접 수행. 완료 즉시 연결된 Web 클라이언트의 WebSocket으로 알림을 보냄.
3.  **Spring Boot 코어 (Backend Core)**
    *   역할: Google OAuth 2.0 및 자체 ID/PW 로그인 처리, 전체 회원 관리 기능, 과거 100개 사진 목록 조회 등 REST API 제공.
    *   인증: 두 백엔드(Rust, Spring) 모두 동일한 JWT 토큰 Secret을 공유하여 검증.
4.  **Web Frontend (React / TypeScript)**
    *   역할: 학생용 대시보드.
    *   플로우: 로그인 -> 대시보드 접속(WebSocket 연결) -> 실시간 사진 렌더링 -> 클릭 시 Clipboard API로 클립보드에 이미지 복사.
5.  **저장소 (Oracle Cloud 인프라)**
    *   DB: PostgreSQL (유저 정보, 메타데이터).
    *   스토리지: OCI Object Storage (사진 원본 데이터 보관).

## 2. 주요 플로우 (Hot Path Flow)
`Mobile (사진 촬영) -> Rust Server (사진 수신 & OCI 업로드 & DB 저장) -> Rust WebSocket -> Web (사진 즉시 표시)`
