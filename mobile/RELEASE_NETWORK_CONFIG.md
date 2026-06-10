# Mobile Release Network Configuration

모바일 앱은 개발 빌드와 운영 빌드의 네트워크 정책을 분리합니다.

## Debug Build

로컬 에뮬레이터 개발에서는 Android 에뮬레이터가 호스트 PC를 가리키는 `10.0.2.2` 주소를 사용합니다.

```text
CORE_API_BASE_URL=http://10.0.2.2:18080
FAST_API_BASE_URL=http://10.0.2.2:3000
FAST_WS_BASE_URL=ws://10.0.2.2:3000/ws
```

debug 빌드에서는 `10.0.2.2`와 `localhost`에 한해 cleartext HTTP를 허용합니다.

## Release Build

운영 빌드는 실제 URL을 소스에 하드코딩하지 않습니다.
빌드 시점에 Gradle property 또는 현재 프로세스/CI 환경변수로 주입해야 합니다.

필수 값:

```text
RELEASE_CORE_API_BASE_URL=https://...
RELEASE_FAST_API_BASE_URL=https://...
RELEASE_FAST_WS_BASE_URL=wss://...
```

검증 규칙:

- `RELEASE_CORE_API_BASE_URL`은 `https://`로 시작해야 합니다.
- `RELEASE_FAST_API_BASE_URL`은 `https://`로 시작해야 합니다.
- `RELEASE_FAST_WS_BASE_URL`은 `wss://`로 시작해야 합니다.
- release 빌드에서는 cleartext traffic을 허용하지 않습니다.

## Local Release Build Example

```powershell
cd "D:\개발\whiteboard capture\mobile"

.\gradlew.bat assembleRelease `
  -PRELEASE_CORE_API_BASE_URL=https://core.example.com `
  -PRELEASE_FAST_API_BASE_URL=https://fast.example.com `
  -PRELEASE_FAST_WS_BASE_URL=wss://fast.example.com/ws
```

또는 현재 PowerShell 세션 환경변수로 주입할 수 있습니다.

```powershell
$env:RELEASE_CORE_API_BASE_URL="https://core.example.com"
$env:RELEASE_FAST_API_BASE_URL="https://fast.example.com"
$env:RELEASE_FAST_WS_BASE_URL="wss://fast.example.com/ws"

cd "D:\개발\whiteboard capture\mobile"
.\gradlew.bat assembleRelease
```

위 `$env:` 값은 현재 PowerShell 세션에만 적용되며 시스템 전역 환경변수를 변경하지 않습니다.

## CI/CD Notes

운영 환경에서는 다음 중 하나로 값을 주입합니다.

- CI secret
- Kubernetes Secret
- ArgoCD/Helm/Kustomize values
- 배포 파이프라인에서 생성하는 `gradle.properties`

민감한 배포 URL과 인증 정보는 Git에 커밋하지 않습니다.
