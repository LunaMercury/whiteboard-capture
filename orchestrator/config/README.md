# Orchestrator Configuration

오케스트레이터 설정은 재사용 가능한 공통 정책과 프로젝트별 정책으로 나뉩니다.

## 공통 설정

- `base-context.yaml`: Java Core, Rust hot path, Web, Mobile 역할과 공통 계약
- `base-templates.yaml`: 인증, 디자인, Redis, 실시간 작업의 기본 정책

새 프로젝트에서도 가능한 한 그대로 유지합니다.

## 프로젝트 설정

- `project.yaml`: 프로젝트 목표, 모듈별 책임, 보관 정책 등 프로젝트별 맥락
- `project-templates.yaml`: 프로젝트 전용 인증 경로, JWT 계약, CSS 규칙 등 추가 정책

새 프로젝트를 시작할 때는 우선 이 두 파일만 교체하거나 수정합니다.

## 병합 규칙

- 객체는 재귀적으로 병합합니다.
- 배열은 공통 항목 뒤에 프로젝트 항목을 추가합니다.
- 문자열과 숫자 등 단일 값은 프로젝트 설정이 공통 설정을 덮어씁니다.

현재 TypeScript 역할 라우팅은 `src/graph.ts`에 있습니다. 다음 단계에서는 새 프로젝트 초기화 명령이 이 설정 파일을 복사하고 프로젝트 전용 YAML 생성을 안내하도록 확장합니다.

새 프로젝트용 시작 파일은 `orchestrator/templates/project-config/`에 있습니다.
