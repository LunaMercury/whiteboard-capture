import { useEffect, useRef, useState, useCallback, MouseEvent as ReactMouseEvent } from 'react';
import styles from './ImageEditor.module.css';

// --- Types ---
type Tool = 'select' | 'crop' | 'draw' | 'text';
interface TextObj { id: string; x: number; y: number; content: string; fontSize: number; color: string; }
interface DrawPath { points: { x: number; y: number }[]; color: string; width: number; }
interface CropRect { x: number; y: number; w: number; h: number; }

interface Props { imageUrl: string; onSave: (dataUrl: string) => void; onClose: () => void; }

// --- Modular Hooks ---

/** 그리기 로직 모듈 */
function useDrawLogic() {
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [drawColor, setDrawColor] = useState('#FF0000');
  const [drawWidth, setDrawWidth] = useState(3);
  const isDrawing = useRef(false);

  const startDrawing = (pos: { x: number; y: number }) => {
    isDrawing.current = true;
    setPaths(prev => [...prev, { points: [pos], color: drawColor, width: drawWidth }]);
  };
  const moveDrawing = (pos: { x: number; y: number }) => {
    if (!isDrawing.current) return;
    setPaths(prev => {
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), { ...last, points: [...last.points, pos] }];
    });
  };
  const stopDrawing = () => { isDrawing.current = false; };

  return { paths, setPaths, drawColor, setDrawColor, drawWidth, setDrawWidth, startDrawing, moveDrawing, stopDrawing };
}

/** 텍스트 로직 모듈 */
function useTextLogic(textSize: number, textColor: string) {
  const [texts, setTexts] = useState<TextObj[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const addText = (pos: { x: number; y: number }, sx: number) => {
    const id = `t${Date.now()}`;
    setTexts(prev => [...prev, { id, ...pos, content: '', fontSize: textSize / sx, color: textColor }]);
    setEditingId(id);
  };

  const updateText = (id: string, next: Partial<TextObj>) => {
    setTexts(prev => prev.map(t => t.id === id ? { ...t, ...next } : t));
  };

  const deleteText = (id: string) => {
    setTexts(prev => prev.filter(t => t.id !== id));
  };

  const cleanEmptyTexts = () => {
    if (editingId) {
      setTexts(prev => prev.filter(t => t.id !== editingId || t.content.trim() !== ''));
      setEditingId(null);
    }
  };

  return { texts, setTexts, editingId, setEditingId, addText, updateText, deleteText, cleanEmptyTexts };
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

  return { pendingCrop, setPendingCrop, confirmedCrop, setConfirmedCrop, startCrop, moveCrop, applyCrop };
}

// --- Main Component ---

export default function ImageEditor({ imageUrl, onSave, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>('select');

  // 도구별 설정 상태 (이들은 UI 제어용으로 메인에 둠)
  const [textColor, setTextColor] = useState('#FF0000');
  const [textSize, setTextSize] = useState(28);

  // 모듈화된 로직들
  const draw = useDrawLogic();
  const text = useTextLogic(textSize, textColor);
  const crop = useCropLogic();

  useEffect(() => {
    const i = new Image(); i.crossOrigin = 'anonymous'; i.src = imageUrl; i.onload = () => setImg(i);
  }, [imageUrl]);

  const getLayout = useCallback(() => {
    const c = canvasRef.current; if (!c || !img) return null;
    const r = c.getBoundingClientRect();
    const src = (crop.confirmedCrop && crop.confirmedCrop.w > 10) ? crop.confirmedCrop : { x: 0, y: 0, w: img.width, h: img.height };
    const a = src.w / src.h, ca = r.width / r.height;
    let dw, dh, ox, oy;
    if (a > ca) { dw = r.width; dh = dw / a; ox = 0; oy = (r.height - dh) / 2; }
    else { dh = r.height; dw = dh * a; ox = (r.width - dw) / 2; oy = 0; }
    return { src, dw, dh, ox, oy, sx: dw / src.w, sy: dh / src.h, rect: r };
  }, [img, crop.confirmedCrop]);

  const toImgCoords = (clientX: number, clientY: number) => {
    const L = getLayout(); if (!L) return { x: 0, y: 0 };
    return { x: (clientX - L.rect.left - L.ox) / L.sx + L.src.x, y: (clientY - L.rect.top - L.oy) / L.sy + L.src.y };
  };

  const paint = useCallback(() => {
    const c = canvasRef.current; if (!c || !img) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const L = getLayout(); if (!L) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, L.rect.width, L.rect.height);
    ctx.drawImage(img, L.src.x, L.src.y, L.src.w, L.src.h, L.ox, L.oy, L.dw, L.dh);

    draw.paths.forEach(p => {
      ctx.beginPath(); ctx.strokeStyle = p.color; ctx.lineWidth = p.width * L.sx;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.moveTo((p.points[0].x - L.src.x) * L.sx + L.ox, (p.points[0].y - L.src.y) * L.sy + L.oy);
      p.points.slice(1).forEach(pt => ctx.lineTo((pt.x - L.src.x) * L.sx + L.ox, (pt.y - L.src.y) * L.sy + L.oy));
      ctx.stroke();
    });

    if (crop.pendingCrop && crop.pendingCrop.w > 0) {
      const cx = (crop.pendingCrop.x - L.src.x) * L.sx + L.ox, cy = (crop.pendingCrop.y - L.src.y) * L.sy + L.oy;
      const cw = crop.pendingCrop.w * L.sx, ch = crop.pendingCrop.h * L.sy;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(L.ox, L.oy, L.dw, L.dh);
      ctx.clearRect(cx, cy, cw, ch);
      ctx.drawImage(img, crop.pendingCrop.x, crop.pendingCrop.y, crop.pendingCrop.w, crop.pendingCrop.h, cx, cy, cw, ch);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(cx, cy, cw, ch);
    }
  }, [img, draw.paths, crop.pendingCrop, getLayout]);

  useEffect(() => {
    const c = canvasRef.current, r = containerRef.current?.getBoundingClientRect();
    if (!c || !r) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = r.width * dpr; c.height = r.height * dpr;
    c.style.width = r.width + 'px'; c.style.height = r.height + 'px';
    paint();
  }, [img, paint]);

  const onCanvasDown = (e: ReactMouseEvent) => {
    if (text.editingId) { text.cleanEmptyTexts(); return; }
    const pos = toImgCoords(e.clientX, e.clientY);
    if (tool === 'crop') crop.startCrop(pos);
    else if (tool === 'draw') draw.startDrawing(pos);
    else if (tool === 'text') { const L = getLayout(); text.addText(pos, L?.sx || 1); }
  };

  const onCanvasMove = (e: ReactMouseEvent) => {
    const pos = toImgCoords(e.clientX, e.clientY);
    if (tool === 'crop') crop.moveCrop(pos);
    else if (tool === 'draw') draw.moveDrawing(pos);
  };

  const onCanvasUp = () => { draw.stopDrawing(); };

  const handleSave = () => {
    if (!img) return;
    const L = getLayout(); if (!L) return;
    const cv = document.createElement('canvas'); cv.width = L.src.w; cv.height = L.src.h;
    const ctx = cv.getContext('2d')!;
    ctx.drawImage(img, L.src.x, L.src.y, L.src.w, L.src.h, 0, 0, L.src.w, L.src.h);
    draw.paths.forEach(p => {
      ctx.beginPath(); ctx.strokeStyle = p.color; ctx.lineWidth = p.width;
      ctx.moveTo(p.points[0].x - L.src.x, p.points[0].y - L.src.y);
      p.points.slice(1).forEach(pt => ctx.lineTo(pt.x - L.src.x, pt.y - L.src.y));
      ctx.stroke();
    });
    text.texts.forEach(t => {
      if (!t.content.trim()) return;
      ctx.font = `bold ${t.fontSize}px Inter, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.content, t.x - L.src.x, t.y - L.src.y + t.fontSize);
    });
    onSave(cv.toDataURL('image/png'));
  };

  const PRESET_COLORS = ['#000000', '#FF0000', '#FFFF00', '#00FF00', '#0000FF', '#FFFFFF'];

  const handleColorChange = (color: string) => {
    if (tool === 'draw') {
      draw.setDrawColor(color);
    } else {
      setTextColor(color);
      // 현재 편집 중인 텍스트가 있으면 즉시 반영
      if (text.editingId) {
        text.updateText(text.editingId, { color });
      }
    }
  };

  return (
    <div className={styles.editorRoot}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarTitle}>✏️ 편집</span>
        <div className={styles.toolGroup}>
          {(['select', 'crop', 'draw', 'text'] as Tool[]).map(t => (
            <button key={t} className={`${styles.toolBtn} ${tool === t ? styles.active : ''}`} onClick={() => setTool(t)}>
              {t === 'select' ? '↖' : t === 'crop' ? '✂️' : t === 'draw' ? '🖊' : 'T'}
            </button>
          ))}
        </div>

        {/* 컬러 팔레트 섹션 (그리기 또는 텍스트 도구일 때 표시) */}
        {(tool === 'draw' || tool === 'text' || text.editingId) && (
          <div className={styles.toolOptions}>
            <div className={styles.colorPalette}>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  className={styles.colorCircle}
                  style={{ backgroundColor: c, border: (tool === 'draw' ? draw.drawColor : textColor) === c ? '2px solid #3b82f6' : '1px solid #4b5563' }}
                  onClick={() => handleColorChange(c)}
                />
              ))}
              <div className={styles.customColorWrapper}>
                <input 
                  type="color" 
                  className={styles.rainbowInput}
                  value={tool === 'draw' ? draw.drawColor : textColor} 
                  onChange={e => handleColorChange(e.target.value)} 
                />
                <div className={styles.colorWheelIcon} />
              </div>
            </div>
            
            {/* 굵기/크기 조절 (슬라이더 + 숫자 입력) */}
            <div className={styles.sizeControlGroup}>
              {tool === 'draw' ? (
                <>
                  <input type="range" min={1} max={50} value={draw.drawWidth} onChange={e => draw.setDrawWidth(+e.target.value)} />
                  <input type="number" className={styles.sizeNumberInput} min={1} max={50} value={draw.drawWidth} onChange={e => draw.setDrawWidth(+e.target.value)} />
                </>
              ) : (
                <>
                  <input type="range" min={12} max={150} value={textSize} onChange={e => {
                    const newSize = +e.target.value;
                    setTextSize(newSize);
                    if (text.editingId) {
                      const L = getLayout();
                      text.updateText(text.editingId, { fontSize: newSize / (L?.sx || 1) });
                    }
                  }} />
                  <input type="number" className={styles.sizeNumberInput} min={12} max={150} value={textSize} onChange={e => {
                    const newSize = +e.target.value;
                    setTextSize(newSize);
                    if (text.editingId) {
                      const L = getLayout();
                      text.updateText(text.editingId, { fontSize: newSize / (L?.sx || 1) });
                    }
                  }} />
                </>
              )}
            </div>
          </div>
        )}

        {tool === 'crop' && crop.pendingCrop?.w! > 10 && (
          <button className={styles.actionBtn} onClick={crop.applyCrop}>✅ 적용</button>
        )}
        <div className={styles.spacer} />
        <button className={styles.saveBtn} onClick={handleSave}>💾 저장</button>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div ref={containerRef} className={styles.canvasArea}>
        <canvas ref={canvasRef} className={styles.canvas} onMouseDown={onCanvasDown} onMouseMove={onCanvasMove} onMouseUp={onCanvasUp} onMouseLeave={onCanvasUp} />
        {(() => {
          const L = getLayout(); if (!L) return null;
          return (
            <div style={{ position: 'absolute', left: L.ox, top: L.oy, width: L.dw, height: L.dh, pointerEvents: 'none' }}>
              {text.texts.map(t => (
                <TextBox key={t.id} t={t} isEditing={text.editingId === t.id} layout={L} tool={tool}
                  onStartEdit={() => text.setEditingId(t.id)}
                  onChange={(next: any) => text.updateText(t.id, next)}
                  onDelete={() => text.deleteText(t.id)}
                />
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// --- Sub Component: TextBox ---

function TextBox({ t, isEditing, layout, tool, onStartEdit, onChange, onDelete }: any) {
  const dragStart = useRef<any>(null);
  const [dragging, setDragging] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && editRef.current) {
      const el = editRef.current;
      // 편집 시작 시 초기값 주입 (React가 그리지 않으므로 직접 주입)
      if (el.innerText !== t.content) {
        el.innerText = t.content;
      }

      const timer = setTimeout(() => {
        el.focus();
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
  }, [isEditing, t.content]);

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
    <div className={styles.textBox} onMouseDown={onMouseDown}
      style={{
        left: sx, top: sy, fontSize: fs + 'px', color: t.color,
        border: isEditing ? '2px solid #3b82f6' : '1px solid transparent',
        pointerEvents: (tool === 'text' || tool === 'select') ? 'auto' : 'none',
        position: 'absolute', display: 'inline-flex', alignItems: 'center',
        padding: isEditing ? '8px' : '0px',
        minWidth: '40px', minHeight: '1.2em', background: isEditing ? 'rgba(0,0,0,0.3)' : 'transparent',
        cursor: isEditing ? 'move' : 'text'
      }}>
      <div ref={editRef} 
        contentEditable={isEditing} 
        suppressContentEditableWarning
        onInput={e => {
          // 부모 상태만 업데이트하고, DOM 자식은 React가 건드리지 않게 함
          onChange({ content: (e.target as HTMLDivElement).innerText });
        }}
        style={{ 
          outline: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word', 
          cursor: isEditing ? 'text' : 'inherit', minWidth: '10px'
        }}
      >
        {!isEditing && t.content}
      </div>
      {isEditing && (
        <button className={styles.textDeleteBtn} onMouseDown={e => { e.stopPropagation(); onDelete(); }}
          style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      )}
    </div>
  );
}
