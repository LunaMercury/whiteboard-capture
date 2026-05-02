# 클라우드 인프라 컨텍스트 (Cloud Infrastructure Context)

*   **벤더**: Oracle Cloud Infrastructure (OCI).
*   **컴포넌트**:
    *   **Compute Instance**: Spring Boot 및 Rust 서버 호스팅.
    *   **Object Storage**: 사용자의 사진 원본 파일 보관. 모두 비공개(Private) 버킷이며, 백엔드에서 Pre-signed URL을 생성해 접근.
    *   **Database**: Managed PostgreSQL 또는 Compute 내 직접 구축.
*   **보안 규칙**:
    *   인바운드 포트는 HTTPS(443)만 외부에 개방 (필요시 WSS 용 포트 포함).
    *   내부 통신(Spring <-> DB, Rust <-> DB)은 내부 프라이빗 IP만 사용.
