# 웹 프론트엔드 컨텍스트 (Frontend Context)

*   **스택**: React, TypeScript, Vite.
*   **스타일링**: CSS 모듈 방식(예: `Dashboard.module.css`). 클래스 이름은 BEM 등 사람이 읽기 쉬운 형태로 작성 (Tailwind 금지/최소화). 디자인은 프리미엄하고 역동적인 애니메이션(Glassmorphism 등) 권장.
*   **핵심 기능**:
    *   인증: Google 로그인 및 ID/PW 로그인 UI.
    *   실시간 수신: `WebSocket`을 이용해 Rust 서버와 지속적으로 연결.
    *   원클릭 복사: 수신된 사진 요소를 클릭하면 브라우저의 원시 `navigator.clipboard.write()` API를 사용하여 이미지 Blob을 직접 클립보드에 복사 (워드, 노션 붙여넣기 지원).
*   **유의사항**: 사진이 100개로 제한되므로, 목록 렌더링 시 최신 순으로 정렬.
