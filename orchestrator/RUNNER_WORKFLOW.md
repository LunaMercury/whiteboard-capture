# Orchestrator Runner Workflow

이 문서는 Whiteboard Capture 오케스트레이터의 표준 실행 흐름을 정리합니다.

## 핵심 원칙

- 기본 실행은 dry-run입니다. `--apply`를 붙이지 않으면 저장소 파일을 수정하지 않습니다.
- 실제 적용은 `--apply`를 명시한 경우에만 실행됩니다.
- `--apply`는 기본적으로 깨끗한 git worktree에서만 실행됩니다.
- dependency/build manifest 변경은 apply review 단계에서 차단됩니다.
- `--verify-all`은 dry-run에서는 실제 전체 검증을 실행하지 않습니다.
- `--verify-all`은 `--apply` 또는 `--skip-workers`처럼 적용된 결과를 검증하는 상황에서만 전체 검증을 실행합니다.

## 1. 전체 계획과 worker dry-run을 한 번에 실행

가장 기본적인 안전 실행입니다. 계획을 만들고 worker 결과를 수집하지만 파일은 수정하지 않습니다.

```powershell
cd orchestrator
& "C:\Program Files\nodejs\npm.cmd" run runner:full -- "네이버 로그인 구현해줘"
```

특정 역할만 실행할 수 있습니다.

```powershell
cd orchestrator
& "C:\Program Files\nodejs\npm.cmd" run runner:full -- --roles java,frontend "네이버 로그인 구현해줘"
```

mock 모드에서는 실제 모델 호출 없이 흐름만 확인합니다.

```powershell
cd orchestrator
& "C:\Program Files\nodejs\npm.cmd" run runner:full:mock -- --roles frontend,java --worker-provider manual "네이버 로그인 구현해줘"
```

## 2. 기존 run에서 특정 역할만 적용

dry-run 결과를 확인한 뒤 특정 역할만 실제 적용합니다.

```powershell
cd orchestrator
& "C:\Program Files\nodejs\npm.cmd" run runner:workflow -- <run-id> --roles java --apply
```

이 명령은 다음 순서로 동작합니다.

1. worker 실행 또는 기존 결과 갱신
2. apply review gate 실행
3. apply 준비
4. 실제 파일 수정
5. 역할별 검증 실행
6. 결과 수집

## 3. 전체 검증까지 포함한 적용

역할별 검증 후 전체 프로젝트 검증까지 실행하려면 `--verify-all`을 추가합니다.

```powershell
cd orchestrator
& "C:\Program Files\nodejs\npm.cmd" run runner:workflow -- <run-id> --roles java --apply --verify-all
```

주의: `verify-all`은 web, Rust, Java, Android, orchestrator 검증을 모두 실행하므로 오래 걸릴 수 있습니다.

## 4. apply review만 실행

worker가 만든 `proposedEdits`가 적용 가능한지 먼저 확인합니다.

```powershell
cd orchestrator
& "C:\Program Files\nodejs\npm.cmd" run runner:review -- <run-id> java
```

review gate는 다음을 검사합니다.

- 제안 파일이 allowed paths 안에 있는지
- blocked paths를 건드리지 않는지
- 계약 변경을 숨기지 않았는지
- required verification이 존재하는지
- dependency/build manifest 변경이 포함되어 있는지
- 신규 dependency 사용을 암묵적으로 제안하지 않는지

## 5. 이미 적용된 결과만 다시 검증

worker/apply를 다시 실행하지 않고 기존 result packet 기준으로 검증만 다시 돌릴 수 있습니다.

```powershell
cd orchestrator
& "C:\Program Files\nodejs\npm.cmd" run runner:workflow -- <run-id> --roles java --skip-workers --verify-all
```

## 6. 위험 옵션

### `--allow-dirty`

기본적으로 `--apply`는 git worktree가 깨끗해야 실행됩니다.

테스트 목적으로 현재 변경 위에 apply해야 할 때만 사용합니다.

```powershell
cd orchestrator
& "C:\Program Files\nodejs\npm.cmd" run runner:workflow -- <run-id> --roles java --apply --allow-dirty
```

이 옵션은 사용자의 기존 변경과 worker 적용 결과가 섞일 수 있으므로 신중히 사용합니다.

### `--apply-review`

review mode worker의 proposed edits도 적용 대상으로 허용합니다.

기본적으로 review worker는 apply하지 않습니다.

## 7. 권장 작업 순서

큰 작업은 다음 순서로 진행합니다.

```powershell
# 1. 안전한 전체 dry-run
& "C:\Program Files\nodejs\npm.cmd" run runner:full -- "네이버 로그인 구현해줘"

# 2. report/result 확인
# orchestrator/runs/<run-id>/report.md
# orchestrator/runs/<run-id>/results/*.result.json

# 3. 특정 역할 review
& "C:\Program Files\nodejs\npm.cmd" run runner:review -- <run-id> java

# 4. 특정 역할만 apply
& "C:\Program Files\nodejs\npm.cmd" run runner:workflow -- <run-id> --roles java --apply

# 5. 필요 시 전체 검증
& "C:\Program Files\nodejs\npm.cmd" run runner:workflow -- <run-id> --roles java --skip-workers --verify-all
```

작은 작업은 바로 `--apply`를 사용할 수 있습니다.

```powershell
& "C:\Program Files\nodejs\npm.cmd" run runner:full -- --roles frontend --apply "버튼 문구만 수정해줘"
```

## 8. 산출물 위치

각 run은 아래 위치에 저장됩니다.

```text
orchestrator/runs/<run-id>/
  report.md
  tasks/
  results/
  workers/
  applies/
  meta/
```

중요 파일:

- `report.md`: 최종 요약
- `tasks/*.task.json`: worker 입력 패킷
- `results/*.result.json`: worker 결과 패킷
- `workers/*.prompt.md`: worker 프롬프트
- `applies/*.review.md`: apply review 결과
- `applies/*.apply.md`: apply 프롬프트
- `meta/manifest.json`: run 메타데이터
