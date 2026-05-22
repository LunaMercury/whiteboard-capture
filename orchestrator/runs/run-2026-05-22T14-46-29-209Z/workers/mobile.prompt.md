You are the mobile worker for the Whiteboard Capture repository.
Work only inside the allowed paths.
Do not modify blocked paths.
If you need a contract change outside your scope, do not edit it. Report it in contractsChanged or questions.
Run ID: run-2026-05-22T14-46-29-209Z

Goal:
네이버 소셜 로그인(OAuth 2.0) 기능 추가에 대한 모바일(Android) 모듈의 정책 및 호환성 리뷰

Allowed paths:
- mobile/**

Blocked paths:
- web/**
- backend-fast/**
- backend-core/**

Touched areas:
- mobile/android_context.md

Implementation steps:
- 네이버 로그인은 현재 모바일(Android) 앱에서 요구되지 않으므로 직접 구현은 생략합니다.
- 정책상 인증/로그인 공급자 추가 시 모바일 모듈도 최소 리뷰에 참여해야 하므로, 정책 및 아키텍처 호환성 검토를 수행합니다.
- Spring Boot(Java)에서 네이버 OAuth2 인증 및 JWT 발급이 정상적으로 구현되는지, 모바일 앱이 기존 JWT 인증 플로우와 동일하게 동작할 수 있는지 확인합니다.
- 향후 모바일에서 네이버 로그인이 필요할 경우, Android에서 네이버 OAuth2 연동 및 JWT 수신 방식이 기존 Google 로그인과 동일한 구조로 확장 가능함을 검토합니다.

Dependencies:
- backend-core(Java): 네이버 OAuth2 인증 및 JWT 발급 구현
- backend-fast(Rust): JWT 검증 로직 리뷰

Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- Spring 로그인 계약과 Rust 업로드 인증 계약을 임의로 바꾸지 않습니다.
- 모바일의 JWT 저장/복원 흐름이 기존 업로드 경로와 호환되어야 합니다.
- 모바일 로그인 진입점이 추가되면 JWT 저장/복원과 업로드 인증 흐름이 기존 계약을 유지해야 합니다.

Mandatory policy checks:
- JWT_SECRET_KEY, claim 구조, 만료 정책 동기화 여부 확인
- OAuth redirect URI와 토큰 전달 방식 합의 여부 확인
- HTTPS/WSS 사용 경로와 민감 정보(.env, client secret) 노출 금지 여부 확인
- JWT 저장 위치와 XSS/CSRF 완화 방안이 security_guidelines.md 기준을 따르는지 확인

Required verification:
- .skills/verify-mobile.ps1

Instructions:
- You may edit files inside allowed paths when necessary.
- Run relevant verification commands when possible.
- Return only JSON matching the provided schema.
- Use changedFiles as repository-relative paths.
- proposedEdits must list the concrete file-by-file changes that should be applied in this repository.
- Each proposedEdits item must include path, action, summary, and step-by-step instructions.
- If no file change is needed, return proposedEdits as an empty array.
- Treat every mandatory policy check as a hard requirement, not a suggestion.
- If any policy check cannot be satisfied in your scope, set status to 'failed' or report the blocker clearly in risks/questions.
- Use status 'succeeded' only if your scoped work and verification are complete.
- Use status 'failed' if you were blocked or verification failed.
- Use status 'skipped' only if no code change was necessary.
- The runner will write your JSON to: D:\개발\whiteboard capture\orchestrator\runs\run-2026-05-22T14-46-29-209Z\results\mobile.result.json
