import { useEffect, useState, type MouseEvent } from 'react';
import ImageEditor from './ImageEditor';
import styles from './Dashboard.module.css';
import { getRealtimeWsUrl } from '../config';

interface CapturedImage {
  id: number;
  url: string;
  date: string;
}

interface DashboardProps {
  token: string;
  onLogout: () => void;
}

const initialImages: CapturedImage[] = [];

export default function Dashboard({ token, onLogout }: DashboardProps) {
  const [images, setImages] = useState<CapturedImage[]>(initialImages);
  const [isConnected, setIsConnected] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);

  useEffect(() => {
    // The browser only knows the current token; the actual ws/wss endpoint comes from env config.
    const ws = new WebSocket(getRealtimeWsUrl(token));

    ws.onopen = () => {
      console.log('Connected to Rust Fast Backend (WebSocket)');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type?: string; url?: string };
        const imageUrl = data.url;
        if (data.type !== 'new_image' || !imageUrl) {
          return;
        }

        setImages((prevImages) => {
          // The UI mirrors the server-side FIFO rule so the browser never shows more than 100 items.
          const newImage: CapturedImage = {
            id: Date.now(),
            url: imageUrl,
            date: new Date().toLocaleString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          };

          return [newImage, ...prevImages].slice(0, 100);
        });
      } catch (error) {
        console.error('Failed to parse websocket message', error);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from Rust Fast Backend');
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [token]);

  const handleCopy = async (imageUrl: string, event?: MouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation();

    try {
      // Copying image bytes requires drawing them into a same-origin canvas first.
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image load failed'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas context failed');
      }

      ctx.drawImage(img, 0, 0);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert('이미지를 변환하지 못했습니다.');
          return;
        }

        try {
          const clipboardItem = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([clipboardItem]);
          alert('이미지를 클립보드에 복사했습니다. 원하는 곳에 붙여넣어 보세요.');
        } catch (error) {
          console.error('Clipboard write failed', error);
          alert('클립보드 복사에 실패했습니다. 브라우저 권한을 확인해주세요.');
        }
      }, 'image/png');
    } catch (error) {
      console.error('Image load failed', error);
      alert('이미지를 불러오지 못해 복사할 수 없습니다.');
    }
  };

  const handleEdit = (imageUrl: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setEditingImageUrl(imageUrl);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>화이트보드 캡처</h1>
          <span className={styles.limitBadge}>보관 중 {images.length}/100</span>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.statusIndicator}>
            <span
              className={styles.statusDot}
              style={{ backgroundColor: isConnected ? '#10b981' : '#ef4444' }}
            />
            <span
              className={styles.statusText}
              style={{ color: isConnected ? '#10b981' : '#ef4444' }}
            >
              {isConnected ? '실시간 연결됨' : '연결 끊김'}
            </span>
          </div>

          <button className={styles.logoutButton} onClick={onLogout}>로그아웃</button>
        </div>
      </header>

      <main className={styles.main}>
        {images.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>보드</div>
            <h2>아직 업로드된 사진이 없습니다.</h2>
            <p>앱에서 촬영하면 이 화면에 바로 나타나고, 곧바로 복사할 수 있습니다.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {images.map((img) => (
              <div key={img.id} className={styles.card}>
                <div className={styles.imageWrapper}>
                  <img
                    src={img.url}
                    alt="Board Capture"
                    className={styles.image}
                    crossOrigin="anonymous"
                  />

                  <div className={styles.actionOverlay}>
                    <button
                      className={`${styles.actionButton} ${styles.editButton}`}
                      onClick={(event) => handleEdit(img.url, event)}
                    >
                      편집
                    </button>
                    <button
                      className={`${styles.actionButton} ${styles.copyButton}`}
                      onClick={(event) => handleCopy(img.url, event)}
                    >
                      복사
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

      {editingImageUrl && (
        <div className={styles.editorModalOverlay}>
          <div className={styles.editorContainer}>
            <ImageEditor
              imageUrl={editingImageUrl}
              onSave={(dataUrl) => {
                setImages((prevImages) => prevImages.map((img) => (
                  img.url === editingImageUrl ? { ...img, url: dataUrl } : img
                )));
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
