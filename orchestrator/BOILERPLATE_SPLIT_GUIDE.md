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
