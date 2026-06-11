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
