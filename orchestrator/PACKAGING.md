# Orchestrator Packaging

이 문서는 현재 오케스트레이터를 새 프로젝트에 재사용 가능한 골격으로 복사하는 방법을 정리합니다.

## 목적

`project:package`는 새 프로젝트 루트에 다음 항목을 생성합니다.

- `orchestrator/`: manager, worker, apply, verify, rollback 파이프라인 코드
- `.skills/`: Web, Java, Rust, Mobile, Orchestrator 검증 스크립트 시작 템플릿
- `AGENTS.md`, `agent_role.md`, `security_guidelines.md`, `system_architecture.md`: 기본 정책 문서 템플릿
- `orchestrator/config/project.yaml`, `orchestrator/config/project-templates.yaml`: 프로젝트별 설정 시작 템플릿

## 기본 사용법

먼저 dry-run으로 생성될 파일과 충돌 여부를 확인합니다.

```powershell
cd "D:\개발\whiteboard capture\orchestrator"
& "C:\Program Files\nodejs\npm.cmd" run project:package -- --target "D:\개발\new-project" --name "New Project" --goal "Describe the product outcome" --dry-run
```

문제가 없으면 실제로 생성합니다.

```powershell
& "C:\Program Files\nodejs\npm.cmd" run project:package -- --target "D:\개발\new-project" --name "New Project" --goal "Describe the product outcome"
```

## 안전장치

- 현재 프로젝트 루트에는 패키징하지 않습니다.
- 현재 `orchestrator/` 내부 또는 하위 폴더에는 패키징하지 않습니다.
- 기존 파일은 기본적으로 덮어쓰지 않습니다.
- 덮어쓰기가 필요하면 대상 프로젝트를 검토한 뒤 `--force`를 명시적으로 사용합니다.
- `.env`, `.env.local`, `node_modules`, `dist`, `runs`, 현재 프로젝트의 `PIPELINE_STATUS.md`는 복사하지 않습니다.

## 새 프로젝트에서 다음에 할 일

```powershell
cd "D:\개발\new-project\orchestrator"
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run project:init -- --name "New Project" --goal "Describe the product outcome" --force
```

그 다음 아래 파일을 프로젝트 실제 구조에 맞게 검토합니다.

- `AGENTS.md`
- `security_guidelines.md`
- `system_architecture.md`
- `.skills/verify-*.ps1`
- `orchestrator/config/project.yaml`
- `orchestrator/config/project-templates.yaml`

