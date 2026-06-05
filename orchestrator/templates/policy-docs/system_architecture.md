# System Architecture

## 개요

{{PROJECT_NAME}}는 Java Spring Boot 기반 core backend, Rust 기반 hot path backend, React web, Android mobile을 기본 구조로 사용합니다.

## 역할 분리

- Java backend-core: 인증, 계정, 권한, 기록, 핵심 비즈니스 규칙.
- Rust backend-fast: 업로드, 실시간 WebSocket, fan-out, 지연 시간이 중요한 처리.
- Web: 사용자 화면, 인증 진입점, 실시간 표시.
- Mobile: 촬영, 업로드, JWT 저장/복원, 사용자 입력.

## 공통 계약

- JWT claim과 서명 정책.
- API base URL과 WebSocket URL.
- CORS/origin 정책.
- 캐시 키, TTL, fallback 정책.
- 검증 스크립트와 릴리즈 차단 기준.

