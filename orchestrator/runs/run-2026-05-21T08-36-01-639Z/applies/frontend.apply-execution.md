You are Codex applying previously approved worker-proposed edits for the Whiteboard Capture repository.
Return only JSON matching the provided schema.
Generate the exact final file content for each changed file.
Do not propose edits outside the listed files.
Preserve existing style and comments where appropriate.
Add concise human-readable comments only where complex logic benefits from them.

Role: frontend
Goal: 웹 프론트엔드에 네이버 소셜 로그인 기능을 추가하여 사용자가 네이버 계정으로 인증할 수 있도록 한다.

Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- VITE_API_BASE_URL, VITE_REALTIME_WS_URL 계약을 유지합니다.
- 백엔드 메시지 포맷과 JWT 전달 방식을 합의 없이 바꾸지 않습니다.
- 로그인 버튼, OAuth redirect, JWT 저장 방식은 백엔드와 합의된 계약만 사용합니다.

Required verification:
- .skills/verify-web.ps1

Target file edits:

## web/src/config.ts
- action: update
- summary: 네이버 로그인용 OAuth 인증 URL을 상수로 추가
- instructions:
  - VITE_API_BASE_URL 이용하여 NAVER_OAUTH_URL 상수를 추가합니다.
  - 예: export const NAVER_OAUTH_URL = `${VITE_API_BASE_URL}/auth/naver/login`;
- exists: yes

Current file content:
```
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const realtimeWsUrl = import.meta.env.VITE_REALTIME_WS_URL || 'ws://localhost:3000/ws';
const fastApiBaseUrl = import.meta.env.VITE_FAST_API_BASE_URL || 'http://localhost:3000';

// Keep URL construction in one place so dev/prod can switch transports without editing components.
export function getApiUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

export function getFastApiUrl(path: string): string {
  return `${fastApiBaseUrl}${path}`;
}

export function getRealtimeWsUrl(token: string): string {
  const url = new URL(realtimeWsUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

```

## web/src/components/Login.tsx
- action: update
- summary: 네이버 로그인 버튼 UI 추가 및 인증 플로우/콜백 JWT 저장 로직 구현
- instructions:
  - 공식 네이버 CI 가이드에 맞는 네이버 로그인 버튼을 렌더링합니다.
  - 버튼 클릭 시 window.location.href를 NAVER_OAUTH_URL로 이동시킵니다.
  - component mount 시 URL 쿼리 파라미터에서 JWT(token)를 감지해 로컬스토리지 등에 저장 후 로그인 상태로 전환, 보호된 페이지로 네비게이션합니다.
  - 에러/취소/실패 시 URL 파라미터를 확인해 안내 메시지와 함께 UI에 표시합니다.
- exists: yes

Current file content:
```
import { useState } from 'react';
import styles from './Login.module.css';
import { getApiUrl } from '../config';

interface LoginProps {
  onLogin: (token: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        alert('로그인에 실패했습니다. 이메일과 비밀번호를 다시 확인해주세요.');
        return;
      }

      const data = await response.json() as { token?: string };
      if (!data.token) {
        alert('서버 응답에 토큰이 없어 로그인할 수 없습니다.');
        return;
      }

      onLogin(data.token);
    } catch (error) {
      console.error('Login request failed', error);
      alert('서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Whiteboard Capture</h1>
          <p className={styles.subtitle}>촬영한 칠판 사진을 바로 복사해보세요.</p>
        </div>

        <div className={styles.form}>
          <button className={styles.googleButton} onClick={handleLogin} disabled={isSubmitting}>
            <span className={styles.icon}>G</span>
            준비 중인 Google 로그인 대신 테스트 계정으로 계속하기
          </button>

          <div className={styles.divider}>
            <span>또는</span>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>이메일</label>
            <input
              type="email"
              id="email"
              className={styles.input}
              placeholder="student@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>비밀번호</label>
            <input
              type="password"
              id="password"
              className={styles.input}
              placeholder="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <button className={styles.primaryButton} onClick={handleLogin} disabled={isSubmitting}>
            {isSubmitting ? '로그인 중...' : '이메일로 로그인'}
          </button>
        </div>
      </div>
    </div>
  );
}

```

## web/src/components/Login.module.css
- action: update
- summary: 네이버 로그인 버튼 공식 스타일 클래스 추가
- instructions:
  - 네이버 공식 가이드에 따라 네이버 그린, 로고, 폰트 등 버튼 스타일을 정의합니다.
  - cursor, padding, border-radius, focus/hover 효과 등 접근성을 고려해 작성합니다.
- exists: yes

Current file content:
```
.container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1rem;
  /* 배경에 부드러운 그라데이션 적용 */
  background: linear-gradient(135deg, var(--color-primary-50) 0%, var(--color-neutral-100) 100%);
}

.card {
  width: 100%;
  max-width: 400px;
  background-color: var(--glass-bg-light);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: 2.5rem 2rem;
  box-shadow: var(--shadow-xl);
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.title {
  font-size: var(--font-size-2xl);
  color: var(--color-primary-600);
  margin-bottom: 0.5rem;
}

.subtitle {
  color: var(--color-neutral-500);
  font-size: var(--font-size-sm);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Buttons */
.googleButton {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background-color: #ffffff;
  color: var(--color-neutral-800);
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-normal);
  box-shadow: var(--shadow-sm);
}

.googleButton:hover {
  background-color: var(--color-neutral-50);
  border-color: var(--color-neutral-500);
}

.icon {
  font-weight: 700;
  color: #ea4335; /* 구글 레드 */
}

.primaryButton {
  width: 100%;
  padding: 0.75rem 1rem;
  background-color: var(--color-primary-600);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast), transform var(--transition-fast);
  box-shadow: var(--shadow-md);
}

.primaryButton:hover {
  background-color: var(--color-primary-700);
  transform: translateY(-1px);
}

.primaryButton:active {
  transform: translateY(0);
}

/* Divider */
.divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 0.5rem 0;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--color-neutral-200);
}

.divider span {
  padding: 0 1rem;
  color: var(--color-neutral-500);
  font-size: var(--font-size-sm);
}

/* Inputs */
.inputGroup {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.label {
  font-size: var(--font-size-sm);
  color: var(--color-neutral-800);
  font-weight: 500;
}

.input {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  outline: none;
}

.input:focus {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

```

Output rules:
- fileEdits must include only the listed paths.
- For update/create actions, content must contain the full final file content.
- For delete actions, content must be an empty string.
- changedFiles should match the files you actually changed.
- status should be succeeded only if the file contents are ready to write.
