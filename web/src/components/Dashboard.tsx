import { useState, useEffect } from 'react';
import ImageEditor from './ImageEditor';
import styles from './Dashboard.module.css';

interface CapturedImage {
  id: number;
  url: string;
  date: string;
}

interface DashboardProps {
  onLogout: () => void;
}

const initialImages: CapturedImage[] = [];

export default function Dashboard({ onLogout }: DashboardProps) {
  const [images, setImages] = useState<CapturedImage[]>(initialImages);
  const [isConnected, setIsConnected] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  
  useEffect(() => {
    // Rust WebSocket 서버(Hot Path Pipeline) 연결
    const ws = new WebSocket('ws://localhost:3000/ws');

    ws.onopen = () => {
      console.log('✅ Connected to Rust Fast Backend (WebSocket)');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_image' && data.url) {
          // 새 이미지가 도착하면 즉시 배열의 맨 앞(최신)에 추가
          setImages(prevImages => {
            const newImage: CapturedImage = {
              id: Date.now(), // 고유 식별자 (임시)
              url: data.url,
              date: new Date().toLocaleString('ko-KR', { 
                year: 'numeric', month: '2-digit', day: '2-digit', 
                hour: '2-digit', minute: '2-digit', second: '2-digit' 
              })
            };
            
            const updatedList = [newImage, ...prevImages];
            // [데이터 보관 정책] 100개가 넘으면 가장 오래된 데이터 자동 삭제 (FIFO)
            if (updatedList.length > 100) {
              return updatedList.slice(0, 100);
            }
            return updatedList;
          });
        }
      } catch (e) {
        console.error('Failed to parse websocket message', e);
      }
    };

    ws.onclose = () => {
      console.log('❌ Disconnected from Rust Fast Backend');
      setIsConnected(false);
    };

    return () => {
      ws.close(); // 컴포넌트 언마운트 시 연결 종료
    };
  }, []);

  const handleCopy = async (imageUrl: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context failed');
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert('이미지 변환에 실패했습니다.');
          return;
        }
        try {
          const clipboardItem = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([clipboardItem]);
          alert('✅ 이미지가 클립보드에 복사되었습니다! (Ctrl+V로 붙여넣기 해보세요)');
        } catch (err) {
          console.error('클립보드 쓰기 실패:', err);
          alert('복사에 실패했습니다. 브라우저가 클립보드 접근을 차단했을 수 있습니다.');
        }
      }, 'image/png');

    } catch (err) {
      console.error('이미지 로드 실패:', err);
      alert('복사에 실패했습니다. 이미지 로드 중 오류가 발생했습니다.');
    }
  };

  const handleEdit = (imageUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingImageUrl(imageUrl);
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
            <span 
              className={styles.statusDot} 
              style={{ backgroundColor: isConnected ? '#10b981' : '#ef4444' }}
            ></span>
            <span className={styles.statusText} style={{ color: isConnected ? '#10b981' : '#ef4444' }}>
              {isConnected ? '실시간 연결됨' : '연결 끊김'}
            </span>
          </div>
          <button className={styles.logoutButton} onClick={onLogout}>로그아웃</button>
        </div>
      </header>

      <main className={styles.main}>
        {images.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📷</div>
            <h2>아직 찍은 사진이 없습니다.</h2>
            <p>앱에서 칠판을 찍으면 새로고침 없이 여기에 즉시 나타납니다.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {images.map((img) => (
              <div key={img.id} className={styles.card}>
                <div className={styles.imageWrapper}>
                  <img src={img.url} alt="Board Capture" className={styles.image} crossOrigin="anonymous" />
                  <div className={styles.actionOverlay}>
                    <button className={`${styles.actionButton} ${styles.editButton}`} onClick={(e) => handleEdit(img.url, e)}>
                      ✏️ 수정
                    </button>
                    <button className={`${styles.actionButton} ${styles.copyButton}`} onClick={(e) => handleCopy(img.url, e)}>
                      📋 복사
                    </button>
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

      {/* 이미지 에디터 모달 */}
      {editingImageUrl && (
        <div className={styles.editorModalOverlay}>
          <div className={styles.editorContainer}>
            <ImageEditor
              imageUrl={editingImageUrl}
              onSave={(dataUrl) => {
                setImages(prev => prev.map(img =>
                  img.url === editingImageUrl ? { ...img, url: dataUrl } : img
                ));
                setEditingImageUrl(null);
              }}
              onClose={() => setEditingImageUrl(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
