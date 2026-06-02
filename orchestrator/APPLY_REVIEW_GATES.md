# Apply Review Gates

`runner:workflow`와 `runner:full`은 worker 제안을 실제 파일에 적용하기 전에 apply review를 실행합니다.

## 기본 차단 조건

- worker가 `contractsChanged`를 보고한 경우
- worker가 미해결 `questions`를 보고한 경우
- dependency 또는 build manifest 변경이 포함된 경우
- 허용 경로 밖의 파일을 수정하려는 경우
- 역할별 필수 검증 스크립트가 없는 경우

## 명시적 승인 옵션

계약 변경 내용을 검토한 뒤 진행하려면 다음 옵션을 추가합니다.

```text
--approve-contract-changes
```

미해결 질문을 읽고도 의도적으로 진행하려면 다음 옵션을 추가합니다.

```text
--approve-open-questions
```

두 옵션은 의미가 다르므로 필요한 경우에만 각각 사용합니다. dependency 또는 build manifest 변경은 옵션과 무관하게 수동 검토가 필요합니다.
