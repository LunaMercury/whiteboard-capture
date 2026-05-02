# 모바일 안드로이드 컨텍스트 (Android Context)

*   **스택**: Kotlin, Android SDK, CameraX, Retrofit/OkHttp, Coroutines.
*   **핵심 철학**: 버튼 터치를 최소화. 카메라 프리뷰 화면에서 촬영 버튼을 누르는 순간, 화면 전환 없이 백그라운드에서 바로 전송되어야 함.
*   **주요 기능**:
    *   Google 계정 연동 및 자체 ID/PW 로그인. JWT 토큰 획득.
    *   CameraX를 활용한 고화질 촬영.
    *   촬영 즉시 Rust 서버로 Multipart 이미지 업로드.
*   **유의사항**: 모바일 네트워크 환경을 고려해 재시도 로직과 보안 연결(HTTPS) 적용.
