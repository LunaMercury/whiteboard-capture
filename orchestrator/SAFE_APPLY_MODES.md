# Safe Apply Modes

`runner:workflow`와 `runner:full`은 worker가 제안한 파일을 적용하기 전에 apply review를 실행합니다.

## 시험 적용

제품 코드를 잠시 수정하고 검증한 뒤 자동 복구합니다.

```text
--apply --rollback-after-verify
```

## 영구 적용

검증 후 제품 코드 변경을 유지하려는 경우에만 명시적으로 사용합니다.

```text
--apply --keep-applied
```

`--apply`만 단독으로 사용하면 실행기는 중단됩니다.

## 경로 안전 규칙

- worker가 제안한 저장소 상대 경로만 적용합니다.
- apply review에서 승인한 파일 목록과 실제 적용 파일 목록이 정확히 같아야 합니다.
- 절대 경로, 빈 경로, `.` 및 `..` 경로 조각은 거부합니다.
- worker가 `failed` 또는 `skipped` 상태를 반환하면 파일을 쓰지 않습니다.
- `--allow-dirty`를 사용하는 롤백 시험에서도 대상 제품 모듈에 기존 변경이 있으면 중단합니다.
- `runner:recover`도 역할별 허용 경로 밖의 파일이나 안전하지 않은 상대 경로를 정리하지 않습니다.
