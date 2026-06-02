# Worker Source Context

OpenAI API worker는 로컬 파일 시스템을 직접 읽을 수 없습니다. 오케스트레이터는 역할별 source preview를 제한된 크기로 worker 프롬프트에 포함합니다.

## 선택 순서

1. specialist plan의 `touchedAreas`
2. touched source에서 참조하는 같은 모듈의 파일
3. 같은 모듈의 나머지 텍스트 소스

## 제외 대상

- `.env`, `.env.local`
- `local.properties`
- `.git`, `.gradle`, `.gradle-user-home`, `.idea`
- `bin`, `build`, `dist`, `node_modules`, `target`

## 기본 용량 제한

- 전체 source preview: `32 KiB`
- 파일별 source preview: `12 KiB`

필요한 경우 환경변수로 조정할 수 있습니다.

```text
WORKER_SOURCE_CONTEXT_TOTAL_BYTES
WORKER_SOURCE_CONTEXT_FILE_BYTES
```

worker는 source preview와 계약을 authoritative context로 취급합니다. 이미 구현된 변경을 다시 제안하거나, 주어진 계약으로 답할 수 있는 질문을 반복해서는 안 됩니다.
