# Whiteboard Capture - AI 개발 지침 (Gemini Context)

이 파일은 AI 에이전트(Gemini)가 프로젝트를 진행할 때 항상 참고해야 하는 핵심 지침을 담고 있습니다.

## 1. 프로젝트 핵심 (Project Core)
*   **목적**: 학생들이 칠판을 찍으면(앱) 수동 복사 과정 없이 즉시 웹(PC)에서 사진을 복사할 수 있는 연동 서비스.
*   **가장 중요한 가치**: **"속도"** (사진 촬영부터 웹 브라우저 표시까지 지연 없는 실시간성) 및 **"보안"** (OAuth, JWT, WSS, 안전한 스토리지).

## 2. 기술 스택 및 구조
*   **Web**: React, TypeScript, 전통적 CSS 모듈 (Tailwind 최소화). WebSocket 연동 필수.
*   **Backend (Core)**: Java Spring Boot. (계정/인증/기록 관리).
*   **Backend (Fast/Hot Path)**: Rust. (이미지 업로드 수신, DB 직접 트랜잭션, 실시간 WebSocket 라우팅).
*   **Mobile**: Android Kotlin, CameraX, 백그라운드 초고속 업로드.
*   **Database & Cloud**: PostgreSQL, Oracle Cloud Object Storage.

## 3. 개발 방법론 (Harness Engineering)
*   `.skills` 디렉토리에 각 모듈의 실행 및 테스트 스크립트를 정의하고 단계적으로 활용한다.
*   MCP(Model Context Protocol)는 최소화하거나 사용하지 않는다.

## 4. 데이터 보관 정책 (Retention Policy)
*   **100개 제한**: 사용자는 1주일간 최대 100개의 사진만 유지.
*   101번째 사진 저장 시 오래된 데이터부터 자동 삭제(FIFO).
