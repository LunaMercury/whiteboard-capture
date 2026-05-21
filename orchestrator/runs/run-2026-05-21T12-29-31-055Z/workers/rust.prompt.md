You are the rust worker for the Whiteboard Capture repository.
Work only inside the allowed paths.
Do not modify blocked paths.
If you need a contract change outside your scope, do not edit it. Report it in contractsChanged or questions.
Run ID: run-2026-05-21T12-29-31-055Z

Goal:
네이버 OAuth2 로그인 도입 시 Rust(backend-fast) 모듈의 JWT 검증 및 실시간 경로 보호가 제대로 동작하는지 검토하고, Java(Spring Boot)에서 발급한 JWT가 Rust에서 정상적으로 수용되는지 호환성 체크를 수행합니다.

Allowed paths:
- backend-fast/**

Blocked paths:
- web/**
- backend-core/**
- mobile/**

Touched areas:
- backend-fast/src/handlers.rs
- backend-fast/src/main.rs
- backend-fast/src/services.rs

Implementation steps:
- 1. Java(Spring Boot)에서 네이버 OAuth2 인증 후 발급하는 JWT의 구조(alg, claim, 서명 방식 등)가 Rust(backend-fast)에서 사용하는 jsonwebtoken 라이브러리와 호환되는지 확인합니다.
- 2. backend-fast/src/services.rs 내 JWT 검증 로직이 새로운 네이버 로그인 기반 JWT에도 동일하게 적용되는지 점검합니다. (예: iss, sub, exp, email 등 필수 claim이 누락되지 않는지)
- 3. ALLOWED_WEB_ORIGINS, PUBLIC_BASE_URL 등 환경변수 및 CORS 정책이 네이버 로그인 후 리다이렉트/토큰 교환 시에도 문제없이 동작하는지 확인합니다.
- 4. WebSocket 및 이미지 업로드 엔드포인트에서 JWT 인증 미들웨어가 네이버 로그인 사용자에게도 정상적으로 적용되는지 테스트합니다.
- 5. Java와 Rust 양쪽에서 JWT_SECRET_KEY가 동일하게 적용되고 있는지, 환경변수 전달 경로를 재확인합니다.
- 6. (필요시) JWT claim에 provider(google/naver 등) 구분이 추가될 경우, Rust 쪽 파싱 로직이 이를 무시하거나 안전하게 처리하는지 검토합니다.

Dependencies:
- Java(Spring Boot)에서 JWT 발급 로직이 완성되어야 실제 토큰을 검증할 수 있습니다.
- .env 및 run.bat에서 JWT_SECRET_KEY, ALLOWED_WEB_ORIGINS, PUBLIC_BASE_URL 등 환경변수 일치 필요

Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- JWT_SECRET_KEY, ALLOWED_WEB_ORIGINS, PUBLIC_BASE_URL 계약을 유지합니다.
- 업로드 hot path와 websocket fan-out의 성능 특성을 해치지 않습니다.
- JWT_SECRET_KEY, claim 구조, 만료 정책이 Spring 발급 토큰과 일치해야 합니다.

Required verification:
- .skills/verify-fast.ps1
- .skills/verify-all.ps1

Instructions:
- You may edit files inside allowed paths when necessary.
- Run relevant verification commands when possible.
- Return only JSON matching the provided schema.
- Use changedFiles as repository-relative paths.
- proposedEdits must list the concrete file-by-file changes that should be applied in this repository.
- Each proposedEdits item must include path, action, summary, and step-by-step instructions.
- If no file change is needed, return proposedEdits as an empty array.
- Use status 'succeeded' only if your scoped work and verification are complete.
- Use status 'failed' if you were blocked or verification failed.
- Use status 'skipped' only if no code change was necessary.
- The runner will write your JSON to: D:\개발\whiteboard capture\orchestrator\runs\run-2026-05-21T12-29-31-055Z\results\rust.result.json
