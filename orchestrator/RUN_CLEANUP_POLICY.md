# Run Cleanup Policy

`orchestrator/runs/` 아래에는 worker prompt, result, 검증 로그, diff snapshot이 쌓입니다.
`runner:workflow`와 `runner:full`은 실행 종료 후 오래된 run 기록을 자동으로 정리합니다.

## 기본 보존 정책

- 최근 10개 run은 유지합니다.
- 7일 이내 run은 유지합니다.
- 현재 실행 중인 run은 항상 유지합니다.
- 위 조건에 모두 해당하지 않는 오래된 run만 삭제합니다.

환경변수로 기본값을 바꿀 수 있습니다.

```text
RUNNER_CLEANUP_KEEP_LAST=10
RUNNER_CLEANUP_KEEP_DAYS=7
RUNNER_AUTO_CLEANUP=true
RUNNER_CLEANUP_INCLUDE_TRACKED=false
```

## 수동 점검

삭제 대상을 확인만 하려면 dry-run을 사용합니다.

```powershell
npm run runner:cleanup -- --dry-run
```

자동 정리를 일시적으로 점검 모드로 실행하려면 다음 옵션을 workflow 또는 full runner에 추가합니다.

```text
--cleanup-dry-run
```

특정 실행에서 자동 정리를 생략하려면 다음 옵션을 사용합니다.

```text
--skip-cleanup
```

Tracked run artifacts are protected by default. If old `orchestrator/runs/` files are already tracked by Git,
cleanup will print `keep tracked` and leave them alone. To intentionally remove tracked run artifacts, plan that
as a separate cleanup commit and pass:

```text
--include-tracked
```

## 안전 규칙

- `run-YYYY-...` 형식의 `runs/` 직속 디렉토리만 정리합니다.
- 심볼릭 링크와 `runs/` 바깥 경로는 삭제하지 않습니다.
- workflow는 현재 run ID를 cleanup 도구에 보호 대상으로 전달합니다.
