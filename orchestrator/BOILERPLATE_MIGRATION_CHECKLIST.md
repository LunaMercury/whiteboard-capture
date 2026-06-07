# Orchestrator Boilerplate Migration Checklist

이 문서는 현재 오케스트레이터를 다른 프로젝트로 옮긴 뒤 반드시 점검해야 하는 항목을 정리합니다.

## 1. 프로젝트 기본 정보

- [ ] `AGENTS.md`의 프로젝트 목적과 최우선 가치가 새 프로젝트와 일치하는지 확인합니다.
- [ ] `agent_role.md`의 역할 설명이 새 프로젝트의 팀/모듈 구조와 맞는지 확인합니다.
- [ ] `system_architecture.md`의 실제 모듈, 배포 구조, 데이터 흐름을 새 프로젝트에 맞게 갱신합니다.
- [ ] `security_guidelines.md`의 인증, 토큰, 스토리지, 네트워크 보안 정책이 새 프로젝트 정책과 충돌하지 않는지 확인합니다.

## 2. 오케스트레이터 설정

- [ ] `orchestrator/config/project.yaml`의 `name`, `goal`, `priorities`를 새 프로젝트 기준으로 수정합니다.
- [ ] `orchestrator/config/project.yaml`의 `modules` 경로가 실제 폴더 구조와 일치하는지 확인합니다.
- [ ] `orchestrator/config/project.yaml`의 `contracts`에 API, JWT, DB, WebSocket, 클라우드 환경변수 계약을 명시합니다.
- [ ] `orchestrator/config/project-templates.yaml`에서 `auth`, `design`, `redis`, `realtime` 정책을 새 프로젝트에 맞게 조정합니다.
- [ ] 새 프로젝트에 없는 모듈은 `project.yaml`과 검증 스크립트에서 제거하거나 `review/skip` 정책을 명확히 둡니다.

## 3. 검증 스크립트

- [ ] `.skills/verify-web.ps1`이 실제 웹 빌드 명령과 일치하는지 확인합니다.
- [ ] `.skills/verify-core.ps1`이 실제 Java/Spring 검증 명령과 JDK 버전을 반영하는지 확인합니다.
- [ ] `.skills/verify-fast.ps1`이 실제 Rust hot path 검증 명령과 일치하는지 확인합니다.
- [ ] `.skills/verify-mobile.ps1`이 실제 Android SDK/JDK/Gradle 환경과 맞는지 확인합니다.
- [ ] `.skills/verify-all.ps1`이 필요한 검증만 순서대로 실행하는지 확인합니다.
- [ ] 모바일 검증이 필요하면 `ANDROID_HOME` 또는 `mobile/local.properties`의 `sdk.dir`가 실제 SDK 경로를 가리키는지 확인합니다.

## 4. 보안과 비밀값

- [ ] `.env`, `.env.local`, secret 파일은 패키징 대상에 포함하지 않습니다.
- [ ] OpenAI API key, OAuth client secret, DB password, JWT secret은 새 프로젝트의 secret manager 또는 로컬 `.env`에만 둡니다.
- [ ] 프론트엔드에 provider client secret, access token, private API key가 노출되지 않는지 확인합니다.
- [ ] JWT claim 구조, signing algorithm, secret env 이름을 Java/Rust/Web/Mobile이 동일하게 이해하는지 확인합니다.

## 5. 첫 실행 순서

1. `cd orchestrator`
2. `npm install`
3. `npm run project:init -- --name "<project name>" --goal "<project goal>" --force`
4. `npm run ci:dry-run`
5. `.skills/verify-all.ps1`
6. 작은 기능으로 `runner:full --compact --roles <role> --worker-provider openai --apply-provider openai --apply --rollback-after-verify` 리허설을 실행합니다.
7. 문제가 없으면 `--keep-applied` 리허설을 한 번 실행하고 커밋합니다.

## 6. 완료 기준

- [ ] `npm run ci:dry-run`이 성공합니다.
- [ ] `.skills/verify-all.ps1`이 성공합니다.
- [ ] 최소 1개 구현 역할에서 `--rollback-after-verify`가 성공합니다.
- [ ] 최소 1개 review-only 역할에서 worker 결과가 합리적인 `skipped` 또는 `succeeded` 상태로 수집됩니다.
- [ ] `report.md`, `report.html`, `runs/index.html`이 생성되고 사람이 읽을 수 있습니다.
- [ ] 새 프로젝트에서 반드시 바꿔야 할 Whiteboard 전용 문구가 남아 있지 않습니다.
