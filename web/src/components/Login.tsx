import { useState } from 'react';
import styles from './Login.module.css';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const res = await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('token', data.token);
        }
        onLogin(); // 성공 시 대시보드로 이동
      } else {
        alert('로그인 실패: 아이디나 비밀번호를 확인하세요.');
      }
    } catch (e) {
      console.error(e);
      alert('서버 연결에 실패했습니다.');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Whiteboard Capture</h1>
          <p className={styles.subtitle}>필기를 즉시 복사하세요</p>
        </div>
        
        <div className={styles.form}>
          <button className={styles.googleButton} onClick={onLogin}>
            <span className={styles.icon}>G</span>
            Google 계정으로 시작하기 (임시 허용)
          </button>
          
          <div className={styles.divider}>
            <span>또는</span>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>이메일 (test)</label>
            <input type="email" id="email" className={styles.input} placeholder="student@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>비밀번호 (test)</label>
            <input type="password" id="password" className={styles.input} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          
          <button className={styles.primaryButton} onClick={handleLogin}>
            이메일로 로그인
          </button>
        </div>
      </div>
    </div>
  );
}
