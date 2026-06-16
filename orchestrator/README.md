# Whiteboard Capture Orchestrator

현재 파이프라인 완료 상태와 실사용 명령은 [PIPELINE_STATUS.md](./PIPELINE_STATUS.md)를 참고합니다.

이 디렉토리는 Whiteboard Capture 프로젝트용 오케스트레이션 실험 공간입니다.

현재 목표는 다음 흐름을 만드는 것입니다.

1. `master`가 사용자 요청을 받음
2. 요청을 카테고리별 정책으로 분류함
3. `frontend / rust / java / mobile` worker용 작업 패킷을 만듦
4. `verifier`가 계획과 패킷을 검토함
5. 이후 실제 CLI worker가 작업을 수행하고 결과를 반환함

지금은 이 중에서 `master -> plan -> task packet -> verifier -> file-based runner bundle`까지 완료된 상태입니다.

## 현재 구조

오케스트레이터는 LangGraph 기반으로 구성되어 있습니다.

- `manager`
- `frontend`
- `rust`
- `java`
- `mobile`
- `task-packets`
- `verifier`
- `merge`

즉, 현재 그래프 흐름은 아래와 같습니다.

```text
manager
  -> frontend
  -> rust
  -> java
  -> mobile
  -> task-packets
  -> verifier
  -> merge
```

## 주요 개념

### 1. 카테고리 정책

사용자 요청은 현재 아래 카테고리로 분류됩니다.

- `auth`
- `design`
- `redis`
- `realtime`

각 카테고리는 모듈별 최소 참여 수준을 강제합니다.

예:

- `auth`
  - java: `implement`
  - rust: 최소 `review`
  - frontend: 최소 `implement`
  - mobile: 요청 범위에 따라 `skip/review/implement`

- `redis`
  - 기본: java `implement`, rust `review`
  - `upload hot path`, `websocket`, `fan-out`, `realtime` 문맥 포함 시 rust도 `implement`

- `realtime`
  - rust: `implement`
  - frontend: `implement`
  - java: 최소 `review`

### 2. 템플릿 레지스트리

카테고리별 설명/계약/검토 포인트는 코드에 하드코딩된 긴 문장 대신 템플릿 레지스트리에서 관리합니다.

관련 파일:

- [templateRegistry.ts](</D:/개발/whiteboard capture/orchestrator/src/templateRegistry.ts>)

결과 보고서 상단에는 사람이 빠르게 읽을 수 있도록 YAML 형태의 `Applied Templates` 섹션이 출력됩니다.

### 3. Worker Task Packet

worker가 실제로 받아야 하는 입력 형식입니다.

포함 필드:

- `role`
- `participationMode`
- `goal`
- `allowedPaths`
- `blockedPaths`
- `touchedAreas`
- `implementationSteps`
- `dependencies`
- `requiredVerification`
- `contracts`
- `handoffOutput`

관련 파일:

- [taskSchemas.ts](</D:/개발/whiteboard capture/orchestrator/src/taskSchemas.ts>)

### 4. Worker Result Packet

worker가 작업 후 master에게 반환해야 하는 출력 형식입니다.

포함 필드:

- `status`
- `changedFiles`
- `summary`
- `contractsChanged`
- `verificationRun`
- `risks`
- `questions`

관련 파일:

- [resultSchemas.ts](</D:/개발/whiteboard capture/orchestrator/src/resultSchemas.ts>)

### 5. Verifier

`verifier`는 아래를 검토합니다.

- manager 결정
- specialist plan
- worker task packet
- worker result packet

집중 포인트:

- 계약 충돌
- 검증 누락
- 숨은 리스크
- 릴리즈 블로커
- worker packet이 실제 실행 가능한지 여부

## 현재 생성되는 산출물

`runner:prepare`를 실행하면 아래 구조가 생성됩니다.

```text
orchestrator/runs/<run-id>/
  report.md
  tasks/
    frontend.task.json
    rust.task.json
    java.task.json
    mobile.task.json
  results/
    frontend.result.json
    rust.result.json
    java.result.json
    mobile.result.json
  workers/
    frontend.prompt.md
    rust.prompt.md
    java.prompt.md
    mobile.prompt.md
  meta/
    manifest.json
    summary.json
```

설명:

- `tasks/*.task.json`
  - worker 입력 패킷
- `results/*.result.json`
  - worker 출력 패킷
- `workers/*.prompt.md`
  - CLI worker에게 넘길 프롬프트 파일
- `report.md`
  - 사람이 읽는 전체 오케스트레이션 보고서
- `meta/manifest.json`
  - run 메타데이터

## 현재 사용 가능한 명령

### 0. 실사용 기본 alias

대부분의 작업은 아래 alias 중 하나로 시작합니다. 가장 짧은 확인 흐름은 `runner:goal`로 리허설한 뒤 `runner:quick`으로 최신 run 상태와 다음 선택지를 보는 것입니다.

```powershell
cd orchestrator

# 가장 짧은 실사용 체인
"C:\Program Files\nodejs\npm.cmd" run runner:goal -- --roles frontend "요청 내용"
"C:\Program Files\nodejs\npm.cmd" run runner:quick
"C:\Program Files\nodejs\npm.cmd" run runner:accept

# 계획과 worker 제안만 확인
"C:\Program Files\nodejs\npm.cmd" run runner:plan -- --roles frontend,java "요청 내용"

# 비용 없이 plan/worker 흐름만 점검
"C:\Program Files\nodejs\npm.cmd" run runner:plan:mock -- --roles frontend,java "요청 내용"

# 목표형 안전 실행: 적용 가능성 검증 후 자동 롤백
"C:\Program Files\nodejs\npm.cmd" run runner:goal -- --roles frontend "요청 내용"

`runner:goal`은 안전 리허설입니다. 성공해도 파일 변경은 롤백되며, 결과가 마음에 들면 `runner:quick`으로 최신 run을 확인한 뒤 `runner:accept`로 같은 worker 결과를 실제 적용합니다.

# 예산 제한이 필요한 안전 실행
"C:\Program Files\nodejs\npm.cmd" run runner:goal:budget -- --roles frontend "요청 내용"

# 비용 없이 목표형 흐름 점검
"C:\Program Files\nodejs\npm.cmd" run runner:goal:mock -- --roles frontend,java "요청 내용"

# 적용 가능성을 검증하고 자동 롤백
"C:\Program Files\nodejs\npm.cmd" run runner:rehearse -- --roles frontend "요청 내용"

# 실제 변경을 남김
"C:\Program Files\nodejs\npm.cmd" run runner:apply -- --roles frontend "요청 내용"

# 기존 run의 worker 결과를 재사용해 apply만 다시 시도
"C:\Program Files\nodejs\npm.cmd" run runner:reuse-apply -- <run-id> --roles mobile

# 적용된 변경의 로컬 품질 게이트만 확인
"C:\Program Files\nodejs\npm.cmd" run runner:quality -- <run-id> --roles frontend

# 품질 게이트가 나쁜 패턴을 실제로 차단하는지 비용 없이 확인
"C:\Program Files\nodejs\npm.cmd" run runner:quality:smoke

# workflow가 품질 게이트 실패를 차단하고 롤백하는지 비용 없이 확인
"C:\Program Files\nodejs\npm.cmd" run runner:workflow:quality-smoke

# 기존 run에서 다음 행동 추천만 확인
"C:\Program Files\nodejs\npm.cmd" run runner:continue -- <run-id>

# 기존 run에서 다음 행동 추천만 짧게 확인
"C:\Program Files\nodejs\npm.cmd" run runner:continue:compact -- <run-id>

# 기존 run의 핵심 요약만 한 화면으로 확인
"C:\Program Files\nodejs\npm.cmd" run runner:status:compact -- <run-id>

# 추천 옵션을 명시적으로 미리보기
"C:\Program Files\nodejs\npm.cmd" run runner:continue -- <run-id> --choose A

# 추천 옵션 실행
"C:\Program Files\nodejs\npm.cmd" run runner:continue -- <run-id> --choose A --execute

# 같은 의미의 짧은 alias
"C:\Program Files\nodejs\npm.cmd" run runner:continue:a -- <run-id>
"C:\Program Files\nodejs\npm.cmd" run runner:continue:b:execute -- <run-id>

# 최신 run 기준으로 바로 확인
"C:\Program Files\nodejs\npm.cmd" run runner:quick
"C:\Program Files\nodejs\npm.cmd" run runner:quick:any
"C:\Program Files\nodejs\npm.cmd" run runner:quick:mock
"C:\Program Files\nodejs\npm.cmd" run runner:latest
"C:\Program Files\nodejs\npm.cmd" run runner:latest:quick
"C:\Program Files\nodejs\npm.cmd" run runner:latest:any
"C:\Program Files\nodejs\npm.cmd" run runner:latest:status
"C:\Program Files\nodejs\npm.cmd" run runner:latest:status:compact
"C:\Program Files\nodejs\npm.cmd" run runner:latest:continue
"C:\Program Files\nodejs\npm.cmd" run runner:latest:continue:compact
"C:\Program Files\nodejs\npm.cmd" run runner:latest:b
"C:\Program Files\nodejs\npm.cmd" run runner:accept:preview
"C:\Program Files\nodejs\npm.cmd" run runner:accept

# 여러 run 리포트 인덱스 생성
"C:\Program Files\nodejs\npm.cmd" run runner:reports
"C:\Program Files\nodejs\npm.cmd" run runner:reports:live
"C:\Program Files\nodejs\npm.cmd" run runner:reports:mock

# 명령이 헷갈릴 때
"C:\Program Files\nodejs\npm.cmd" run runner:help
```

### 1. 일반 오케스트레이션 보기

```powershell
cd orchestrator
"C:\Program Files\nodejs\npm.cmd" run demo -- "네이버 로그인 기능을 만들어줘"
```

mock 모드:

```powershell
cd orchestrator
"C:\Program Files\nodejs\npm.cmd" run demo:mock -- "네이버 로그인 기능을 만들어줘"
```

### 2. runner bundle 만들기

```powershell
cd orchestrator
"C:\Program Files\nodejs\npm.cmd" run runner:prepare -- "네이버 로그인 기능을 만들어줘"
```

mock 모드:

```powershell
cd orchestrator
"C:\Program Files\nodejs\npm.cmd" run runner:prepare:mock -- "네이버 로그인 기능을 만들어줘"
```

### 3. run 상태 보기

```powershell
cd orchestrator
"C:\Program Files\nodejs\npm.cmd" run runner:status -- <run-id>
```

### 4. worker prompt 준비

```powershell
cd orchestrator
"C:\Program Files\nodejs\npm.cmd" run worker:prepare -- <run-id> java
```

가능한 role:

- `frontend`
- `rust`
- `java`
- `mobile`

### 5. worker 실제 실행 시도

현재 지원 provider:

- `claude`
- `manual`

예:

```powershell
cd orchestrator
"C:\Program Files\nodejs\npm.cmd" run worker:run -- <run-id> java
```

수동 준비만 하고 싶다면:

```powershell
cd orchestrator
"C:\Program Files\nodejs\npm.cmd" run worker:run -- <run-id> java --provider manual
```

### 6. worker 결과 수집

```powershell
cd orchestrator
"C:\Program Files\nodejs\npm.cmd" run runner:collect -- <run-id>
```

## CLI Worker Runner 상태

현재 `worker:run`은 다음까지 구현되어 있습니다.

1. `task.json` 읽기
2. `prompt.md` 생성
3. `claude` CLI를 JSON schema 기반으로 호출
4. 성공 시 `result.json` 갱신
5. 실패 시에도 `result.json`에 실패 내용 기록

즉, 완전한 자동 실행기라기보다는 **실제 실행 가능한 초안** 상태입니다.

## 현재까지 완료된 것

- LangGraph master/planner 구조
- 카테고리 정책 엔진
- 템플릿 레지스트리
- YAML 기반 applied templates 출력
- specialist plan 생성
- verifier 단계 추가
- worker task/result packet 스키마
- file-based runner bundle
- CLI worker prompt 생성기
- CLI worker 실행 초안

## 아직 미완성인 것

아래는 아직 완성되지 않았습니다.

1. `master가 worker를 자동으로 순차/병렬 실행`
2. `worker 결과를 다시 graph에 주입해 최종 보고서를 자동 재생성`
3. `provider 다중 지원`
   - 현재는 실질적으로 `claude` 중심
4. `worker별 git worktree 분리`
5. `충돌 해결 및 merge 전략`
6. `verifier의 룰 기반 정적 검사 강화`

## 권장 다음 단계

가장 자연스러운 다음 단계는 아래입니다.

1. `runner:execute` 추가
   - master가 worker들을 순서대로 또는 병렬로 자동 실행

2. `result reinjection`
   - worker 결과를 다시 verifier와 merge 단계에 넣어 최종 보고서를 갱신

3. `verifier rules`
   - 중복 touched areas
   - blocked path 침범
   - verification 누락
   - 계약 충돌
   자동 감지

## 관련 파일

- [graph.ts](</D:/개발/whiteboard capture/orchestrator/src/graph.ts>)
- [schemas.ts](</D:/개발/whiteboard capture/orchestrator/src/schemas.ts>)
- [taskSchemas.ts](</D:/개발/whiteboard capture/orchestrator/src/taskSchemas.ts>)
- [resultSchemas.ts](</D:/개발/whiteboard capture/orchestrator/src/resultSchemas.ts>)
- [templateRegistry.ts](</D:/개발/whiteboard capture/orchestrator/src/templateRegistry.ts>)
- [packetStore.ts](</D:/개발/whiteboard capture/orchestrator/src/packetStore.ts>)
- [prepareRunner.ts](</D:/개발/whiteboard capture/orchestrator/src/prepareRunner.ts>)
- [runnerStatus.ts](</D:/개발/whiteboard capture/orchestrator/src/runnerStatus.ts>)
- [workerExecutor.ts](</D:/개발/whiteboard capture/orchestrator/src/workerExecutor.ts>)
- [workerRun.ts](</D:/개발/whiteboard capture/orchestrator/src/workerRun.ts>)
- [collectResults.ts](</D:/개발/whiteboard capture/orchestrator/src/collectResults.ts>)
