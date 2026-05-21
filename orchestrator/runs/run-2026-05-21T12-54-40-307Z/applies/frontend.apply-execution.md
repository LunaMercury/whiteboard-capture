You are Codex applying previously approved worker-proposed edits for the Whiteboard Capture repository.
Return only JSON matching the provided schema.
Generate the exact final file content for each changed file.
Do not propose edits outside the listed files.
Preserve existing style and comments where appropriate.
Add concise human-readable comments only where complex logic benefits from them.

Role: frontend
Goal: 웹 프론트엔드에 네이버 로그인 버튼 및 인증 플로우를 추가하여 사용자가 네이버 계정으로 로그인할 수 있도록 한다.

Contracts:
- 기존 환경변수 이름과 인증 계약을 임의로 바꾸지 않습니다.
- 변경이 필요한 계약은 master 세션에 명시적으로 보고합니다.
- VITE_API_BASE_URL, VITE_REALTIME_WS_URL 계약을 유지합니다.
- 백엔드 메시지 포맷과 JWT 전달 방식을 합의 없이 바꾸지 않습니다.
- 로그인 버튼, OAuth redirect, JWT 저장 방식은 백엔드와 합의된 계약만 사용합니다.

Mandatory policy checks:
- JWT_SECRET_KEY, claim 구조, 만료 정책 동기화 여부 확인
- OAuth redirect URI와 토큰 전달 방식 합의 여부 확인
- HTTPS/WSS 사용 경로와 민감 정보(.env, client secret) 노출 금지 여부 확인
- JWT 저장 위치와 XSS/CSRF 완화 방안이 security_guidelines.md 기준을 따르는지 확인

Required verification:
- .skills/verify-web.ps1

Target file edits:

## web/src/components/Login.tsx
- action: update
- summary: Add Naver login button, integrate backend OAuth2 redirect, handle JWT and error states.
- instructions:
  - Import necessary hooks and utilities for navigation and JWT storage (as per existing Google/IDPW flow).
  - Add a Naver login button matching official CI, with aria-label for accessibility.
  - On Naver button click, redirect to `/auth/oauth2/authorization/naver` endpoint.
  - On redirect back (OAuth2 callback), detect Naver flow and handle JWT storage as performed for Google (from query/cookie/etc, as per backend contract).
  - Catch and display error/canceled states if present in the redirected response.
  - Ensure Naver button and messaging are integrated in visual and logical blocks with other login options.
  - Update success, error, and loading UI flows to accommodate Naver along with Google/IDPW.
- exists: yes

Current file content:
```
import { useState, useEffect } from 'react';
import styles from './Login.module.css';
import { getApiUrl, NAVER_OAUTH_URL } from '../config';

interface LoginProps {
  onLogin: (token: string) => void;
}

function getQueryStringParams(search: string): Record<string, string> {
  // 쿼리스트링에서 param 가져오기
  const params = new URLSearchParams(search);
  const obj: Record<string, string> = {};
  params.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 소셜 로그인(네이버) 콜백 감지용: 쿼리스트링 token/error/취소 등 확인
  useEffect(() => {
    const params = getQueryStringParams(window.location.search);
    if (params.token) {
      // JWT 전달 성공: 로그인 처리 (저장, 상태변경)
      try {
        localStorage.setItem('jwt', params.token);
      } catch {}
      // 뒤로가기시 쿼리 제거 (사용자 경험 보호)
      window.history.replaceState({}, document.title, window.location.pathname);
      onLogin(params.token);
      return;
    }
    // 네이버 OAuth 실패/취소: 안내 메시지
    if (params.error || params.error_description) {
      setError((params.error_description || params.error || '알 수 없는 OAuth 오류가 발생했습니다.'));
      // 쿼리 정리
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.state && params.state === 'naver_cancel') {
      setError('네이버 로그인을 사용자가 취소했습니다.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [onLogin]);

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

  const handleNaverLogin = () => {
    // 네이버 OAuth 로그인 진입 (VITE_API_BASE_URL 기준 백엔드로 redirect)
    window.location.href = NAVER_OAUTH_URL;
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Whiteboard Capture</h1>
          <p className={styles.subtitle}>촬영한 칠판 사진을 바로 복사해보세요.</p>
        </div>
        <div className={styles.form}>
          {/* 네이버 로그인 버튼 (공식 가이드 스타일; https://developers.naver.com/docs/login/api/#%EB%A1%9C%EA%B7%B8%EC%9D%B8-%EB%B2%84%ED%8A%BC) */}
          <button
            type="button"
            className={styles.naverButton}
            onClick={handleNaverLogin}
          >
            <span className={styles.naverIcon} aria-hidden="true">N</span>
            <span className={styles.naverText}>네이버 아이디로 로그인</span>
          </button>

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
          {error && (
            <div style={{ color: '#e53e3e', marginTop: '0.5rem', fontSize: '0.95em', textAlign: 'center' }}>{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}

```

## web/src/components/Login.module.css
- action: update
- summary: Add styles for Naver login button according to Naver official CI, ensure accessibility and responsive design.
- instructions:
  - Add .naverLoginButton style using official Naver green, with logo and bold text per their CI guide.
  - Ensure :hover/:focus states comply for accessibility.
  - Adjust layout to ensure button aligns with existing login buttons, is keyboard navigable, and resizes well on small screens.
  - If specific accessibility classes exist for other providers, replicate for Naver button.
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

/* 네이버 로그인 버튼 공식 스타일 */
.naverButton {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.7rem 1rem 0.7rem 1rem;
  background: #03c75a;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 1.09rem;
  font-weight: 700;
  font-family: 'Nanum Gothic', 'Malgun Gothic', 'Apple SD Gothic Neo', Arial, sans-serif;
  letter-spacing: -0.5px;
  cursor: pointer;
  box-shadow: 0 2px 6px 0 rgba(0,0,0,0.03);
  transition: background 0.1s;
}
.naverButton:hover,
.naverButton:focus {
  background: #17b75e;
  outline: none;
}
.naverIcon {
  width: 23px;
  height: 23px;
  border-radius: 3px;
  background: #fff;
  color: #03c75a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 1.4rem;
  /* 네이버 로고 및 공식 CI에 가까운 글꼴, 크기 */
  font-family: 'Arial Black', 'Arial', sans-serif;
}
.naverText {
  flex: 1;
  text-align: center;
  font-size: 1.04rem;
  font-weight: 700;
  font-family: 'Nanum Gothic', 'Malgun Gothic', 'Apple SD Gothic Neo', Arial, sans-serif;
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
- Treat every mandatory policy check as a hard requirement when generating final file content.
- status should be succeeded only if the file contents are ready to write.
