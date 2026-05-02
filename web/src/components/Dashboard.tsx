import { useState } from 'react';
import styles from './Dashboard.module.css';

interface DashboardProps {
  onLogout: () => void;
}

// 임시 목업 데이터
const mockImages = [
  { id: 1, url: 'https://images.unsplash.com/photo-1580894908361-9671950d3215?w=600&q=80', date: '2026-05-02 10:00' },
  { id: 2, url: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=600&q=80', date: '2026-05-02 09:30' }
];

export default function Dashboard({ onLogout }: DashboardProps) {
  const [images] = useState(mockImages);
  
  const handleCopy = async (imageUrl: string) => {
    try {
      // 이미지 URL을 가져와서 Blob으로 변환 후 클립보드에 쓰기
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      // ClipboardItem 생성 시 MIME 타입 명시
      const clipboardItem = new ClipboardItem({
        [blob.type]: blob
      });
      
      await navigator.clipboard.write([clipboardItem]);
      alert('✅ 이미지가 클립보드에 복사되었습니다! (Ctrl+V로 붙여넣기 해보세요)');
    } catch (err) {
      console.error('복사 실패:', err);
      alert('복사에 실패했습니다. 브라우저 권한을 확인해주세요.');
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>내 칠판 보관함</h1>
          <span className={styles.limitBadge}>보관량: {images.length}/100</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.statusIndicator}>
            <span className={styles.statusDot}></span>
            <span className={styles.statusText}>실시간 연결됨</span>
          </div>
          <button className={styles.logoutButton} onClick={onLogout}>로그아웃</button>
        </div>
      </header>

      <main className={styles.main}>
        {images.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📷</div>
            <h2>아직 찍은 사진이 없습니다.</h2>
            <p>앱에서 칠판을 찍으면 여기에 즉시 나타납니다.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {images.map((img) => (
              <div key={img.id} className={styles.card} onClick={() => handleCopy(img.url)}>
                <div className={styles.imageWrapper}>
                  <img src={img.url} alt="Board Capture" className={styles.image} crossOrigin="anonymous" />
                  <div className={styles.copyOverlay}>
                    <span className={styles.copyText}>클릭하여 복사</span>
                  </div>
                </div>
                <div className={styles.cardFooter}>
                  <span className={styles.date}>{img.date}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
