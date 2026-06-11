# Orchestrator Boilerplate Migration Checklist

이 문서는 현재 오케스트레이터를 다른 프로젝트로 옮긴 뒤 반드시 점검해야 하는 항목을 정리합니다.

독립 보일러 repository로 분리하기 전에는 [BOILERPLATE_SPLIT_GUIDE.md](./BOILERPLATE_SPLIT_GUIDE.md)도 함께 확인합니다.

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
- [ ] Whiteboard 전용 계약과 공통 보일러 계약을 분리했는지 확인합니다.

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
- [ ] 독립 보일러 repository로 분리하는 경우, `PIPELINE_STATUS.md`와 실행 산출물(`runs/`)을 포함하지 않습니다.
## 7. 복사 리허설 기준 체크

새 프로젝트로 옮기기 전에는 실제 임시 폴더에 복사해서 아래 항목을 확인합니다.

예시:

```powershell
cd "D:\개발\whiteboard capture\orchestrator"

& "C:\Program Files\nodejs\npm.cmd" run project:package -- --target "D:\개발\boilertest" --name "Boiler Test" --goal "Reusable orchestrator boilerplate rehearsal" --force

& "C:\Program Files\nodejs\npm.cmd" run project:validate-package -- --target "D:\개발\boilertest"

cd "D:\개발\boilertest\orchestrator"
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run ci:dry-run
```

복사 직후 확인:

- [ ] `orchestrator/package.json`이 생성되었습니다.
- [ ] `orchestrator/package-lock.json`이 생성되었습니다.
- [ ] `orchestrator/src/`가 생성되었습니다.
- [ ] `orchestrator/config/project.yaml`이 생성되었습니다.
- [ ] `orchestrator/config/project-templates.yaml`이 생성되었습니다.
- [ ] `orchestrator/OPERATIONS_GUIDE.md`가 생성되었습니다.
- [ ] `orchestrator/BOILERPLATE_SPLIT_GUIDE.md`가 생성되었습니다.
- [ ] `orchestrator/BOILERPLATE_MIGRATION_CHECKLIST.md`가 생성되었습니다.
- [ ] `.skills/verify-all.ps1`이 생성되었습니다.
- [ ] 루트 `AGENTS.md`가 생성되었습니다.
- [ ] 루트 `security_guidelines.md`가 생성되었습니다.
- [ ] `orchestrator/PIPELINE_STATUS.md`는 복사되지 않았습니다.
- [ ] `orchestrator/runs/`는 복사되지 않았습니다.
- [ ] `.env`와 `.env.local`은 복사되지 않았습니다.

비용 절감 alias 확인:

- [ ] `runner:full:safe`가 존재합니다.
- [ ] `runner:full:balanced`가 존재합니다.
- [ ] `runner:full:rehearse`가 존재합니다.
- [ ] `runner:workflow:safe`가 존재합니다.
- [ ] `runner:workflow:balanced`가 존재합니다.
- [ ] `runner:workflow:rehearse`가 존재합니다.
- [ ] `runner:workflow:reuse`가 존재합니다.

복사본 검증:

- [ ] 원본 orchestrator에서 `npm run project:validate-package -- --target "<target>"`가 성공합니다.
- [ ] `npm install`이 성공합니다.
- [ ] `npm audit` 결과에 치명적인 취약점이 없습니다.
- [ ] `npm run ci:dry-run`이 성공합니다.
- [ ] `ci:dry-run`의 `API cost`가 `$0.0000`입니다.
- [ ] `ci:dry-run`의 `Status`가 `succeeded`입니다.
- [ ] `ci:dry-run`에서 `runner:workflow: exit=0`이 출력됩니다.
- [ ] `project:validate-package`가 `node_modules` 또는 `runs` 경고를 출력하더라도, 이는 `npm install` 또는 `ci:dry-run` 이후의 런타임 산출물이므로 실패로 보지 않습니다.

새 프로젝트에서 반드시 바꿀 것:

- [ ] 루트 `AGENTS.md`의 프로젝트 목적과 우선순위
- [ ] 루트 `agent_role.md`의 역할 설명
- [ ] 루트 `security_guidelines.md`의 보안 정책
- [ ] 루트 `system_architecture.md`의 실제 아키텍처
- [ ] `orchestrator/config/project.yaml`의 모듈 이름, 경로, 계약
- [ ] `orchestrator/config/project-templates.yaml`의 category 참여 정책
- [ ] `.skills/verify-*.ps1`의 실제 빌드/테스트 명령
- [ ] 배포 도메인, secret 주입 방식, 운영 URL 정책

완료 기준:

- [ ] 새 프로젝트 복사본에서 mock/test provider 기반 dry-run이 API 비용 없이 동작합니다.
- [ ] 새 프로젝트 전용 정책 문서와 검증 스크립트가 현재 코드베이스와 일치합니다.
- [ ] 첫 실제 기능 리허설은 `--rollback-after-verify`로 실행하고 성공 기록을 남깁니다.
