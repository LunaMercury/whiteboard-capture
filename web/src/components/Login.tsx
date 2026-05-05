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
