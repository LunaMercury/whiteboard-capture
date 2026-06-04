# Orchestrator Pipeline Status

마지막 확인일: 2026-06-04

## 현재 상태

Whiteboard Capture 오케스트레이션 파이프라인의 핵심 실행 경로는 완료되었습니다.

지원 흐름:

```text
사용자 요청
  -> manager 전체 계획
  -> 역할별 worker 계획 및 proposedEdits
  -> apply review 안전 검토
  -> 선택적 실제 적용
  -> 역할별 검증 및 verify-all
  -> 선택적 자동 롤백 또는 변경 유지
  -> 결과 수집, 최종 보고, 오래된 run 정리
```

## 완료된 안전 기능

- 기본 dry-run, 명시적 `--apply`
- 시험 적용 `--rollback-after-verify`
- 영구 적용 `--keep-applied`
- dirty worktree 차단
- 역할별 allowed/blocked path 검증
- dependency/build manifest 자동 적용 차단
- 계약 변경 및 미해결 질문 apply review 차단
- OpenAI rate limit 재시도와 worker 동시 실행 제한
- 검증 타임아웃과 중단 시 롤백
- 검증 로그, diff snapshot, rollback summary 저장
- 오래된 run 자동 정리와 Git 추적 run 보호
- `succeeded`, `blocked`, `failed` 최종 상태 구분

## 검증된 시나리오

### 영구 적용 운영 리허설

- Frontend 실제 변경 적용
- 역할별 검증 성공
- 변경 유지 후 수동 확인 및 커밋 성공

### 전체 역할 안전 리허설

- `frontend,java,rust,mobile` worker 실행
- Java의 미해결 API 계약 질문을 apply review가 차단
- Frontend 임시 적용 후 `.skills/verify-all.ps1` 성공
- 자동 롤백 성공
- 최종 작업 트리 정리 성공
- 최종 상태가 `blocked`로 명확히 표시됨

## 권장 운영 명령

### 1. 안전한 계획 확인

```powershell
cd "D:\개발\whiteboard capture\orchestrator"
& "C:\Program Files\nodejs\npm.cmd" run runner:full -- --compact --roles frontend,java,rust,mobile --worker-provider openai --concurrency 2 "요청 내용"
```

### 2. 시험 적용 후 자동 롤백

```powershell
& "C:\Program Files\nodejs\npm.cmd" run runner:full -- --compact --roles frontend,java,rust,mobile --worker-provider openai --apply-provider openai --apply --rollback-after-verify --verify-all --concurrency 2 --continue-on-error "요청 내용"
```

### 3. 검증 후 변경 유지

```powershell
& "C:\Program Files\nodejs\npm.cmd" run runner:full -- --compact --roles frontend,java,rust,mobile --worker-provider openai --apply-provider openai --apply --keep-applied --verify-all --concurrency 2 --continue-on-error "요청 내용"
```

### 4. 차단 상태 확인

```powershell
& "C:\Program Files\nodejs\npm.cmd" run runner:status -- <run-id>
```

차단 질문과 계약을 실제로 검토하기 전에는 승인 옵션을 사용하지 않습니다.

## 최종 상태 해석

- `succeeded`: 요청한 적용과 검증이 성공함
- `blocked`: 안전 검토가 계약 변경 또는 미해결 질문으로 적용을 중단함
- `failed`: worker, apply, 검증, 롤백 또는 cleanup이 실제로 실패함

`blocked`는 의도된 안전 동작이지만 자동화가 적용 성공으로 오해하지 않도록 종료 코드는 `1`입니다.

## 남은 작업

핵심 파이프라인 완성과 별개인 선택적 개선 항목입니다.

- 다른 프로젝트에 복사하기 위한 전체 오케스트레이터 패키징 자동화
- CI 환경에서 dry-run 및 검증 실행 연결
- run 결과를 HTML 또는 간단한 대시보드로 표시
- API 사용량과 비용 메타데이터 기록
