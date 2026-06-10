# Orchestrator Boilerplate Split Guide

이 문서는 현재 Whiteboard Capture 안에서 검증한 오케스트레이터를 독립 보일러 프로젝트로 분리할 때의 기준을 정리합니다.

## 목표

보일러 분리의 목표는 "파이프라인 엔진은 재사용하고, 프로젝트 정책은 새 프로젝트에서 바꾸는" 구조를 만드는 것입니다.

분리 후에도 유지되어야 하는 공통 흐름:

1. 사용자 요청을 manager가 분석합니다.
2. 역할별 worker task packet을 생성합니다.
3. 구현 역할은 proposed edits를 만들고 apply review를 통과한 뒤 적용합니다.
4. review-only 역할은 변경 없이 risks/questions를 보고할 수 있습니다.
5. 검증, rollback, keep-applied, report 생성 흐름을 유지합니다.

## 공통 보일러로 유지할 항목

다음 항목은 다른 프로젝트에서도 그대로 재사용할 수 있습니다.

- `orchestrator/src/`
- `orchestrator/package.json`
- `orchestrator/package-lock.json`
- `orchestrator/README.md`
- `orchestrator/RUNNER_WORKFLOW.md`
- `orchestrator/SAFE_APPLY_MODES.md`
- `orchestrator/APPLY_REVIEW_GATES.md`
- `orchestrator/RUN_CLEANUP_POLICY.md`
- `orchestrator/PACKAGING.md`
- `orchestrator/BOILERPLATE_MIGRATION_CHECKLIST.md`
- `orchestrator/BOILERPLATE_SPLIT_GUIDE.md`
- `orchestrator/templates/project-config/`
- `orchestrator/templates/policy-docs/`
- `orchestrator/templates/skills/`

## 프로젝트별로 반드시 바꿀 항목

다음 항목은 Whiteboard Capture 전용이므로 새 프로젝트에서 반드시 검토해야 합니다.

- 루트 `AGENTS.md`
- 루트 `agent_role.md`
- 루트 `security_guidelines.md`
- 루트 `system_architecture.md`
- `.skills/verify-*.ps1`
- `orchestrator/config/project.yaml`
- `orchestrator/config/project-templates.yaml`
- 각 모듈별 context 문서
- 실제 모듈 경로(`web`, `backend-core`, `backend-fast`, `mobile` 등)
- 환경변수 이름과 secret 관리 방식
- API, JWT, DB, WebSocket, cloud storage 계약

## Whiteboard 전용으로 남겨도 되는 항목

아래 항목은 현재 프로젝트에서만 유지하고, 독립 보일러 저장소에는 기본적으로 포함하지 않습니다.

- `orchestrator/PIPELINE_STATUS.md`
- `orchestrator/runs/`
- `.env`, `.env.local`
- 실제 서비스 코드(`web`, `backend-core`, `backend-fast`, `mobile`)
- Docker, run scripts, cloud 설정 중 Whiteboard Capture 로컬 환경에 묶인 파일

## 분리 전 점검

독립 보일러 repository를 만들기 전, 현재 프로젝트에서 아래가 끝나 있어야 합니다.

- [x] `npm run ci:dry-run` 성공
- [x] 최소 1개 구현 역할의 `--keep-applied` 리허설 성공
- [x] 최소 1개 Java 구현 역할의 `--keep-applied` 리허설 성공
- [x] Rust review-only 리허설 성공
- [x] Mobile review-only 리허설 성공
- [x] 보일러 패키징 실제 write 리허설 성공
- [x] 패키징된 복사본에서 `npm install` 성공
- [x] 패키징된 복사본에서 `npm run ci:dry-run` 성공

## 분리 절차

권장 분리 절차:

1. 새 빈 repository를 만듭니다.
2. `npm run project:package -- --target <새 repository 경로> --name "<Boilerplate Name>" --goal "<Reusable orchestrator boilerplate>"`를 실행합니다.
3. 새 repository에서 `npm install`을 실행합니다.
4. 새 repository에서 `npm run ci:dry-run`을 실행합니다.
5. `BOILERPLATE_MIGRATION_CHECKLIST.md`를 기준으로 Whiteboard 전용 문구를 제거합니다.
6. README에 새 프로젝트 이식 방법과 필수 환경변수를 정리합니다.
7. 첫 태그를 `v0.1.0`처럼 작게 시작합니다.

## 보일러 분리 후 유지 방식

분리 후 권장 운영 방식:

- 보일러 repository에서는 엔진, 공통 템플릿, 안전장치, 문서만 유지합니다.
- 실제 제품 repository에서는 `project.yaml`, `project-templates.yaml`, `.skills`, 정책 문서를 제품에 맞게 수정합니다.
- 보일러에서 개선한 기능은 제품 repository에 복사 또는 cherry-pick합니다.
- 제품 repository에서 발견한 프로젝트 전용 정책은 보일러에 바로 넣지 않고, 일반화 가능한지 먼저 판단합니다.

## 아직 보류하는 항목

아래는 보일러 분리 직후가 아니라 배포 구조가 확정된 뒤 추가합니다.

- Kubernetes manifest
- Helm 또는 Kustomize 템플릿
- ArgoCD Application 템플릿
- GitHub Actions 외 다른 CI/CD 공급자별 템플릿
- 모델별 비용 추정 메타데이터
## 분리 판단 기준

보일러플레이트로 가져갈지, 새 프로젝트에서 다시 작성할지 애매할 때는 아래 기준을 사용합니다.

### 그대로 가져갈 수 있는 것

- manager, worker, verifier, apply, rollback, report 생성 흐름
- task packet과 result packet 스키마
- `--compact`, `--concurrency`, `--reuse-worker-results`, `--rollback-after-verify`, `--keep-applied` 같은 실행 옵션
- apply review gate의 기본 안전 규칙
- 비용 추정, run cleanup, HTML/Markdown report 생성 구조
- mock/test provider 기반 dry-run 흐름
- 보일러플레이트 패키징 스크립트

### 새 프로젝트에서 반드시 다시 정해야 하는 것

- 서비스 목적과 우선순위
- 모듈 이름과 실제 경로
- 기술 스택 버전
- `.skills/verify-*.ps1`의 실제 검증 내용
- 인증/JWT/세션/스토리지/API/WebSocket 계약
- 배포 환경, 도메인, secret 주입 방식
- 개인정보, 보안, 데이터 보관 정책
- category template의 참여 정책

### 일부만 재사용할 수 있는 것

- `auth`, `redis`, `realtime`, `design` 같은 category template
- Java 기본 백엔드, Rust hot path, Web, Mobile 역할 분리 정책
- 보안 체크리스트
- 비용 절감 기본값
- 운영형 사용 설명서

이 항목들은 새 프로젝트의 구조가 Whiteboard Capture와 비슷하면 큰 틀은 재사용할 수 있습니다. 다만 실제 경로, 환경변수, 검증 스크립트, API 계약은 반드시 새 프로젝트 기준으로 다시 확인해야 합니다.

## 재사용 시 안전 규칙

- 보일러플레이트는 정책의 출발점이지, 새 프로젝트의 최종 정책이 아닙니다.
- `AGENTS.md`, 보안 문서, 아키텍처 문서는 새 프로젝트에서 먼저 작성하거나 검토합니다.
- worker가 볼 context는 새 프로젝트의 현재 파일 상태를 기준으로 생성합니다.
- 이전 프로젝트의 run 결과나 worker 결과를 새 프로젝트에 재사용하지 않습니다.
- 비용 절감 기능은 같은 repository, 같은 run, 같은 코드 상태에서만 사용합니다.
- 다른 프로젝트로 옮긴 직후에는 mock dry-run, 단일 role rollback rehearsal, 전체 verification 순서로 검증합니다.
