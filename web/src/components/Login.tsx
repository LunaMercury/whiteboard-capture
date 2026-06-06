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
            aria-label="네이버 아이디로 로그인"
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
          {/* 안내 문구(문제가 계속되면...) */}
          <p className={styles.login__helpMessage} aria-label="문제가 계속되면 관리자에게 문의해 주세요.">
            문제가 계속되면 관리자에게 문의해 주세요.
          </p>
          {error && (
            <div style={{ color: '#e53e3e', marginTop: '0.5rem', fontSize: '0.95em', textAlign: 'center' }}>{error}</div>
          )}
        </div>
        <p className={styles.betaNotice}>이 서비스는 현재 <b>Beta</b> 버전입니다. 안정성 및 데이터 보관에 유의해 주세요.</p>
      </div>
    </div>
  );
}
