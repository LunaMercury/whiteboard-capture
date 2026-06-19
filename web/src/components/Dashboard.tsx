import { useEffect, useRef, useState, type MouseEvent } from 'react';
import ImageEditor from './ImageEditor';
import styles from './Dashboard.module.css';
import { getRealtimeWsUrl, getFastApiUrl } from '../config';

interface CapturedImage {
  id: number;
  url: string;
  date: string;
  dateOnly: string;
}

interface DashboardProps {
  token: string;
  onLogout: () => void;
}

type CopyFeedback = 'copying' | 'success' | 'error';

const formatDateOnly = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Dashboard({ token, onLogout }: DashboardProps) {
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [copyFeedbackById, setCopyFeedbackById] = useState<Record<number, CopyFeedback>>({});
  const copyFeedbackTimers = useRef<Record<number, number>>({});

  useEffect(() => () => {
    Object.values(copyFeedbackTimers.current).forEach((timerId) => {
      window.clearTimeout(timerId);
    });
  }, []);

  const setCopyFeedback = (imageId: number, feedback: CopyFeedback) => {
    window.clearTimeout(copyFeedbackTimers.current[imageId]);
    setCopyFeedbackById((prev) => ({ ...prev, [imageId]: feedback }));

    if (feedback !== 'copying') {
      copyFeedbackTimers.current[imageId] = window.setTimeout(() => {
        setCopyFeedbackById((prev) => {
          const next = { ...prev };
          delete next[imageId];
          return next;
        });
      }, 1400);
    }
  };

  // 1. Fetch images history on mount
  useEffect(() => {
    const fetchImages = async () => {
      try {
        const response = await fetch(getFastApiUrl('/images'), {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json() as Array<{ id: number; url: string; created_at: string }>;
          const formatted = data.map((item) => {
            const d = new Date(item.created_at);
            return {
              id: item.id,
              url: item.url,
              date: d.toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
              dateOnly: formatDateOnly(d),
            };
          });
          setImages(formatted);
        } else {
          console.error('Failed to fetch images history from fast backend');
        }
      } catch (err) {
        console.error('Error fetching images history:', err);
      }
    };

    fetchImages();
  }, [token]);

  // 2. Realtime WebSocket subscription
  useEffect(() => {
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
          const now = new Date();
          const newImage: CapturedImage = {
            id: Date.now(),
            url: imageUrl,
            date: now.toLocaleString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            dateOnly: formatDateOnly(now),
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

  // Group images by date
  const imagesByDate: Record<string, CapturedImage[]> = {};
  images.forEach((img) => {
    if (!imagesByDate[img.dateOnly]) {
      imagesByDate[img.dateOnly] = [];
    }
    imagesByDate[img.dateOnly].push(img);
  });

  // Sort dates descending
  const dates = Object.keys(imagesByDate).sort((a, b) => b.localeCompare(a));

  // Determine active date
  const activeDate = selectedDate && dates.includes(selectedDate) ? selectedDate : (dates[0] || null);
  const activeImages = activeDate ? imagesByDate[activeDate] : [];

  const handleCopy = async (imageId: number, imageUrl: string, event?: MouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation();
    setCopyFeedback(imageId, 'copying');

    try {
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

      const copiedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((nextBlob) => {
          if (nextBlob) {
            resolve(nextBlob);
          } else {
            reject(new Error('Canvas blob conversion failed'));
          }
        }, 'image/png');
      });

      const clipboardItem = new ClipboardItem({ 'image/png': copiedBlob });
      await navigator.clipboard.write([clipboardItem]);
      setCopyFeedback(imageId, 'success');
    } catch (error) {
      console.error('Image copy failed', error);
      setCopyFeedback(imageId, 'error');
    }
  };

  const handleEdit = (imageUrl: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setEditingImageUrl(imageUrl);
  };

  const handleDelete = async (imageId: number, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!window.confirm('이 사진을 삭제하시겠습니까?\n삭제하면 복구할 수 없습니다.')) return;

    try {
      const response = await fetch(getFastApiUrl(`/images/${imageId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok || response.status === 204) {
        setImages((prev) => prev.filter((img) => img.id !== imageId));
      } else {
        alert('삭제에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } catch (err) {
      console.error('Delete failed:', err);
      alert('네트워크 오류로 삭제하지 못했습니다.');
    }
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
        <div className={styles.explorerWrapper}>
          {/* Windows-like Left Folder Sidebar */}
          <aside className={styles.sidebar}>
            <h3 className={styles.sidebarTitle}>📁 날짜 폴더</h3>
            {dates.length === 0 ? (
              <p className={styles.noFolders}>업로드 폴더가 없습니다.</p>
            ) : (
              <ul className={styles.folderList}>
                {dates.map((date) => (
                  <li key={date}>
                    <button
                      className={`${styles.folderButton} ${activeDate === date ? styles.folderActive : ''}`}
                      onClick={() => setSelectedDate(date)}
                    >
                      <span className={styles.folderIcon}>{activeDate === date ? '📂' : '📁'}</span>
                      <span className={styles.folderName}>{date}</span>
                      <span className={styles.folderCount}>({imagesByDate[date].length})</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* Right Main Grid Workspace */}
          <section className={styles.contentArea}>
            {activeImages.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📝</div>
                <h2>보관된 칠판 사진이 없습니다.</h2>
                <p>스마트폰 카메라 앱으로 칠판을 찍으면 실시간으로 여기에 날짜별로 등록됩니다.</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {activeImages.map((img) => {
                  const copyFeedback = copyFeedbackById[img.id];
                  const cardClassName = [
                    styles.card,
                    copyFeedback === 'copying' ? styles.cardCopying : '',
                    copyFeedback === 'success' ? styles.cardCopied : '',
                    copyFeedback === 'error' ? styles.cardCopyFailed : '',
                  ].filter(Boolean).join(' ');

                  return (
                  <div key={img.id} className={cardClassName}>
                    <div className={styles.imageWrapper}>
                      <img
                        src={img.url}
                        alt="Board Capture"
                        className={styles.image}
                        crossOrigin="anonymous"
                      />

                      {copyFeedback && (
                        <div
                          className={`${styles.copyStatusBadge} ${
                            copyFeedback === 'error' ? styles.copyStatusBadgeError : ''
                          }`}
                        >
                          {copyFeedback === 'copying' && '복사 중'}
                          {copyFeedback === 'success' && '복사 완료'}
                          {copyFeedback === 'error' && '복사 실패'}
                        </div>
                      )}

                      <div className={styles.actionOverlay}>
                        <button
                          className={`${styles.actionButton} ${styles.editButton}`}
                          onClick={(event) => handleEdit(img.url, event)}
                        >
                          편집
                        </button>
                        <button
                          className={`${styles.actionButton} ${styles.copyButton}`}
                          onClick={(event) => handleCopy(img.id, img.url, event)}
                          disabled={copyFeedback === 'copying'}
                        >
                          복사
                        </button>
                      </div>
                    </div>

                    <div className={styles.cardFooter}>
                      <span className={styles.date}>{img.date}</span>
                      <button
                        className={styles.deleteButton}
                        onClick={(event) => handleDelete(img.id, event)}
                        title="삭제"
                        aria-label="사진 삭제"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
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
