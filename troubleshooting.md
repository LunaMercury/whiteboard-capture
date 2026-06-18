# Whiteboard Capture - Troubleshooting Guide

이 문서는 개발 환경에서 자주 반복되던 실행 오류와 그 근본 원인을 정리합니다.

## 1. 왜 같은 오류가 반복됐는가

이 프로젝트는 예전까지 `run.bat`가 단순히 프로세스만 띄우고 끝나는 구조였습니다.
그래서 아래 문제가 계속 누적됐습니다.

- 이전 실행에서 남아 있던 `WB-Core`, `WB-Fast`, `WB-Web` 프로세스가 포트를 계속 점유했다.
- 루트 `.env`, Docker, Spring Boot, Rust, Vite가 서로 다른 포트와 환경변수를 바라봤다.
- Spring Boot는 DB를 `5432`로 보는데 Docker는 `5433`으로 열려 있어서 연결 실패가 났다.
- JWT 시크릿과 Vite 환경변수가 서비스별로 일관되게 전달되지 않았다.
- DB 컨테이너가 완전히 준비되기 전에 백엔드가 먼저 떠서 `Failed to connect to Postgres`가 났다.

즉, `troubleshooting.md`에 적혀 있던 포트 충돌과 DB 인증 실패는 증상이고, 반복 원인은
"실행 스크립트가 테스트 환경을 매번 같은 상태로 만들지 못했다"는 점입니다.

## 2. 현재 run.bat가 해결하도록 바꾼 점

지금의 `run.bat`는 테스트용 단일 진입점 역할을 하도록 보강되었습니다.

- 루트 `.env`를 먼저 읽는다.
- 예전 Vite 변수명(`VITE_API_CORE_URL`, `VITE_WS_FAST_URL`)도 현재 변수명으로 매핑한다.
- 테스트에서는 Docker PostgreSQL(`localhost:5433`)을 강제로 기준값으로 맞춘다.
- `JWT_SECRET_KEY`가 없으면 로컬 테스트용 기본값을 넣는다.
- 예전 서비스 창을 먼저 종료해서 포트 점유를 줄인다.
- `docker compose up -d` 후 `pg_isready`로 DB 준비 완료를 기다린다.
- 그 다음 Spring, Rust, Web을 순서대로 띄운다.
- 종료는 `stop.bat`, 모바일 Gradle 정리는 `mobile-stop.bat`로 통일한다.

이제 기본 테스트는 `run.bat`만 실행해도 되도록 설계되었습니다.

## 3. 아직 생길 수 있는 예외

### 3.1 Port 8080 already in use

- 증상: `WB-Core` 창에서 `Port 8080 was already in use`
- 원인:
  1. 이 프로젝트 외의 다른 프로세스가 8080을 사용 중
  2. Windows 예약 포트/Hyper-V/WinNAT 충돌
- 해결:
  - 현재 로컬 개발 Core API 기본 포트는 Windows 예약 범위를 피하기 위해 `18080`을 사용함
  - 먼저 `stop.bat` 실행
  - 계속 반복되면 관리자 권한 CMD에서 아래 실행

```cmd
net stop winnat
net start winnat
```

### 3.2 Failed to connect to Postgres / PoolTimedOut

- 증상: Rust 또는 Spring 창에서 Postgres 연결 실패
- 원인:
  1. Docker Desktop이 꺼져 있음
  2. `whiteboard-postgres` 컨테이너가 정상 시작되지 않음
  3. 볼륨 상태가 꼬여 초기화가 필요함
- 해결:
  - `docker ps`로 `whiteboard-postgres` 상태 확인
  - 필요하면 `docker compose down -v` 후 `run.bat` 재실행
  - 주의: `-v`는 DB 데이터를 삭제함

### 3.3 password authentication failed for user "postgres"

- 증상: Postgres 인증 실패
- 원인:
  1. 수동으로 Docker 설정을 바꿨는데 실행 환경변수는 예전 값 사용 중
  2. DB 볼륨에 예전 비밀번호 상태가 남아 있음
- 해결:
  - 테스트 기준은 `postgres / postgres` + `localhost:5433`
  - 직접 다른 비밀번호를 쓸 거라면 `docker-compose.yaml`과 실행 환경을 함께 바꿔야 함
  - 볼륨이 꼬였으면 `docker compose down -v` 후 다시 시작

### 3.4 WB-Core가 NAVER_CLIENT_ID 오류로 종료됨

- 증상: `WB-Core` 창에서 `Could not resolve placeholder 'NAVER_CLIENT_ID'`와 유사한 오류가 발생함
- 원인: 네이버 OAuth 환경변수가 없는 상태에서 네이버 로그인 설정을 필수로 읽으려 한 경우
- 현재 동작:
  - `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_REDIRECT_URI`가 없어도 WB-Core는 정상 부팅됨
  - 이 경우 일반 로그인과 다른 API는 사용할 수 있지만 네이버 로그인 요청은 `503 Service Unavailable`을 반환함
- 네이버 로그인을 실제로 테스트하려면 루트 `.env`에 아래 키를 설정함
  - `NAVER_CLIENT_ID`
  - `NAVER_CLIENT_SECRET`
  - `NAVER_REDIRECT_URI`
- 주의: 실제 client secret은 코드, 프론트엔드 환경변수, 로그에 기록하지 않음

## 4. 다음부터 run.bat만으로 테스트하는 규칙

아래 규칙만 지키면 됩니다.

1. Docker Desktop을 켠다.
2. 루트에서 `run.bat`만 실행한다.
3. 종료할 때는 `stop.bat`를 실행한다.
4. 모바일 Gradle 정리만 필요하면 `mobile-stop.bat`를 실행한다.

별도로 `cargo run`, `gradlew bootRun`, `npm run dev`를 각각 수동 실행하면
다시 환경 불일치가 생길 수 있으니, 통합 테스트는 `run.bat` 기준으로 맞추는 것이 안전합니다.

---
마지막 업데이트: 2026-06-04
