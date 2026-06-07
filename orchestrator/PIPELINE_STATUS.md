# Orchestrator Pipeline Status

마지막 확인일: 2026-06-07

## 현재 상태

Whiteboard Capture 오케스트레이터는 실사용 가능한 안전 실행 파이프라인을 갖춘 상태입니다.

```text
사용자 요청
  -> manager 계획 수립
  -> 역할별 worker task packet 생성
  -> worker proposed edits 생성
  -> apply review 안전 게이트
  -> 선택적 실제 적용
  -> 역할별 검증 및 선택적 verify-all
  -> rollback 또는 keep-applied
  -> 결과 수집
  -> Markdown/HTML 리포트 생성
  -> 오래된 run 정리
```

아직 독립 보일러 프로젝트로 분리한 것은 아니지만, 다른 프로젝트로 옮기기 위한 템플릿과 패키징 명령은 준비되어 있습니다.

## 최근 리허설 기록

- 2026-06-06: frontend keep-applied 실사용 리허설 성공.
  - 요청: 로그인 화면 하단에 "문제가 계속되면 관리자에게 문의해 주세요." 문구 추가
  - 실행: `runner:full --compact --roles frontend --worker-provider openai --apply-provider openai --apply --keep-applied --concurrency 1`
  - 결과: worker/apply 성공, `.skills/verify-web.ps1` 통과, `runner:workflow exit=0`
  - 커밋: `db05c58 로그인 화면 도움말 문구 추가`
- 2026-06-07: java rollback-after-verify 리허설 성공.
  - 요청: `backend-core application.properties`의 네이버 OAuth 환경변수 설명 주석 보강
  - 실행: `runner:full --compact --roles java --worker-provider openai --apply-provider openai --apply --rollback-after-verify --concurrency 1`
  - 결과: worker/apply 성공, `.skills/verify-core.ps1` 및 backend-core 부팅/네이버 미설정 503 확인 기록, rollback 성공, `runner:workflow exit=0`
  - 적용 방식: 시험 적용 후 자동 롤백이므로 작업트리에 변경 없음
- 2026-06-07: rust review-only 리허설 성공.
  - 요청: 네이버 로그인 JWT가 backend-fast 업로드와 웹소켓 인증 경로에 영향이 없는지 리뷰
  - 실행: `runner:full --compact --roles rust --worker-provider openai --concurrency 1`
  - 결과: 코드 변경 불필요로 `skipped` 반환, JWT `sub` claim/JWT_SECRET_KEY/provider claim 무시 정책 확인, `runner:workflow exit=0`
  - 적용 방식: 리뷰 전용 worker이므로 apply/verification 없음
- 2026-06-07: mobile review-only 리허설 성공.
  - 요청: 네이버 로그인 JWT가 모바일 저장과 업로드 인증 흐름에 영향이 없는지 리뷰
  - 실행: `runner:full --compact --roles mobile --worker-provider openai --concurrency 1`
  - 결과: 코드 변경 불필요로 `skipped` 반환, 모바일 JWT 저장/업로드 인증 흐름은 기존 계약 유지 시 변경 불필요, `runner:workflow exit=0`
  - 잔여 확인: 실제 네이버 JWT claim 샘플, backend-core/backend-fast `JWT_SECRET_KEY` 일치, 운영 HTTPS 전환은 E2E 검증 필요

## 완료된 기능

- manager 계획 및 카테고리/템플릿 정책 적용
- worker task/result packet 생성
- OpenAI provider와 test provider 지원
- apply review 안전 게이트
  - allowed/blocked path 검증
  - 계약 변경 차단
  - 미해결 질문 차단
  - dependency/build manifest 변경 차단
- 안전 적용 모드
  - 기본 dry-run
  - `--rollback-after-verify` 시험 적용 후 자동 롤백
  - `--keep-applied` 의도적 영구 적용
- dirty worktree 보호
- 역할별 검증 스크립트 실행
- 선택적 `--verify-all`
- 검증 타임아웃 및 프로세스 종료 처리
- rollback snapshot, verification log, rollback summary 저장
- 최종 상태 구분: `succeeded`, `blocked`, `failed`
- compact terminal output
- OpenAI worker/apply API 사용량 메타데이터 기록
- Markdown report: `runs/<run-id>/report.md`
- HTML report: `runs/<run-id>/report.html`
- Run index page: `runs/index.html`
- 오래된 run 자동 정리 및 현재 run 보호
- 재사용 가능한 project config 템플릿
- 재사용 가능한 orchestrator packaging 명령
- 선택형 GitHub Actions dry-run workflow

## 주요 명령

### 안전 계획 / Dry Run

```powershell
cd "D:\개발\whiteboard capture\orchestrator"
& "C:\Program Files\nodejs\npm.cmd" run runner:full -- --compact --roles frontend,java,rust,mobile --worker-provider openai --concurrency 2 "요청 내용"
```

### 시험 적용 후 자동 롤백

```powershell
& "C:\Program Files\nodejs\npm.cmd" run runner:full -- --compact --roles frontend --worker-provider openai --apply-provider openai --apply --rollback-after-verify --concurrency 1 --continue-on-error "요청 내용"
```

### 검증 후 변경 유지

```powershell
& "C:\Program Files\nodejs\npm.cmd" run runner:full -- --compact --roles frontend --worker-provider openai --apply-provider openai --apply --keep-applied --concurrency 1 --continue-on-error "요청 내용"
```

### CI Dry Run

```powershell
& "C:\Program Files\nodejs\npm.cmd" run ci:dry-run
```

### 다른 프로젝트로 오케스트레이터 패키징

```powershell
& "C:\Program Files\nodejs\npm.cmd" run project:package -- --target "D:\개발\new-project" --name "New Project" --goal "Describe the product outcome" --dry-run
```

## 결과 읽는 법

일반 터미널에서는 마지막 `Final Summary` 블록만 먼저 보면 됩니다.

```text
## Final Summary
Status: succeeded|blocked|failed
Workers: ...
Applied roles: ...
API usage: calls=..., total_tokens=...
Verification: ...
Rollback: ...
Report: ...\report.md
HTML report: ...\report.html
```

복잡한 실행은 `report.html`을 여는 것이 좋습니다. 상태 수, API 사용량, worker 요약, risks, blockers, recommended verification을 한 화면에서 볼 수 있습니다.

## 최종 상태 의미

- `succeeded`: 선택된 worker/apply/verification 흐름이 성공했습니다.
- `blocked`: 계약 변경이나 미해결 질문 때문에 apply review가 파일 변경 전 안전하게 중단했습니다.
- `failed`: worker 실행, apply 실행, 검증, 롤백, cleanup 또는 런타임 단계가 실패했습니다.

`blocked`는 성공이 아닙니다. 안전 게이트가 작동했다는 뜻이고, 사람의 검토가 필요합니다.

## 재사용 준비 상태

재사용 기반은 준비되어 있지만, 아직 독립 보일러 repository로 분리하지는 않았습니다.

사용 가능한 재사용 도구:

- `orchestrator/templates/project-config/`
- `orchestrator/templates/policy-docs/`
- `orchestrator/templates/skills/`
- `npm run project:init`
- `npm run project:package`

나중에 권장되는 분리 순서:

1. 이 프로젝트에서 파이프라인을 조금 더 검증합니다.
2. 깨끗한 boilerplate 프로젝트로 패키징합니다.
3. Kubernetes, Helm/Kustomize, ArgoCD 템플릿은 배포 구조가 확정된 뒤 추가합니다.
4. GitHub Actions는 필수 배포 장치가 아니라 선택형 CI 템플릿으로 유지합니다.

## 남은 선택 작업

- 모델 가격 메타데이터가 정리되면 API 비용 추정 추가
- Kubernetes/ArgoCD 배포 템플릿 추가
- 실제 기능 리허설을 1~2회 더 진행한 뒤 독립 보일러 repository로 분리
