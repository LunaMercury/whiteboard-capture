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
- 2026-06-07: 전체 역할 통합 리허설 성공.
  - 요청: 네이버 로그인 기능 전체 변경 계획 점검
  - 실행: `runner:full --compact --roles frontend,java,rust,mobile --worker-provider openai --concurrency 2`
  - 결과: 네 역할 모두 추가 변경 불필요로 `skipped` 반환, `runner:workflow exit=0`
  - 잔여 확인: 실제 배포 전 `.skills/verify-all.ps1` 및 네이버 OAuth E2E 검증 필요
- 2026-06-07: 전체 프로젝트 검증 성공.
  - 실행: `.skills/verify-all.ps1`
  - 결과: Web, backend-fast, backend-core, mobile, orchestrator 검증 모두 통과
  - 참고: Codex 샌드박스에서는 Android SDK 로컬 경로 접근이 제한될 수 있으므로, 모바일 포함 전체 검증은 실제 개발 환경 권한에서 실행해야 함
- 2026-06-07: 재사용 패키징 dry-run 성공.
  - 실행: `project:package --target ".tmp/orchestrator-package-dry-run" --name "Boilerplate Dry Run" --goal "Validate reusable orchestrator packaging" --dry-run`
  - 결과: 73개 파일 생성 계획, 기존 충돌 0개, dry-run이므로 실제 파일 작성 없음
- 2026-06-07: 재사용 패키징 실제 복사 리허설 성공.
  - 대상: `C:\Users\Public\Documents\ESTsoft\CreatorTemp\orchestrator-package-rehearsal-20260607-215410`
  - 실행: `project:package --target <temp-target> --name "Boilerplate Rehearsal" --goal "Validate actual reusable orchestrator package copy"`
  - 결과: 75개 파일 복사, `npm install` 성공, 복사본의 `npm run ci:dry-run` 성공
  - 보강: `run.bat`가 없는 새 프로젝트와 `.git`이 없는 초기 패키징 폴더에서도 `runner:prepare`, `runner:cleanup`이 동작하도록 수정
  - 참고: `npm install`에서 dependency audit 경고가 표시되므로 추후 보일러 분리 전에 의존성 업데이트 검토 필요

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
- 독립 보일러 repository 분리 여부 결정

## 2026-06-08 의존성 업데이트 후 보일러 패키징 리허설

- 대상: `C:\Users\Public\Documents\ESTsoft\CreatorTemp\orchestrator-package-rehearsal-20260608-204049`
- 패키징: `npm run project:package` 실제 write 성공, 75개 파일 생성, 충돌 0개
- 대상 설치: `npm install` 성공, `found 0 vulnerabilities`
- 대상 검증: `npm run ci:dry-run` 성공
- 검증 의미: LangChain 1.x 의존성 업데이트 후에도 새 프로젝트 복사본에서 TypeScript 빌드와 mock full workflow가 정상 동작함

## 2026-06-08 역할별 운영 리허설 완료

현재 파이프라인 완성도는 실사용 기준 약 92~95%입니다.

- Frontend 구현 역할: `--keep-applied` 성공, `.skills/verify-web.ps1` 성공, 실제 커밋 완료
- Java 구현 역할: `--keep-applied` 성공, `.skills/verify-core.ps1` 성공, 실제 커밋 완료
- Rust review-only 역할: 코드 변경 없이 `skipped` 결과와 리스크 보고 수집 성공
- Mobile review-only 역할: 코드 변경 없이 `skipped` 결과와 리스크 보고 수집 성공
- 전체 의존성 정리 후 `.skills/verify-all.ps1` 성공 이력 있음

운영 리허설에서 확인된 정상 패턴:

- 구현 역할은 `proposed_edits` 생성 후 apply, verify, keep-applied, commit 흐름으로 진행할 수 있습니다.
- review-only 역할은 변경이 필요 없으면 `skipped`, `proposed_edits: 0`, `changed_files: 0`으로 끝나는 것이 정상입니다.
- `report.md`와 `report.html`은 API 사용량, worker 요약, risks/questions를 확인하는 기준 산출물입니다.

현재 남은 주요 판단:

- Mobile 보안 리스크(`SharedPreferences` JWT 저장, HTTP 개발 URL, cleartext traffic)는 실제 배포 전 별도 보안 작업으로 다룹니다.
- Rust 컨텍스트의 OCI/Object Storage 업로드 언급과 실제 구현 범위 차이는 클라우드 스토리지 작업 때 정합성을 맞춥니다.
- 보일러 분리는 가능하지만, Kubernetes/ArgoCD 템플릿은 배포 구조 확정 후 추가합니다.

## 2026-06-09 모바일 JWT 보안 저장소 적용 후 전체 검증

- 작업: 모바일 JWT 저장을 `EncryptedSharedPreferences` 기반 보안 저장소로 개선
- 오케스트레이션 결과: mobile apply 이후 최초 검증은 타입 불일치로 실패했으나, `JwtSecureStorage` 반환 타입과 version catalog 정리 후 수동 복구 성공
- 보강: 기존 `auth_prefs/jwt_token`의 legacy token을 새 암호화 저장소로 자동 마이그레이션하고, 로그아웃 시 legacy token도 함께 삭제
- 모바일 검증: `.skills/verify-mobile.ps1` 성공
- 전체 검증: `.skills/verify-all.ps1` 성공
- 계약 유지: backend-core JWT 발급 계약과 backend-fast `Authorization: Bearer <JWT>` 업로드 인증 계약은 변경하지 않음

다음 추천 작업:

- 모바일/로컬 개발용 HTTP URL과 `cleartextTraffic` 정책 정리
- 실제 배포용 HTTPS/WSS 환경변수와 Android network security policy 분리

## 2026-06-10 모바일 개발/운영 네트워크 설정 분리

- 작업: 모바일 앱의 개발용 HTTP/cleartext 설정과 운영용 HTTPS/WSS 설정을 빌드 타입 기준으로 분리
- debug 빌드:
  - `CORE_API_BASE_URL=http://10.0.2.2:18080`
  - `FAST_API_BASE_URL=http://10.0.2.2:3000`
  - `FAST_WS_BASE_URL=ws://10.0.2.2:3000/ws`
  - `10.0.2.2`, `localhost`에 한해 cleartext 허용
- release 빌드:
  - `RELEASE_CORE_API_BASE_URL`
  - `RELEASE_FAST_API_BASE_URL`
  - `RELEASE_FAST_WS_BASE_URL`
  - Gradle property 또는 현재 프로세스/CI 환경변수로 주입
  - `https://` / `wss://`가 아니면 release task에서 실패
  - cleartext traffic 비허용
- 검증: `.skills/verify-mobile.ps1` 통과
- 원인 분석:
  - Docker Desktop과 무관함
  - 최초 실패는 AI apply가 생성한 Gradle Kotlin DSL 문자열 문법 오류
  - 이후 실패는 release URL 검증이 debug compile configuration 단계까지 막은 문제
  - 최종 구현에서는 debug compile은 release URL 없이 통과하고, release task에서만 운영 URL을 검증하도록 정리
- 문서: `mobile/RELEASE_NETWORK_CONFIG.md`
- 계약 유지:
  - backend-core 로그인 API 계약 유지
  - backend-fast 업로드 `Authorization: Bearer <JWT>` 계약 유지

다음 추천 작업:

- 운영 배포 도메인이 확정되면 CI/CD 또는 ArgoCD/Kubernetes Secret 주입 방식 문서화
- `verify-all`로 전체 통합 검증 재확인
- Rust/Object Storage 업로드 계약 정리

## 2026-06-10 전체 통합 검증 통과

- 실행 위치: `D:\개발\whiteboard capture\orchestrator`
- 실행 명령: `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "..\.skills\verify-all.ps1"`
- 결과: 전체 검증 통과
- 통과 항목:
  - Web: React/TypeScript/Vite production build 성공
  - Backend-fast: Rust `cargo check` 성공
  - Backend-core: JDK 26 환경에서 Gradle `classes` 성공
  - Mobile: JDK 26 환경에서 Android Gradle `compileDebugSources` 성공
  - Orchestrator: TypeScript build 및 mock orchestration demo 성공
- 최종 로그 기준: `ALL CHECKS PASSED SUCCESSFULLY`
- API 비용: 없음. `.skills/verify-all.ps1`은 로컬 검증만 수행하며 OpenAI API를 호출하지 않음
- 참고: 콘솔의 일부 한글 깨짐은 PowerShell 출력 인코딩 문제로 보이며, 검증 실패는 아님

다음 추천 작업:

- 운영 배포 도메인이 정해지면 모바일 release URL 주입 방식을 CI/CD 또는 ArgoCD/Kubernetes Secret 기준으로 문서화
- Rust/Object Storage 업로드 계약 정리
- 보일러플레이트 분리 전, 현재 파이프라인 성공 기준을 재사용 템플릿 문서에 반영

## 2026-06-11 보일러플레이트 복사 리허설 통과

- 대상: `D:\개발\boilertest`
- 실행 명령:
  - `npm run project:package -- --target D:\개발\boilertest --name "Boiler Test" --goal "Reusable orchestrator boilerplate rehearsal" --force`
  - 대상 복사본에서 `npm install`
  - 대상 복사본에서 `npm run ci:dry-run`
- 패키징 결과: 79개 파일 생성, 기존 충돌 0개
- 포함 확인:
  - `orchestrator/OPERATIONS_GUIDE.md`
  - `orchestrator/BOILERPLATE_SPLIT_GUIDE.md`
  - `runner:full:safe`
  - `runner:workflow:reuse`
- 설치 결과: `npm install` 성공, `found 0 vulnerabilities`
- dry-run 결과: `runner:full:mock` + test worker provider 성공
- API 비용: 없음. `ci:dry-run`은 mock/test provider 기반으로 실행됨
- 결론: 현재 오케스트레이터 보일러플레이트는 새 폴더에 복사, 설치, mock dry-run까지 독립 실행 가능함

## 2026-06-11 frontend 작은 기능 리허설 및 실제 적용

- 리허설 run: `run-2026-06-11T13-28-40-485Z`
- 요청: 로그인 화면 하단에 `베타 기간에는 일부 로그인이 지연될 수 있습니다.` 안내 문구 추가
- 리허설 결과:
  - `Status: succeeded`
  - `Workers: succeeded=1`
  - `Applied roles: frontend`
  - `Changed files recorded: 2`
  - `Proposed edits: 2`
  - `Verification: passed (.skills/verify-web.ps1)`
  - `Rollback: succeeded`
  - `runner:workflow: exit=0`
  - API cost: `$0.0685`
- 실제 적용:
  - 리허설 의도를 기준으로 `web/src/components/Login.tsx`와 `web/src/components/Login.module.css`에 최소 변경 적용
  - 리허설 diff에 포함된 깨진 한글과 불필요한 CSS 주석은 그대로 적용하지 않고 정상 한글 문구와 CSS만 반영
- 검증: `.skills/verify-web.ps1` 통과
- 결론: 실제 frontend 변경, 검증, 롤백 리허설, 실제 적용까지 운영 흐름이 동작함

## 2026-06-11 보일러플레이트 패키지 자동 검증 명령 추가

- 추가 명령: `npm run project:validate-package -- --target <project-root>`
- 검증 항목:
  - 필수 보일러 파일 존재
  - 정책 문서와 `.skills` 템플릿 존재
  - 비용 절감 alias 존재
  - secret/status/runs 등 패키징 제외 대상 확인
- 운영 보정:
  - `node_modules`, `runs`, `dist`는 `npm install`, build, `ci:dry-run` 이후 생길 수 있어 실패가 아닌 warning으로 처리
- 리허설:
  - `D:\개발\boilertest` 대상 `project:package --force` 성공
  - `project:validate-package` 성공
  - 복사본 `npm run ci:dry-run` 성공
  - API cost: `$0.0000`

## 2026-06-11 worker 결과 재사용 안전 가드 강화

- 대상: `--reuse-worker-results`
- 보강 내용:
  - 같은 `run-id` 내부 worker result만 재사용
  - `meta/reuse-guard.json`에 Git HEAD와 worktree status 저장
  - 재사용 시 현재 Git HEAD 또는 worktree status가 달라지면 차단
  - `pending`, `running`, 일반 `failed` result 재사용 차단
  - verification/apply-review 재시도 가능한 실패만 기존 `proposedEdits`로 재사용 허용
  - `contractsChanged` 또는 `questions`가 있으면 명시 승인 옵션 없이는 재사용 apply 차단
  - unsafe proposed edit path 차단
- 검증:
  - mock/test provider 기반 reuse smoke test 성공
  - 임시 untracked 파일 추가 후 reuse 시도 시 repository state 변경으로 차단 확인
  - `npx tsc -p tsconfig.json --noEmit` 통과
- API 비용: 없음. mock/test provider와 로컬 타입 검증만 사용

## 2026-06-12 API 비용 리포트 분해 표시 개선

- 대상: `runner:workflow`, `runner:collect`, `runner:finalize`, Markdown/HTML report
- 보강 내용:
  - `worker` 단계와 `apply` 단계의 추정 비용을 분리 표시
  - `frontend`, `java`, `rust`, `mobile` 역할별 추정 비용 표시
  - `report.md`에 `API Cost Breakdown` 섹션 추가
  - `report.html`에 `worker cost`, `apply cost`, `Cost by stage and role` 표 추가
  - `runner:collect` 출력에 `by_stage`, `by_role` 비용 요약 추가
- 사용자가 봐야 할 위치:
  - 터미널에서는 마지막 `Final Summary`의 `API cost`와 `API cost by role`
  - 자세한 내역은 `runs/<run-id>/report.md` 또는 `runs/<run-id>/report.html`
- 검증:
  - `npx tsc -p tsconfig.json --noEmit` 통과
  - 기존 run `run-2026-06-11T13-28-40-485Z` 대상으로 `runner:collect --compact` 확인
  - 같은 run 대상으로 `runner:finalize --compact` 확인
- API 비용: 없음. 기존 저장된 usage metadata와 로컬 타입 검증만 사용

## 2026-06-12 API 비용 한도 가드 추가

- 대상: `runner:workflow`, `runner:full`
- 추가 옵션:
  - `--max-cost-usd <amount>`
  - `RUNNER_MAX_COST_USD` 환경변수
- 동작:
  - apply review, apply preparation, apply run 직전에 현재까지 기록된 OpenAI API 추정 비용 확인
  - 한도를 초과하면 추가 apply를 실행하지 않고 workflow를 실패 상태로 종료
  - `--rollback-after-verify`가 켜져 있으면 기존 rollback 경로 유지
- 출력:
  - workflow 헤더에 `Max API cost: $...` 표시
  - `Final Summary`의 `API cost`는 기존 총액 요약 형식 유지
  - 상세 비용 분해는 `report.md` / `report.html`에서 확인
- 검증:
  - `npx tsc -p tsconfig.json --noEmit` 통과
  - `runner:full:mock --compact --roles frontend --worker-provider test --max-cost-usd 0.01`로 옵션 전달 및 헤더 출력 확인
- API 비용: 없음. mock/test provider와 로컬 타입 검증만 사용

## 2026-06-12 runner 사전 점검 명령 추가

- 추가 명령: `npm run runner:doctor -- --compact`
- 목적:
  - 오케스트레이션 실행 전에 로컬 환경과 필수 파일이 준비되어 있는지 빠르게 확인
  - OpenAI API 호출 전에 깨질 가능성이 높은 설정 누락을 먼저 발견
- 점검 항목:
  - Node/npm/git 사용 가능 여부
  - Git worktree 상태
  - 필수 package script 존재 여부
  - `AGENTS.md`, `.skills/verify-*.ps1`, 운영 문서, 보일러플레이트 템플릿 존재 여부
- 결과:
  - `ok`: 바로 진행 가능
  - `warning`: 진행은 가능하지만 확인 필요
  - `failed`: 필수 요소 누락으로 진행 전 수정 필요
- API 비용: 없음. 로컬 파일/명령 점검만 수행

## 2026-06-12 runner doctor 보일러플레이트 검증 연결

- 대상: 패키징/보일러플레이트 리허설 경로
- 보강 내용:
  - `project:validate-package`가 `orchestrator/src/runnerDoctor.ts` 파일 존재 여부 확인
  - `project:validate-package`가 `runner:doctor` package script 존재 여부 확인
  - `ci:dry-run` 시작 단계에 `runner:doctor --compact` 실행 추가
  - `project:package` 완료 안내에 target orchestrator에서 `runner:doctor --compact`를 먼저 실행하도록 추가
  - `runner:doctor` 자체도 `runner:doctor` script 존재 여부를 검사
- 검증:
  - `npx tsc -p tsconfig.json --noEmit` 통과
  - `npm run runner:doctor -- --compact` 통과. 현재 작업 중 변경사항 때문에 `git clean`만 warning
  - `npm run ci:dry-run` 통과
  - `CreatorTemp` 아래 임시 패키지 대상에 `project:package` 실행 후 `project:validate-package` 통과
- API 비용: 없음. mock/test provider와 로컬 검증만 사용

## 2026-06-12 runner doctor 보일러플레이트 초기 상태 보정

- 보정 내용:
  - Git 저장소가 아직 초기화되지 않은 복사본에서는 `git worktree`를 실패가 아닌 warning으로 처리
  - `--strict` 옵션 추가. warning도 실패로 다루고 싶을 때 사용
  - `PIPELINE_STATUS.md`는 패키징에서 의도적으로 제외되므로 doctor에서 optional warning으로 처리
  - `project:package` 완료 안내에 Git 초기화 전 warning이 정상일 수 있음을 명시
- 이유:
  - 보일러플레이트 복사 직후에는 아직 `.git`이 없을 수 있음
  - `PIPELINE_STATUS.md`는 현재 프로젝트 운영 이력이라 재사용 패키지에는 포함하지 않는 것이 맞음
  - 실제 apply workflow 전에는 대상 프로젝트에서 `git init`과 첫 커밋을 완료하는 것이 안전함
- API 비용: 없음. 로컬 검증만 사용

## 2026-06-12 보일러플레이트 복사 리허설 명령 추가

- 추가 명령: `npm run project:rehearse-package`
- 목적:
  - 임시 폴더에 reusable orchestrator package를 생성
  - `project:validate-package`까지 자동 실행
  - 기본 실행 후 임시 폴더 삭제
  - `--keep` 사용 시 임시 폴더 보존
- 보강 내용:
  - `project:rehearse-package` package script 추가
  - `projectValidatePackage`와 `runnerDoctor`의 필수 script 목록에 추가
  - `projectRehearsePackage.ts` 추가
  - `PACKAGING.md`, `OPERATIONS_GUIDE.md`, `BOILERPLATE_MIGRATION_CHECKLIST.md`에 사용법 반영
- 검증:
  - `npx tsc -p tsconfig.json --noEmit` 통과
  - `npm run runner:doctor -- --compact` 통과. 현재 작업 중 변경사항 때문에 `git clean`만 warning
  - `npm run project:rehearse-package` 통과
- API 비용: 없음. 로컬 패키징/검증만 사용

## 2026-06-12 보일러플레이트 복사본 자체 ci 리허설 통과

- 대상: `project:rehearse-package --keep`로 생성한 보존 복사본
- 복사본 위치:
  - `C:\Users\Public\Documents\ESTsoft\CreatorTemp\orchestrator-package-rehearsal-2026-06-12T13-22-05-213Z`
- 보정 내용:
  - 당시 리허설 기본 임시 경로를 Codex에서 접근 가능한 `C:\Users\Public\Documents\ESTsoft\CreatorTemp`로 변경
  - 이후 2026-06-13부터 기본 리허설 경로는 `D:\개발\boilerplate-test`로 전환
  - Git 저장소가 아닌 복사본 dry-run에서는 reuse guard 생성을 fatal error가 아닌 설명형 warning으로 처리
- 검증:
  - 복사본 `npm install` 성공
  - 복사본 `npm audit` 결과 `found 0 vulnerabilities`
  - 복사본 `npm run runner:doctor -- --compact` warning-only 통과
  - 복사본 `npm run ci:dry-run` 통과
  - `runner:workflow exit=0`
  - `API cost: estimated_usd=$0.0000`
- 남는 warning:
  - `git worktree` warning: 복사 직후 아직 `git init` 전이므로 정상
  - `PIPELINE_STATUS.md` missing warning: 패키징에서 의도적으로 제외하므로 정상
- API 비용: 없음. test provider와 로컬 검증만 사용

## 2026-06-13 보일러플레이트 리허설 기본 경로 D 드라이브 전환

- 변경 이유:
  - 리허설과 테스트 산출물을 가능하면 C 드라이브가 아닌 D 드라이브에 보관하기 위함
  - Codex/로컬 테스트가 만든 임시 복사본을 사용자가 찾고 정리하기 쉽도록 하기 위함
- 변경 내용:
  - `project:rehearse-package` 기본 대상 루트를 `D:\개발\boilerplate-test`로 변경
  - 필요 시 `ORCHESTRATOR_REHEARSAL_ROOT` 환경변수나 `--target` 옵션으로 리허설 위치를 덮어쓸 수 있음
  - 기존 C 드라이브 `CreatorTemp` 리허설 복사본은 정리 대상
- 기대 동작:
  - 기본 실행: `D:\개발\boilerplate-test\orchestrator-package-rehearsal-*` 생성 후 검증, 기본적으로 삭제
  - `--keep` 실행: 같은 D 드라이브 경로에 복사본 보존

## 2026-06-13 D 드라이브 보일러플레이트 복사본 자체 CI 리허설 통과

- 대상:
  - `D:\개발\boilerplate-test\orchestrator-package-rehearsal-2026-06-13T11-57-00-360Z`
- 확인 내용:
  - `project:rehearse-package --keep`로 D 드라이브에 복사본 생성 성공
  - `project:validate-package` 통과
  - 복사본 `npm install` 성공
  - 복사본 `npm audit` 결과 `found 0 vulnerabilities`
  - 복사본 `npm run ci:dry-run` 통과
  - mock workflow 결과 `Workers: succeeded=4`, `runner:workflow exit=0`
  - API 비용: `$0.0000`
- 보정 내용:
  - 최초 실행에서 `D:\개발\boilerplate-test` 루트가 없으면 `os.tmpdir()`로 fallback되어 C 드라이브에 생성되는 문제가 확인됨
  - `project:rehearse-package`가 기본 리허설 루트를 직접 생성하도록 수정하여 C 드라이브 fallback을 제거
  - `npm audit`에서 원본 lockfile의 `esbuild 0.28.0` high 취약점이 발견되어 `npm audit fix`로 `esbuild 0.28.1`로 갱신
- 정리:
  - 테스트 복사본은 삭제 완료
  - `D:\개발\boilerplate-test` 루트 폴더만 유지
- 남는 warning:
  - `git worktree` warning: 복사 직후 아직 `git init` 전이므로 정상
  - `PIPELINE_STATUS.md` missing warning: 보일러플레이트 패키지에서 의도적으로 제외하므로 정상

## 2026-06-13 sample-project-1 새 프로젝트 초기화 리허설 통과

- 대상:
  - `D:\개발\boilerplate-test\sample-project-1`
- 목적:
  - 보일러플레이트 복사본을 실제 새 프로젝트처럼 초기화할 수 있는지 확인
  - 복사 직후 Git 초기화, 첫 커밋, project init, strict doctor, dry-run이 이어서 동작하는지 검증
- 실행 순서:
  - `project:package --target D:\개발\boilerplate-test\sample-project-1 --force`
  - 복사본 `npm install`
  - 복사본 `npm audit`
  - 루트 `.gitignore` 생성
  - 복사본 `git init`
  - 첫 커밋: `Initial orchestrator boilerplate rehearsal`
  - 복사본 `npm run project:init -- --name "Sample Project 1" --goal "Reusable orchestrator boilerplate initialization rehearsal" --force`
  - 복사본 `npm run runner:doctor -- --compact --strict`
  - 복사본 `npm run ci:dry-run`
- 결과:
  - `npm install` 성공
  - `npm audit` 결과 `found 0 vulnerabilities`
  - 첫 커밋 성공
  - `runner:doctor --strict` 결과 `Status: ok`, `warn=0`, `fail=0`
  - `ci:dry-run` 결과 `Status: succeeded`, `Workers: succeeded=4`
  - `API cost: estimated_usd=$0.0000`
  - sample project Git 상태 깨끗함
- 리허설 중 발견 및 보정:
  - `npm install` 후 루트에서 `git add .`를 실행하면 `node_modules`까지 stage하려고 하면서 오래 걸릴 수 있음
  - 새 프로젝트 초기화 전 루트 `.gitignore`를 먼저 만들고 `node_modules/`, `runs/`, `dist/`, `.env`, `.env.local`을 제외해야 함
  - `project:init`과 `runner:doctor`는 루트가 아니라 `orchestrator` 폴더에서 실행해야 함
  - 보일러플레이트 복사본에서는 `PIPELINE_STATUS.md`가 의도적으로 없으므로 `runner:doctor --strict`에서도 optional missing으로 처리하도록 보정

## 2026-06-13 실사용 runner alias 정리

- 추가 alias:
  - `runner:plan`: 계획과 worker 제안만 확인
  - `runner:rehearse`: apply, verification, rollback을 한 번에 수행하는 안전 리허설
  - `runner:apply`: apply 후 변경을 유지하는 실제 적용
  - `runner:reuse-apply`: 기존 run의 worker 결과를 재사용해 apply만 다시 시도
- 목적:
  - 긴 `runner:full`/`runner:workflow` 옵션 조합을 매번 외우지 않아도 되게 함
  - 기본 사용 흐름을 plan, rehearse, apply, reuse-apply 네 단계로 단순화
  - 기존 `runner:full:safe`, `runner:full:balanced`, `runner:workflow:*` alias는 호환/고급 옵션으로 유지
- 보정:
  - `runner:doctor`와 `project:validate-package`의 필수 script 목록에 새 alias를 포함
  - `OPERATIONS_GUIDE.md`와 `README.md`에 빠른 사용 예시 추가

## 2026-06-13 Final Summary 다음 행동 안내 추가

- 변경 내용:
  - `runner:workflow`의 `Final Summary`에 `Next action` 블록 추가
  - 성공했지만 apply가 없을 때는 `runner:rehearse` 또는 `runner:apply`로 이어가도록 안내
  - rollback 리허설이 성공했을 때는 같은 run의 worker 결과를 재사용해 `--keep-applied`로 유지하는 명령을 안내
  - blocked 상태에서는 report 확인 후 open question 또는 contract change 승인 여부를 판단하도록 안내
  - failed 상태에서는 report 확인과 worker 결과 재사용 재시도 가능성을 안내
- 검증:
  - `npx tsc -p tsconfig.json --noEmit` 통과
  - `runner:full:mock --compact --roles frontend,java,rust,mobile --worker-provider test "auth flow check"` 통과
  - `Final Summary`에 `Next action` 출력 확인

## 2026-06-13 runner continue 추천 명령 추가

- 추가 명령:
  - `npm run runner:continue -- <run-id>`
- 목적:
  - 기존 run의 worker 결과와 상태를 읽고 다음에 실행할 명령을 추천
  - `/goal`형 자동 반복으로 가기 전, 안전한 수동-반자동 연결 단계 제공
- 현재 동작:
  - 파일 수정 없음
  - worker/API 호출 없음
  - blocked, failed, editable succeeded, review-only 상태를 기준으로 다음 행동 안내
  - proposed edits가 있으면 `runner:reuse-apply`를 추천해 worker 토큰 재사용 가능
- 향후 확장:
  - 충분히 검증되면 `--execute` 옵션을 추가해 추천 명령을 실제 실행하는 자동 continue 단계로 확장 가능

## 2026-06-13 runner continue 선택지 안내 강화

- 변경 내용:
  - blocked 상태에서 승인 진행과 새 요청 재계획을 `Option A/B/C`로 분리
  - failed 상태에서 상세 확인, worker 결과 재사용 재시도, 새 요청 재계획을 분리
  - editable succeeded 상태에서 안전 리허설, keep-applied, 새 요청 재계획을 분리
  - open question과 contract change 여부에 따라 `--approve-open-questions`, `--approve-contract-changes` 플래그를 추천 명령에 자동 포함
- 목적:
  - 위험한 변경을 자동 승인하지 않고, 사용자가 명시적으로 승인 또는 재계획을 선택하도록 유도
  - 향후 `runner:continue --execute` 또는 제한형 `runner:goal`로 확장하기 전 안전한 의사결정 규칙을 먼저 정리
- 검증:
  - `npx tsc -p tsconfig.json --noEmit` 통과
  - 기존 mock run 대상 `runner:continue` 출력 확인

## 2026-06-13 runner plan mock alias 추가

- 추가 alias:
  - `npm run runner:plan:mock -- --roles <roles> "<request>"`
- 목적:
  - OpenAI API 비용 없이 plan/worker 흐름을 빠르게 점검
  - `runner:plan`의 실제 OpenAI 기본값과 테스트용 mock 흐름을 명확히 분리
- 결정:
  - `runner:rehearse:mock`은 mock proposed edits를 실제 apply로 넘겨 혼란을 만들 수 있어 추가하지 않음
  - apply 없는 plan 흐름 테스트는 `runner:plan:mock`, 전체 파이프라인 mock 검증은 기존 `ci:dry-run`을 사용

## 2026-06-14 runner continue 선택 실행 옵션 추가

- 추가:
  - `npm run runner:continue -- <run-id> --choose A|B|C`
  - `npm run runner:continue -- <run-id> --choose A|B|C --execute`
- 목적:
  - 추천된 Option A/B/C 중 무엇을 선택했는지 명확히 표시
  - 기본은 preview-only로 유지하고, `--execute`가 있을 때만 실제 명령 실행
  - 실행 가능한 옵션은 내부 `tsx` 스크립트로 호출해 Windows npm 인자/따옴표 문제 완화
- 안전 규칙:
  - Option C처럼 새 요청이 필요한 수동 결정은 실행 불가
  - keep-applied 옵션은 사용자가 명시적으로 `--choose B --execute`를 입력해야만 실행
- 검증:
  - `npx tsc -p tsconfig.json --noEmit`
  - `npm run runner:continue -- run-2026-06-13T13-45-14-468Z`
  - `npm run runner:continue -- run-2026-06-13T13-45-14-468Z --choose B`

## 2026-06-14 Final Summary continue 안내 연결

- 변경 내용:
  - `runner:workflow`의 `Final Summary > Next action`을 `runner:continue --choose A|B|C` 흐름과 연결
  - rehearsal 성공 후 keep-applied 안내를 긴 raw workflow 명령 대신 `runner:continue --choose B --execute`로 표시
  - blocked/failed 상태에서도 먼저 `runner:continue`로 선택지를 확인하고, 필요한 경우 선택 실행하도록 안내
- 목적:
  - plan, rehearse, apply, continue 흐름의 사용자 경험 통일
  - 사용자가 긴 workflow 옵션 조합을 직접 복사하지 않아도 되게 함
  - `/goal`형 자동 진행을 만들기 전, 사람이 명시적으로 다음 선택을 확인하는 안전한 중간 단계 마련

## 2026-06-14 runner goal 안전 실행 alias 추가

- 추가 alias:
  - `runner:goal`: 목표형 요청을 plan, worker, apply rehearsal, verification, rollback까지 한 번에 수행
  - `runner:goal:mock`: 비용 없이 목표형 흐름을 점검
- 결정:
  - `runner:goal`은 기본적으로 변경을 남기지 않고 rollback한다.
  - 실제 변경 유지가 필요하면 기존대로 `runner:apply` 또는 `runner:continue --choose B --execute`를 사용한다.
  - 무한 자동 반복이나 자동 커밋은 아직 추가하지 않는다. 신뢰도와 사용자의 명시적 승인 흐름을 우선한다.
- 목적:
  - `/goal`에 가까운 사용자 경험을 제공하되, 현재 단계에서는 안전한 1회 리허설로 제한
  - 세부 옵션을 모르는 상태에서도 목표형 작업을 시작하기 쉽게 함

## 2026-06-14 runner full 실행 의도 표시 추가

- 변경 내용:
  - `runnerFull` 시작 출력에 `Run intent` 한 줄 추가
  - plan only, safe rehearsal, keep-applied 의도를 터미널 상단에서 바로 확인 가능
  - README와 운영 가이드에 `runner:goal`은 성공해도 rollback되는 안전 리허설임을 명시
- 목적:
  - `runner:goal`이 실제 파일을 남기는 명령인지 헷갈리지 않게 함
  - goal 성공 후에는 `runner:continue -- <run-id> --choose B --execute`로 같은 worker 결과를 유지 적용하도록 안내

## 2026-06-14 runner continue 선택 alias 추가

- 추가 alias:
  - `runner:continue:a`: Option A preview
  - `runner:continue:b`: Option B preview
  - `runner:continue:c`: Option C preview
  - `runner:continue:a:execute`: Option A execute
  - `runner:continue:b:execute`: Option B execute
- 변경:
  - Option C는 수동 결정이므로 실행은 불가하지만 preview는 가능하게 처리
- 목적:
  - 사용자가 A/B/C 선택을 명령 이름에서 바로 확인할 수 있게 함
  - 긴 `--choose A --execute` 조합을 반복 입력하지 않아도 되게 함

## 2026-06-14 runner status 체인 안내 추가

- 변경 내용:
  - `runner:status` 출력에 `Continue Chain` 섹션 추가
  - blocked, failed, editable succeeded 상태에 따라 `runner:continue:a`, `runner:continue:b`, `runner:continue:b:execute`, `runner:continue:c` 안내
  - 기존 긴 workflow 재실행 명령 대신 체인형 alias를 우선 표시
- 목적:
  - run id만 알고 있어도 status에서 바로 다음 행동으로 이어가게 함
  - report를 열기 전 빠른 판단 경로 제공

## 2026-06-14 runner latest alias 추가

- 추가 alias:
  - `runner:latest`: 최신 run id, 요청, 다음 명령 표시
  - `runner:latest:status`: 최신 run의 status 출력
  - `runner:latest:continue`: 최신 run의 continue 선택지 출력
- 목적:
  - 긴 run id를 매번 복사하지 않아도 최근 작업으로 바로 이어갈 수 있게 함
  - goal, status, continue 체인 사용성을 개선
- 안전 규칙:
  - latest 계열은 기본적으로 상태 확인과 선택지 출력만 수행
  - 실제 적용은 여전히 `runner:continue:b:execute -- <run-id>` 또는 명시적 continue execute alias가 필요

## 2026-06-14 runner latest 선택 alias 추가

- 추가 alias:
  - `runner:latest:a`, `runner:latest:b`, `runner:latest:c`
  - `runner:latest:a:execute`, `runner:latest:b:execute`
- 변경 내용:
  - `runnerLatest`가 최신 run id를 찾은 뒤 `runnerContinue`에 `--choose`와 `--execute`를 위임
- 목적:
  - 최신 run 기준으로 run id 복사 없이 A/B/C 체인을 바로 실행
  - 평소 흐름을 `runner:goal` -> `runner:latest:b` -> `runner:latest:b:execute`처럼 더 짧게 만듦
- 안전 규칙:
  - Option C는 preview만 제공하고 execute alias는 만들지 않음

## 2026-06-14 runner help 추가

- 추가 alias:
  - `runner:help`
- 목적:
  - goal/latest/continue 체인 명령을 한 화면에 정리
  - run id가 있을 때와 없을 때의 다음 행동을 빠르게 확인
  - 비용 없는 점검 명령과 안전 주의사항을 함께 표시

## 2026-06-14 runner latest live 기본값 적용

- 변경 내용:
  - `runner:latest` 기본 조회 대상을 live run으로 제한
  - `runner:latest:any`와 `runner:latest:mock` alias 추가
  - `runnerLatest`에 `--mode live|mock|any` 옵션 추가
- 목적:
  - `ci:dry-run`이나 mock 테스트가 최신 run이 되어 실작업 체인을 가로채는 문제 방지
  - mock run을 보고 싶을 때는 명시적으로 `runner:latest:any` 또는 `runner:latest:mock` 사용
- 안전 규칙:
  - 실제 적용 체인에 가까운 latest 기본값은 live만 대상으로 삼음

## 2026-06-15 budget runner alias 추가

- 추가 alias:
  - `runner:plan:budget`: `--max-cost-usd 0.05`, concurrency 1
  - `runner:goal:budget`: `--max-cost-usd 0.10`, concurrency 1, rollback rehearsal
- 목적:
  - 작은 요청을 비용 상한 안에서 안전하게 실행
  - 비용이 걱정될 때 기본 `runner:goal` 대신 예산형 명령을 선택 가능
- 결정:
  - 기존 `runner:goal` 기본 동작은 변경하지 않음
  - 예산 제한은 명시적인 budget alias에서만 적용

## 2026-06-15 runner full cost budget 표시 추가

- 변경 내용:
  - `runnerFull` 시작 출력에 `Cost budget` 한 줄 추가
  - `--max-cost-usd`가 없으면 `unlimited`, 있으면 `$<value>`로 표시
- 목적:
  - `runner:goal`은 기본 무제한, `runner:goal:budget`은 예산 제한이라는 차이를 터미널 상단에서 즉시 확인
  - 비용 관련 착각을 줄임

## 2026-06-15 finalized report continue chain 추가

- 변경 내용:
  - finalized `report.md`에 `Continue Chain` 섹션 추가
  - finalized `report.html`에도 같은 체인 명령 목록 표시
- 목적:
  - 터미널 `Final Summary`를 놓쳐도 report에서 바로 다음 명령을 확인
  - status, continue, rehearsal, keep-applied, reject/replan 흐름을 보고서 안에서 연결

## 2026-06-15 reports index continue chain 컬럼 추가

- 변경 내용:
  - `runner:reports`가 생성하는 `runs/index.html`에 `chain` 컬럼 추가
  - 각 run 행에서 `runner:status -- <run-id>`와 `runner:continue -- <run-id>` 명령을 바로 확인 가능
- 목적:
  - 여러 run을 훑다가 report를 열기 전에도 다음 체인 명령을 복사할 수 있게 함
  - finalized report의 `Continue Chain` 섹션과 run index를 연결

## 2026-06-15 reports index mode filter 추가

- 변경 내용:
  - `runner:reports`에 `--mode live|mock|any` 옵션 추가
  - `runner:reports:any`, `runner:reports:live`, `runner:reports:mock` alias 추가
  - `runs/index.html` 헤더에 현재 mode filter 표시
- 목적:
  - 실제 실행(live) 기록과 mock/CI 리허설 기록을 분리해서 확인
  - `runner:latest`의 live 기본값과 리포트 인덱스 조회 방식을 맞춤
- 안전 규칙:
  - 기본 `runner:reports`는 기존처럼 전체(any)를 유지
  - 특정 모드만 보고 싶을 때만 명시적 alias를 사용

## 2026-06-15 runner help reports 안내 추가

- 변경 내용:
  - `runner:help`에 `Reports` 섹션 추가
  - `runner:reports`, `runner:reports:live`, `runner:reports:mock` 사용 목적을 표시
- 목적:
  - run id 체인뿐 아니라 여러 실행 결과를 한 화면에서 훑는 경로도 help에서 바로 찾게 함
  - reports mode filter 추가 사항을 실제 사용 명령 안내와 연결
