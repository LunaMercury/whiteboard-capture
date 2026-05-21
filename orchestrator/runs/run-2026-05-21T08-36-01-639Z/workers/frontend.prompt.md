You are the frontend worker for the Whiteboard Capture repository.
Work only inside the allowed paths.
Do not modify blocked paths.
If you need a contract change outside your scope, do not edit it. Report it in contractsChanged or questions.
Run ID: run-2026-05-21T08-36-01-639Z

Goal:
웹 프론트엔드에 네이버 소셜 로그인 기능을 추가하여 사용자가 네이버 계정으로 인증할 수 있도록 한다.

Allowed paths:
- web/**

Blocked paths:
- backend-fast/**
- backend-core/**
- mobile/**

Touched areas:
- web/src/components/Login.tsx
- web/src/components/Login.module.css
- web/src/config.ts

Implementation steps:
- 1. 네이버 로그인 버튼 UI를 Login.tsx에 추가한다. (공식 네이버 CI 가이드에 맞는 버튼 스타일 적용)
- 2. 네이버 OAuth 인증 URL을 config.ts에 상수로 추가한다. (백엔드에서 제공하는 네이버 로그인 엔드포인트로 리디렉션)
- 3. 사용자가 네이버 로그인 버튼을 클릭하면, 네이버 OAuth 인증 플로우를 시작하도록 한다. (window.location.href로 백엔드 엔드포인트로 이동)
- 4. 백엔드(Spring)가 네이버 인증 후 JWT를 발급해 프론트엔드로 리디렉션하면, 해당 JWT를 URL 파라미터 또는 쿠키/로컬스토리지에 저장한다. (Login.tsx에서 처리)
- 5. JWT가 정상적으로 저장되면, 로그인 상태로 전환하고 대시보드 등 보호된 페이지로 이동한다.
- 6. 네이버 로그인 관련 에러/취소/실패 케이스에 대한 안내 메시지 및 UI 처리 추가
- 7. Login.module.css에 네이버 버튼 스타일 추가 (공식 가이드 준수)

Dependencies:
- 네이버 OAuth 클라이언트 ID/Secret 및 콜백 URL이 백엔드(Spring)에 등록되어 있어야 함
- 백엔드(Spring)에서 /auth/naver/login, /auth/naver/callback 등 엔드포인트가 구현되어 있어야 함 (JWT 발급 포함)
- JWT 파싱 및 저장 로직이 기존과 호환되어야 함 (JWT_SECRET_KEY 공유)

Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- VITE_API_BASE_URL, VITE_REALTIME_WS_URL 계약을 유지합니다.
- 백엔드 메시지 포맷과 JWT 전달 방식을 합의 없이 바꾸지 않습니다.
- 로그인 버튼, OAuth redirect, JWT 저장 방식은 백엔드와 합의된 계약만 사용합니다.

Required verification:
- .skills/verify-web.ps1

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
- The runner will write your JSON to: D:\개발\whiteboard capture\orchestrator\runs\run-2026-05-21T08-36-01-639Z\results\frontend.result.json
