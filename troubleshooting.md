# Whiteboard Capture - Troubleshooting Guide

이 문서는 개발 환경 구축 및 운영 중 발생할 수 있는 주요 문제와 해결 방법을 정리합니다.

## 1. 네트워크 및 포트 관련 (Network & Ports)

### 1.1. 포트 점유 에러 (Port 8080 already in use)
- **증상**: `WB-Core` 실행 시 `Web server failed to start. Port 8080 was already in use.` 메시지 발생.
- **원인**: 
    1. 이전 실행 프로세스가 좀비 상태로 남아 있음.
    2. **Windows 예약 포트(Hyper-V 등)**가 해당 범위를 선점함.
- **해결 방법**:
    - **좀비 프로세스 정리**: 루트 폴더의 `mobile-off.bat` 실행.
    - **예약 포트 초기화 (WinNAT)**: 관리자 권한 CMD에서 아래 명령어 실행.
      ```cmd
      net stop winnat
      net start winnat
      ```

### 1.2. DB 연결 실패 (PostgreSQL Connection)
- **증상**: `Failed to connect to Postgres`, `PoolTimedOut` 에러 발생.
- **원인**: Docker 컨테이너가 내려가 있거나 포트(5433)가 충돌함.
- **해결 방법**:
    - `docker ps`로 `whiteboard-postgres` 컨테이너 상태 확인.
    - `run.bat`을 재실행하여 컨테이너 재시작.

## 2. 데이터베이스 인증 (Database Auth)

### 2.1. 인증 실패 (Authentication Failed)
- **증상**: `password authentication failed for user "postgres"`.
- **원인**: `.env` 파일의 비밀번호와 Docker 컨테이너의 비밀번호가 불일치.
- **해결 방법**: 
    - `.env` 파일의 `SPRING_DATASOURCE_PASSWORD` 및 `DATABASE_URL` 비밀번호 확인.
    - Docker 볼륨 초기화가 필요한 경우: `docker compose down -v` 후 다시 `run.bat` 실행. (주의: 데이터 삭제됨)

---
*마지막 업데이트: 2026-05-04*
