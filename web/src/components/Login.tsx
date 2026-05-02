import styles from './Login.module.css';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Whiteboard Capture</h1>
          <p className={styles.subtitle}>필기를 즉시 복사하세요</p>
        </div>
        
        <div className={styles.form}>
          <button className={styles.googleButton} onClick={onLogin}>
            {/* 구글 아이콘 임시 처리 */}
            <span className={styles.icon}>G</span>
            Google 계정으로 시작하기
          </button>
          
          <div className={styles.divider}>
            <span>또는</span>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>이메일</label>
            <input type="email" id="email" className={styles.input} placeholder="student@example.com" />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>비밀번호</label>
            <input type="password" id="password" className={styles.input} placeholder="••••••••" />
          </div>
          
          <button className={styles.primaryButton} onClick={onLogin}>
            이메일로 로그인
          </button>
        </div>
      </div>
    </div>
  );
}
