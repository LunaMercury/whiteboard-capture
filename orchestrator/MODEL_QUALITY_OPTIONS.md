# Model Quality Options

오케스트레이터는 기본적으로 비용과 안정성을 우선해 기존 모델 설정을 그대로 사용합니다.
판단 난도가 높은 요청에서만 worker/apply 모델과 추론 강도를 명령어로 올릴 수 있습니다.

## 기본 원칙

- `worker`는 파일을 직접 수정하지 않고 `proposedEdits`를 만듭니다.
- `apply`는 승인된 `proposedEdits`를 실제 파일 내용으로 변환합니다.
- 모델과 추론 강도는 `worker`와 `apply`에 따로 지정할 수 있습니다.
- 기본값은 바꾸지 않았으므로 기존 명령어는 그대로 동작합니다.
- `reasoning`을 지원하지 않는 모델을 사용할 때는 reasoning 옵션을 생략합니다.

## CLI 옵션

```powershell
--worker-model <model>
--apply-model <model>
--worker-reasoning minimal|low|medium|high|none
--apply-reasoning minimal|low|medium|high|none
```

## 환경변수

```text
OPENAI_WORKER_MODEL
OPENAI_APPLY_MODEL
OPENAI_WORKER_REASONING
OPENAI_APPLY_REASONING
```

`OPENAI_APPLY_MODEL`이 없으면 `OPENAI_WORKER_MODEL`을 사용합니다.
`OPENAI_APPLY_REASONING`이 없으면 `OPENAI_WORKER_REASONING`을 사용합니다.

## 운영 추천

가벼운 UI 문구/스타일 변경:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run runner:full -- --compact --roles frontend --worker-provider openai --apply-provider openai --apply --rollback-after-verify --concurrency 1 "로그인 화면 문구를 정리해줘"
```

보안, 인증, JWT, OAuth, 인프라 계약 변경:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run runner:full -- --compact --roles java,rust --worker-provider openai --apply-provider openai --worker-reasoning high --apply-reasoning medium --apply --rollback-after-verify --concurrency 1 "JWT 계약을 점검하고 필요한 변경을 반영해줘"
```

비용 절약을 우선하는 dry-run:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run runner:full -- --compact --roles frontend --worker-provider openai --worker-reasoning none "작은 UI 개선안을 검토해줘"
```

## 주의

- `--worker-reasoning`과 `--apply-reasoning`은 OpenAI Responses API 요청에 그대로 전달됩니다.
- 사용 중인 모델이 reasoning 옵션을 지원하지 않으면 해당 옵션을 빼고 다시 실행합니다.
- reasoning 강도를 올리면 품질은 좋아질 수 있지만 토큰 사용량과 비용이 증가할 수 있습니다.
