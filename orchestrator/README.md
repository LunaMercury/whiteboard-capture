# Whiteboard Capture LangGraph 오케스트레이터

이 폴더는 Whiteboard Capture 저장소 전용으로 만든 첫 번째 LangGraph 기반 멀티 에이전트 오케스트레이터입니다.

## 이 오케스트레이터가 하는 일

이 오케스트레이터는 총괄 매니저처럼 동작하면서 사용자 요청을 프로젝트 전담 specialist로 분배합니다.

- frontend: `web/**`
- rust: `backend-fast/**`
- java: `backend-core/**`
- mobile: `mobile/**`

아직 실제 파일을 수정하지는 않습니다. 대신 어떤 모듈이 영향을 받는지, 어디를 수정해야 하는지, 무엇을 검증해야 하는지, 어떤 통합 리스크가 있는지를 계획 형태로 출력합니다.

## 이 프로젝트에 잘 맞는 이유

이 저장소는 이미 모듈 경계가 분명하고, `.skills` 검증 스크립트도 나뉘어 있습니다. 그래서 LangGraph로 총괄 agent와 specialist agent를 나누기에 좋습니다.

또한 이 버전은 단순 요약만 보는 것이 아니라, 실제 저장소 파일 구조와 핵심 manifest를 함께 읽어 계획을 만들도록 설계했습니다. 그래서 존재하지 않는 파일을 마구 제안하는 문제를 줄이는 방향으로 발전시켰습니다.

## 설치 방법

저장소 루트에서 아래 순서로 실행합니다.

```powershell
cd orchestrator
"C:\Program Files\nodejs\npm.cmd" install
```

사용 패키지:

- `@langchain/langgraph`
- `@langchain/core`
- `@langchain/openai`
- `dotenv`
- `zod`
- `tsx`
- `typescript`

## 환경변수

스크립트는 저장소 루트의 `.env` 파일을 자동으로 읽습니다.

실제 OpenAI 호출에 필요한 값:

- `OPENAI_API_KEY`

선택값:

- `ORCHESTRATOR_MODEL`
  - 기본값: `gpt-4.1`

나머지 프로젝트 환경변수는 오케스트레이션 문맥으로만 사용됩니다.

## 첫 실행: mock 모드

처음에는 반드시 mock 모드로 실행하는 것을 권장합니다.

```powershell
cd orchestrator
"C:\Program Files\nodejs\npm.cmd" run demo:mock -- "네이버 로그인 기능을 만들어줘"
```

mock 모드는 실제 OpenAI API를 호출하지 않습니다. 대신 미리 준비된 가짜 응답으로 전체 그래프 흐름이 정상인지 확인합니다.

이 단계에서 확인되는 것:

- LangGraph 설치가 정상인지
- 그래프가 컴파일되는지
- manager -> specialist -> merge 흐름이 정상인지
- 출력 형식이 의도대로 나오는지

## 실제 모델로 실행

`OPENAI_API_KEY`가 준비되어 있으면 실제 모델 호출 모드로 실행할 수 있습니다.

```powershell
cd orchestrator
"C:\Program Files\nodejs\npm.cmd" run demo -- "네이버 로그인 기능을 만들어줘"
```

이 모드에서는:

- manager agent가 실제 요청을 분석하고
- specialist 계획도 실제 모델이 생성하며
- 저장소 구조를 읽은 결과를 함께 참고합니다

## 현재 버전의 특징

현재 버전은 아래 정보를 함께 참고합니다.

- 프로젝트 요약
- 핵심 계약(JWT, DB 포트, env 변수 등)
- 실제 파일 목록
- 핵심 설정 파일 일부 내용
  - `run.bat`
  - `stop.bat`
  - `.env`
  - `web/package.json`
  - `backend-core/build.gradle`
  - `backend-core/application.properties`
  - `backend-fast/Cargo.toml`
  - `mobile/build.gradle`

즉, 단순한 “문맥 기반 planner”에서 한 단계 더 나아가 “repo-aware planner”가 되도록 만든 상태입니다.

## 기대할 수 있는 출력

실행 결과는 다음과 같은 구조의 orchestration report입니다.

- manager summary
- integration notes
- specialist별 계획
- touched areas
- verification commands
- risks

## 아직 하지 않는 것

현재는 아직 아래 기능은 없습니다.

- 실제 코드 수정
- git 브랜치 자동 분기
- specialist별 자동 병렬 실행
- verifier agent의 자동 테스트 실행

즉, 지금 단계는 “자동 작업 분배 및 계획 생성기”입니다.

## 다음 확장 추천

추천 확장 순서:

1. specialist가 실제 파일 내용을 더 깊게 읽도록 확장
2. verifier node 추가
3. specialist별 실제 코드 수정 단계 추가
4. 병렬 실행 및 상태 저장(checkpoint) 추가

## 다음에 당신이 할 일

이 단계까지 왔다면 보통 아래 순서로 진행하면 됩니다.

1. `npm install`
2. `demo:mock` 실행
3. `demo` 실행
4. 출력 품질 확인
5. 필요하면 오케스트레이터를 더 똑똑하게 확장

이 저장소 기준으로는, 다음 비교 질문이 가장 유용합니다.

- “mock 출력과 real 출력이 얼마나 다른가?”
- “실제 존재하지 않는 파일을 제안하는가?”
- “Java/Rust/Mobile/Web 영향 범위를 제대로 분리하는가?”
