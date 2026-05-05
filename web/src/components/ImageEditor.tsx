import { useEffect, useRef, useState, useCallback, MouseEvent as ReactMouseEvent } from 'react';
import styles from './ImageEditor.module.css';

// --- Types ---
type Tool = 'select' | 'crop' | 'draw' | 'highlight' | 'text';
interface TextObj { id: string; x: number; y: number; content: string; fontSize: number; color: string; }
interface DrawPath {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  mode: 'pen' | 'highlight';
}
interface CropRect { x: number; y: number; w: number; h: number; }

interface Props { imageUrl: string; onSave: (dataUrl: string) => void; onClose: () => void; }

// --- Modular Hooks ---

/** 그리기 로직 모듈 */
function useDrawLogic() {
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [drawColor, setDrawColor] = useState('#FFFF00'); // 기본 노란색
  const [drawWidth, setDrawWidth] = useState(10); // 형광펜 고려하여 기본값 상향
  const isDrawing = useRef(false);

  const startDrawing = (pos: { x: number; y: number }, mode: 'pen' | 'highlight') => {
    isDrawing.current = true;
    const initialPoints = [pos];
    // 형광펜일 경우 클릭만 해도 점이 찍히도록 아주 미세한 이동 포인트 추가
    if (mode === 'highlight') {
      initialPoints.push({ x: pos.x + 0.01, y: pos.y });
    }
    setPaths(prev => [...prev, { 
      points: initialPoints, 
      color: drawColor,
      width: mode === 'highlight' ? drawWidth * 4 : drawWidth,
      mode 
    }]);
  };
  const moveDrawing = (pos: { x: number; y: number }) => {
    if (!isDrawing.current) return;
    setPaths(prev => {
      const last = prev[prev.length - 1];
      const others = prev.slice(0, -1);
      return [...others, { ...last, points: [...last.points, pos] }];
    });
  };
  const stopDrawing = () => { isDrawing.current = false; };

  return { paths, setPaths, drawColor, setDrawColor, drawWidth, setDrawWidth, startDrawing, moveDrawing, stopDrawing };
}

/** 텍스트 로직 모듈 */
function useTextLogic(textSize: number, textColor: string) {
  const [texts, setTexts] = useState<TextObj[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const lastRange = useRef<Range | null>(null);

  // 선택 영역 저장
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      lastRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const addText = (pos: { x: number; y: number }, sx: number) => {
    const id = `t${Date.now()}`;
    setTexts(prev => [...prev, { id, ...pos, content: '', fontSize: textSize / sx, color: textColor }]);
    setEditingId(id);
  };

  const updateText = useCallback((id: string, next: Partial<TextObj>) => {
    setTexts(prev => prev.map(t => t.id === id ? { ...t, ...next } : t));
  }, []);

  const cleanEmptyTexts = () => {
    if (editingId) {
      setTexts(prev => prev.filter(t => t.id !== editingId || t.content.trim() !== ''));
      setEditingId(null);
      lastRange.current = null;
    }
  };

  // 툴바 제어 로직 (모듈화)
  const applyStyle = (type: 'color' | 'size', value: string | number) => {
    if (!editingId) return;

    const el = document.getElementById(`edit-${editingId}`);
    if (!el) return;

    const selection = window.getSelection();
    let range = lastRange.current;

    if (selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed) {
      range = selection.getRangeAt(0);
    }

    if (range && !range.collapsed) {
      el.focus({ preventScroll: true });
      selection?.removeAllRanges();
      selection?.addRange(range);

      if (type === 'color') {
        document.execCommand('foreColor', false, value as string);
      } else {
        document.execCommand('fontSize', false, '7');
        const fontTags = el.getElementsByTagName('font');
        let newTarget: HTMLElement | null = null;
        for (let i = 0; i < fontTags.length; i++) {
          const f = fontTags[i];
          if (f.size === '7') {
            f.removeAttribute('size');
            f.style.fontSize = value + 'px';
            newTarget = f;
          }
        }
        
        // 시각적 하이라이트 복구 로직
        if (newTarget) {
          const newRange = document.createRange();
          newRange.selectNodeContents(newTarget);
          selection?.removeAllRanges();
          selection?.addRange(newRange);
          lastRange.current = newRange;
        }
      }
      
      updateText(editingId, { content: el.innerHTML });

      // 브라우저 렌더링 사이클 이후 한 번 더 선택 영역 보강 (하이라이트 가시성 보장)
      requestAnimationFrame(() => {
        if (lastRange.current && selection) {
          selection.removeAllRanges();
          selection.addRange(lastRange.current);
        }
      });
    } else {
      if (type === 'color') updateText(editingId, { color: value as string });
      else updateText(editingId, { fontSize: (value as number) });
    }
  };

  return { texts, setTexts, editingId, setEditingId, addText, updateText, deleteText: (id: string) => setTexts(prev => prev.filter(t => t.id !== id)), cleanEmptyTexts, applyStyle, saveSelection };
}

/** 자르기 로직 모듈 */
function useCropLogic() {
  const [pendingCrop, setPendingCrop] = useState<CropRect | null>(null);
  const [confirmedCrop, setConfirmedCrop] = useState<CropRect | null>(null);
  const cropStart = useRef<{ x: number; y: number } | null>(null);

  const startCrop = (pos: { x: number; y: number }) => {
    cropStart.current = pos;
    setPendingCrop({ ...pos, w: 0, h: 0 });
  };
  const moveCrop = (pos: { x: number; y: number }) => {
    if (!cropStart.current) return;
    const s = cropStart.current;
    setPendingCrop({ x: Math.min(s.x, pos.x), y: Math.min(s.y, pos.y), w: Math.abs(pos.x - s.x), h: Math.abs(pos.y - s.y) });
  };
  const applyCrop = () => {
    if (pendingCrop && pendingCrop.w > 10) setConfirmedCrop(pendingCrop);
    setPendingCrop(null);
  };

  return { pendingCrop, setPendingCrop, confirmedCrop, setConfirmedCrop, startCrop, moveCrop, applyCrop, cropStart };
}

// --- Main Component ---

export default function ImageEditor({ imageUrl, onSave, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offCanvasRef = useRef<HTMLCanvasElement | null>(null); // 재사용할 오프스크린 캔버스
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [windowSize, setWindowSize] = useState({ w: 0, h: 0 }); // 창 크기 추적용

  // 도구별 설정 상태 (이들은 UI 제어용으로 메인에 둠)
  const [textColor, setTextColor] = useState('#FF0000');
  const [textSize, setTextSize] = useState(28);

  // 모듈화된 로직들
  const draw = useDrawLogic();
  const text = useTextLogic(textSize, textColor);
  const crop = useCropLogic();

  // History 시스템
  const [history, setHistory] = useState<any[]>([]);
  
  const pushHistory = useCallback(() => {
    const snapshot = {
      paths: JSON.parse(JSON.stringify(draw.paths)),
      texts: JSON.parse(JSON.stringify(text.texts)),
      crop: JSON.parse(JSON.stringify(crop.confirmedCrop))
    };
    setHistory(prev => [...prev.slice(-19), snapshot]); // 최대 20개 저장
  }, [draw.paths, text.texts, crop.confirmedCrop]);

  const undo = useCallback(() => {
    setHistory(prevStack => {
      if (prevStack.length === 0) return prevStack;
      const nextStack = [...prevStack];
      const prev = nextStack.pop();
      draw.setPaths(prev.paths);
      text.setTexts(prev.texts);
      crop.setConfirmedCrop(prev.crop);
      return nextStack;
    });
  }, [draw, text, crop]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo]);

  useEffect(() => {
    const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    handleResize(); // 초기값 설정
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const i = new Image(); i.crossOrigin = 'anonymous'; i.src = imageUrl; i.onload = () => setImg(i);
  }, [imageUrl]);

  const getLayout = useCallback(() => {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r || !img) return null;
    const src = (crop.confirmedCrop && crop.confirmedCrop.w > 10) ? crop.confirmedCrop : { x: 0, y: 0, w: img.width, h: img.height };
    const a = src.w / src.h, ca = r.width / r.height;
    let dw, dh;
    if (a > ca) { dw = r.width; dh = dw / a; }
    else { dh = r.height; dw = dh * a; }
    return { src, dw, dh, ox: 0, oy: 0, sx: dw / src.w, sy: dh / src.h, rect: r };
  }, [img, crop.confirmedCrop, windowSize]); // windowSize 추가로 반응형 보장

  const toImgCoords = (clientX: number, clientY: number) => {
    const c = canvasRef.current;
    const L = getLayout();
    if (!c || !L) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    return { 
      x: (clientX - rect.left) / L.sx + L.src.x, 
      y: (clientY - rect.top) / L.sy + L.src.y 
    };
  };

  const paint = useCallback(() => {
    const c = canvasRef.current; if (!c || !img) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const L = getLayout(); if (!L) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, L.dw, L.dh);
    ctx.drawImage(img, L.src.x, L.src.y, L.src.w, L.src.h, 0, 0, L.dw, L.dh);

    // 2. 형광펜 레이어 (중첩 시 진해짐 방지)
    const highlightPaths = draw.paths.filter(p => p.mode === 'highlight');
    if (highlightPaths.length > 0) {
      if (!offCanvasRef.current) offCanvasRef.current = document.createElement('canvas');
      const offCanvas = offCanvasRef.current;
      if (offCanvas.width !== c.width || offCanvas.height !== c.height) {
        offCanvas.width = c.width; offCanvas.height = c.height;
      }
      const offCtx = offCanvas.getContext('2d')!;
      offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
      offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      highlightPaths.forEach(p => {
        offCtx.fillStyle = p.color;
        const hh = p.width * 0.8 * L.sx; // 높이 축소 (1.5 -> 0.8)
        for (let i = 0; i < p.points.length - 1; i++) {
          const p1 = p.points[i], p2 = p.points[i+1];
          const x1 = (p1.x - L.src.x) * L.sx;
          const y1 = (p1.y - L.src.y) * L.sx; // sy 대신 sx 사용 (정사각형 비율 유지)
          const x2 = (p2.x - L.src.x) * L.sx;
          const y2 = (p2.y - L.src.y) * L.sx;
          offCtx.beginPath();
          offCtx.moveTo(x1, y1 - hh); offCtx.lineTo(x2, y2 - hh);
          offCtx.lineTo(x2, y2 + hh); offCtx.lineTo(x1, y1 + hh);
          offCtx.fill();
        }
      });
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.drawImage(offCanvas, 0, 0, L.dw, L.dh);
      ctx.restore();
    }

    // 3. 일반 펜 레이어
    draw.paths.filter(p => p.mode === 'pen').forEach(p => {
      ctx.beginPath();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.width * L.sx;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo((p.points[0].x - L.src.x) * L.sx, (p.points[0].y - L.src.y) * L.sy);
      p.points.slice(1).forEach(pt => ctx.lineTo((pt.x - L.src.x) * L.sx, (pt.y - L.src.y) * L.sy));
      ctx.stroke();
    });

    if (crop.pendingCrop && crop.pendingCrop.w > 0) {
      const cx = (crop.pendingCrop.x - L.src.x) * L.sx, cy = (crop.pendingCrop.y - L.src.y) * L.sy;
      const cw = crop.pendingCrop.w * L.sx, ch = crop.pendingCrop.h * L.sy;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, L.dw, L.dh);
      ctx.clearRect(cx, cy, cw, ch);
      ctx.drawImage(img, crop.pendingCrop.x, crop.pendingCrop.y, crop.pendingCrop.w, crop.pendingCrop.h, cx, cy, cw, ch);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(cx, cy, cw, ch);
    }
  }, [img, draw.paths, text.texts, crop.pendingCrop, getLayout]);

  useEffect(() => {
    const c = canvasRef.current, L = getLayout();
    if (!c || !L) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== L.dw * dpr || c.height !== L.dh * dpr) {
      c.width = L.dw * dpr; c.height = L.dh * dpr;
      c.style.width = L.dw + 'px'; c.style.height = L.dh + 'px';
    }
  }, [getLayout]); // paint 대신 레이아웃 정보에 의존

  useEffect(() => {
    paint();
  }, [paint]);

  const onCanvasDown = (e: ReactMouseEvent) => {
    const wasEditing = !!text.editingId;
    text.cleanEmptyTexts();
    
    if (tool === 'text' && wasEditing) return;

    const pos = toImgCoords(e.clientX, e.clientY);
    if (!pos) return;

    // 작업 시작 전 현재 상태 저장
    pushHistory();

    if (tool === 'draw' || tool === 'highlight') {
      draw.startDrawing(pos, tool === 'highlight' ? 'highlight' : 'pen');
    } else if (tool === 'text') {
      const L = getLayout(); text.addText(pos, L?.sx || 1);
    } else if (tool === 'crop') {
      crop.startCrop(pos);
    }
  };

  const onCanvasMove = (e: ReactMouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY }); // 프리뷰 좌표 업데이트
    const pos = toImgCoords(e.clientX, e.clientY);
    if (tool === 'crop') crop.moveCrop(pos);
    else if (tool === 'draw' || tool === 'highlight') draw.moveDrawing(pos);
  };

  const onCanvasUp = () => { 
    if (tool === 'draw' || tool === 'highlight') {
      draw.stopDrawing();
    }
    (crop as any).cropStart.current = null; 
  };

  const handleApplyCrop = () => {
    pushHistory();
    crop.applyCrop();
  };

  const handleSave = () => {
    if (!img) return;
    const L = getLayout(); if (!L) return;
    const cv = document.createElement('canvas'); cv.width = L.src.w; cv.height = L.src.h;
    const ctx = cv.getContext('2d')!;
    ctx.drawImage(img, L.src.x, L.src.y, L.src.w, L.src.h, 0, 0, L.src.w, L.src.h);
    
    // 2. 형광펜 저장 (레이어 합성)
    const highlightPaths = draw.paths.filter(p => p.mode === 'highlight');
    if (highlightPaths.length > 0) {
      const offCanvas = document.createElement('canvas');
      offCanvas.width = L.src.w; offCanvas.height = L.src.h;
      const offCtx = offCanvas.getContext('2d')!;
      highlightPaths.forEach(p => {
        offCtx.fillStyle = p.color;
        const hh = p.width * 0.8; // 저장 시에도 비율 동일하게
        const ox = L.src.x, oy = L.src.y;
        for (let i = 0; i < p.points.length - 1; i++) {
          const p1 = p.points[i], p2 = p.points[i+1];
          offCtx.beginPath();
          offCtx.moveTo(p1.x - ox, (p1.y - oy) - hh);
          offCtx.lineTo(p2.x - ox, (p2.y - oy) - hh);
          offCtx.lineTo(p2.x - ox, (p2.y - oy) + hh);
          offCtx.lineTo(p1.x - ox, (p1.y - oy) + hh);
          offCtx.fill();
        }
      });
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.drawImage(offCanvas, 0, 0);
      ctx.restore();
    }

    // 3. 일반 펜 저장
    draw.paths.filter(p => p.mode === 'pen').forEach(p => {
      ctx.beginPath();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(p.points[0].x - L.src.x, p.points[0].y - L.src.y);
      p.points.slice(1).forEach(pt => ctx.lineTo(pt.x - L.src.x, pt.y - L.src.y));
      ctx.stroke();
    });

    text.texts.forEach(t => {
      if (!t.content.trim()) return;
      
      const temp = document.createElement('div');
      temp.style.position = 'absolute';
      temp.style.visibility = 'hidden';
      temp.style.font = `bold ${t.fontSize}px Inter, sans-serif`;
      temp.innerHTML = t.content;
      document.body.appendChild(temp);
      
      let currentX = t.x - L.src.x;
      const baseBaseline = t.y - L.src.y + t.fontSize;

      const renderNode = (node: Node, fontSize: number, color: string) => {
        if (node.nodeType === Node.TEXT_NODE) {
          ctx.font = `bold ${fontSize}px Inter, sans-serif`;
          ctx.fillStyle = color;
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(node.textContent || '', currentX, baseBaseline);
          currentX += ctx.measureText(node.textContent || '').width;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const nodeColor = el.style.color || color;
          const nodeSize = el.style.fontSize ? parseInt(el.style.fontSize) : fontSize;
          el.childNodes.forEach(child => renderNode(child, nodeSize, nodeColor));
        }
      };

      temp.childNodes.forEach(node => renderNode(node, t.fontSize, t.color));
      document.body.removeChild(temp);
    });
    
    onSave(cv.toDataURL('image/png'));
  };

  const PRESET_COLORS = ['#000000', '#FF0000', '#FFFF00', '#00FF00', '#0000FF', '#FFFFFF'];

  const handleColorChange = (color: string) => {
    if (tool === 'draw' || tool === 'highlight') {
      draw.setDrawColor(color);
    } else {
      setTextColor(color);
      text.applyStyle('color', color);
    }
  };

  const handleSizeChange = (newSize: number) => {
    setTextSize(newSize);
    text.applyStyle('size', newSize);
  };

  return (
    <div className={styles.editorRoot}>
      <div className={styles.toolbar}>
        <button className={styles.undoBtn} onClick={undo} disabled={history.length === 0} title="되돌리기 (Ctrl+Z)">↩️</button>
        <span className={styles.toolbarTitle}>✏️ 편집</span>
        <div className={styles.toolGroup}>
          {(['select', 'crop', 'draw', 'highlight', 'text'] as Tool[]).map(t => (
            <button key={t} className={`${styles.toolBtn} ${tool === t ? styles.active : ''}`} onClick={() => setTool(t)}>
              {t === 'select' ? '↖' : t === 'crop' ? '✂️' : t === 'draw' ? '🖊' : t === 'highlight' ? (
                <div style={{ width: '12px', height: '20px', background: '#FFD700', borderRadius: '2px' }} />
              ) : 'T'}
            </button>
          ))}
        </div>

        {/* 컬러 팔레트 섹션 (그리기, 형광펜 또는 텍스트 도구일 때 표시) */}
        {(tool === 'draw' || tool === 'highlight' || tool === 'text' || text.editingId) && (
          <div className={styles.toolOptions}>
            <div className={styles.colorPalette}>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  className={styles.colorCircle}
                  style={{ backgroundColor: c, border: (tool === 'draw' || tool === 'highlight' ? draw.drawColor : textColor) === c ? '2px solid #3b82f6' : '1px solid #4b5563' }}
                  onClick={() => handleColorChange(c)}
                />
              ))}
              <div className={styles.customColorWrapper}>
                <input 
                  type="color" 
                  className={styles.rainbowInput}
                  value={tool === 'draw' || tool === 'highlight' ? draw.drawColor : textColor} 
                  onChange={e => handleColorChange(e.target.value)} 
                />
                <div className={styles.colorWheelIcon} />
              </div>
            </div>
            
            {/* 굵기/크기 조절 (슬라이더 + 숫자 입력) */}
            <div className={styles.sizeControlGroup}>
              {tool === 'draw' || tool === 'highlight' ? (
                <>
                  <input type="range" min={1} max={50} value={draw.drawWidth} onChange={e => draw.setDrawWidth(+e.target.value)} />
                  <input type="number" className={styles.sizeNumberInput} min={1} max={50} value={draw.drawWidth} onChange={e => draw.setDrawWidth(+e.target.value)} />
                </>
              ) : (
                <>
                  <input type="range" min={12} max={150} value={textSize} onChange={e => handleSizeChange(+e.target.value)} />
                  <input type="number" className={styles.sizeNumberInput} min={12} max={150} value={textSize} onChange={e => handleSizeChange(+e.target.value)} />
                </>
              )}
            </div>
          </div>
        )}

        {tool === 'crop' && crop.pendingCrop?.w! > 10 && (
          <button className={styles.actionBtn} onClick={handleApplyCrop}>✅ 적용</button>
        )}
        <div className={styles.spacer} />
        <button className={styles.saveBtn} onClick={handleSave}>💾 저장</button>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div ref={containerRef} className={styles.canvasArea} style={{ cursor: tool === 'highlight' ? 'none' : 'crosshair' }}>
        {(() => {
          const L = getLayout();
          return (
            <div style={{ 
              position: 'relative', 
              width: L?.dw || '100%', 
              height: L?.dh || '100%',
              display: L ? 'block' : 'none' // 레이아웃 준비 전까지 숨김
            }}>
              <canvas ref={canvasRef} className={styles.canvas} onMouseDown={onCanvasDown} onMouseMove={onCanvasMove} onMouseUp={onCanvasUp} onMouseLeave={onCanvasUp} />
              
              {L && (
                <div style={{ position: 'absolute', left: 0, top: 0, width: L.dw, height: L.dh, pointerEvents: 'none' }}>
                  {text.texts.map(t => (
                    <TextBox key={t.id} t={t} isEditing={text.editingId === t.id} layout={L} tool={tool}
                      onStartEdit={() => text.setEditingId(t.id)}
                      onChange={(next: any) => text.updateText(t.id, next)}
                      onDelete={() => { pushHistory(); text.deleteText(t.id); }}
                      onSelectionChange={text.saveSelection}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()}
        
        {/* 형광펜 커서 프리뷰 (전체 영역 기준 유지) */}
        {tool === 'highlight' && (
          <div style={{
            position: 'fixed',
            left: mousePos.x,
            top: mousePos.y,
            width: Math.max(8, (draw.drawWidth * 4 * (getLayout()?.sx || 1)) / 4) + 'px', 
            height: (draw.drawWidth * 4 * (getLayout()?.sx || 1)) * 1.6 + 'px', 
            backgroundColor: draw.drawColor,
            opacity: 0.5,
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            borderRadius: '1px',
            border: '1px solid rgba(255,255,255,0.5)'
          }} />
        )}
      </div>
    </div>
  );
}

// --- Sub Component: TextBox ---

function TextBox({ t, isEditing, layout, tool, onStartEdit, onChange, onDelete, onSelectionChange }: any) {
  const dragStart = useRef<any>(null);
  const [dragging, setDragging] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && editRef.current) {
      const el = editRef.current;
      // 편집 시작 시점에만 딱 한 번 HTML 주입 (중간에 주입하면 selection이 파괴됨)
      if (el.innerHTML !== t.content) {
        el.innerHTML = t.content;
      }

      const timer = setTimeout(() => {
        el.focus({ preventScroll: true });
        const sel = window.getSelection();
        if (sel && el.childNodes.length > 0) {
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isEditing]);

  const onMouseDown = (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      onStartEdit();
      return;
    }
    // 수정 중일 때만 테두리(Wrapper) 드래그 이동 가능
    if (e.target === e.currentTarget) {
      setDragging(true);
      dragStart.current = { mx: e.clientX, my: e.clientY, ox: t.x, oy: t.y };
    }
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      if (!dragStart.current) return;
      const dx = (e.clientX - dragStart.current.mx) / layout.sx;
      const dy = (e.clientY - dragStart.current.my) / layout.sy;
      onChange({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
    };
    const up = () => { setDragging(false); dragStart.current = null; };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [dragging, layout.sx, layout.sy, onChange]);

  const sx = (t.x - layout.src.x) * layout.sx, sy = (t.y - layout.src.y) * layout.sy;
  const fs = t.fontSize * layout.sx;

  return (
    <div className={styles.textBox} 
      onMouseDown={onMouseDown}
      data-editing={isEditing}
      onMouseUp={onSelectionChange}
      onKeyUp={onSelectionChange}
      style={{
        left: sx - 8, top: sy - 8, fontSize: fs + 'px', color: t.color,
        border: `2px solid ${isEditing ? '#3b82f6' : 'transparent'}`, // 테두리 두께 고정하여 점프 방지
        pointerEvents: (tool === 'text' || tool === 'select') ? 'auto' : 'none',
        background: isEditing ? 'rgba(0,0,0,0.3)' : 'transparent',
      }}>
      <div ref={editRef} 
        id={`edit-${t.id}`}
        contentEditable={isEditing} 
        suppressContentEditableWarning
        onInput={e => {
          onChange({ content: (e.target as HTMLDivElement).innerHTML });
        }}
        style={{ 
          outline: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word', 
          cursor: isEditing ? 'text' : 'inherit', minWidth: '10px',
          display: 'inline-block' // 박스 크기 동적 축소를 위해 추가
        }}
        dangerouslySetInnerHTML={!isEditing ? { __html: t.content } : undefined}
      />
      {isEditing && (
        <button className={styles.textDeleteBtn} onMouseDown={e => { e.stopPropagation(); onDelete(); }}
          style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      )}
    </div>
  );
}
