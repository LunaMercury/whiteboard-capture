import { useEffect, useRef, useState, useCallback, MouseEvent as ReactMouseEvent } from 'react';
import styles from './ImageEditor.module.css';

const PRESET_COLORS = ['#000000', '#FF0000', '#FFFF00', '#00FF00', '#0000FF', '#FFFFFF'];

interface Props { imageUrl: string; onSave: (dataUrl: string) => void; onClose: () => void; }
type Tool = 'select' | 'crop' | 'text' | 'draw';
interface TextObj { id: string; x: number; y: number; html: string; fontSize: number; color: string; }
interface DrawPath { points: { x: number; y: number }[]; color: string; width: number; }
interface CropRect { x: number; y: number; w: number; h: number; }

export default function ImageEditor({ imageUrl, onSave, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [drawColor, setDrawColor] = useState('#FF0000');
  const [drawWidth, setDrawWidth] = useState(3);
  const isDrawing = useRef(false);
  const currentPathRef = useRef<DrawPath | null>(null);
  const [texts, setTexts] = useState<TextObj[]>([]);
  const [textColor, setTextColor] = useState('#FF0000');
  const [textSize, setTextSize] = useState(28);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingCrop, setPendingCrop] = useState<CropRect | null>(null);
  const [confirmedCrop, setConfirmedCrop] = useState<CropRect | null>(null);
  const cropStart = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<string[]>([]);
  // blur 후 새 텍스트 생성을 막기 위한 플래그
  const justCommitted = useRef(false);
  const lastSelection = useRef<Range | null>(null);

  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editingId) {
        const range = sel.getRangeAt(0);
        if (areaRef.current?.contains(range.commonAncestorContainer)) {
          lastSelection.current = range.cloneRange();
        }
      }
    };
    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, [editingId]);

  const saveSnap = useCallback(() => {
    historyRef.current.push(JSON.stringify({ paths, texts, confirmedCrop }));
    if (historyRef.current.length > 30) historyRef.current.shift();
  }, [paths, texts, confirmedCrop]);
  const undo = () => { const s = historyRef.current.pop(); if (s) { const d = JSON.parse(s); setPaths(d.paths); setTexts(d.texts); setConfirmedCrop(d.confirmedCrop); } };

  useEffect(() => { const i = new Image(); i.crossOrigin = 'anonymous'; i.src = imageUrl; i.onload = () => setImg(i); }, [imageUrl]);

  const getLayout = useCallback(() => {
    const c = canvasRef.current; if (!c || !img) return null;
    const r = c.getBoundingClientRect();
    const src = (confirmedCrop && confirmedCrop.w > 10 && confirmedCrop.h > 10) ? confirmedCrop : { x: 0, y: 0, w: img.width, h: img.height };
    const a = src.w / src.h, ca = r.width / r.height;
    let dw: number, dh: number, ox: number, oy: number;
    if (a > ca) { dw = r.width; dh = dw / a; ox = 0; oy = (r.height - dh) / 2; }
    else { dh = r.height; dw = dh * a; ox = (r.width - dw) / 2; oy = 0; }
    return { src, dw, dh, ox, oy, sx: dw / src.w, sy: dh / src.h, rect: r };
  }, [img, confirmedCrop]);

  const toImg = useCallback((cx: number, cy: number) => {
    const L = getLayout(); if (!L) return { x: 0, y: 0 };
    return { x: (cx - L.rect.left - L.ox) / L.sx + L.src.x, y: (cy - L.rect.top - L.oy) / L.sy + L.src.y };
  }, [getLayout]);

  // Paint
  const paint = useCallback(() => {
    const c = canvasRef.current; if (!c || !img) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const L = getLayout(); if (!L) return;
    ctx.resetTransform(); ctx.clearRect(0, 0, c.width, c.height);
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, L.rect.width, L.rect.height);
    ctx.drawImage(img, L.src.x, L.src.y, L.src.w, L.src.h, L.ox, L.oy, L.dw, L.dh);
    for (const p of paths) {
      if (!p || p.points.length < 2) continue;
      ctx.beginPath(); ctx.strokeStyle = p.color; ctx.lineWidth = p.width * L.sx;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.moveTo((p.points[0].x - L.src.x) * L.sx + L.ox, (p.points[0].y - L.src.y) * L.sy + L.oy);
      for (let i = 1; i < p.points.length; i++) ctx.lineTo((p.points[i].x - L.src.x) * L.sx + L.ox, (p.points[i].y - L.src.y) * L.sy + L.oy);
      ctx.stroke();
    }
    if (pendingCrop && pendingCrop.w > 0 && pendingCrop.h > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(L.ox, L.oy, L.dw, L.dh);
      const cx2 = (pendingCrop.x - L.src.x) * L.sx + L.ox, cy2 = (pendingCrop.y - L.src.y) * L.sy + L.oy;
      const cw2 = pendingCrop.w * L.sx, ch2 = pendingCrop.h * L.sy;
      ctx.clearRect(cx2, cy2, cw2, ch2);
      ctx.drawImage(img, pendingCrop.x, pendingCrop.y, pendingCrop.w, pendingCrop.h, cx2, cy2, cw2, ch2);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); ctx.strokeRect(cx2, cy2, cw2, ch2); ctx.setLineDash([]);
    }
  }, [img, paths, pendingCrop, getLayout]);

  useEffect(() => {
    const c = canvasRef.current, a = areaRef.current;
    if (!c || !a || !img) return;
    const r = a.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    c.width = r.width * dpr; c.height = r.height * dpr;
    c.style.width = r.width + 'px'; c.style.height = r.height + 'px';
    paint();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img]);
  useEffect(() => { paint(); }, [paint]);
  useEffect(() => {
    const fn = () => { const c = canvasRef.current, a = areaRef.current; if (!c || !a) return; const r = a.getBoundingClientRect(); const d = window.devicePixelRatio || 1; c.width = r.width * d; c.height = r.height * d; c.style.width = r.width + 'px'; c.style.height = r.height + 'px'; paint(); };
    window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn);
  }, [paint]);

  const onCanvasDown = (e: React.MouseEvent) => {
    // 편집 중인 텍스트가 있으면 확정만 하고 새 텍스트 생성은 하지 않음
    if (editingId) { setEditingId(null); justCommitted.current = true; setTimeout(() => { justCommitted.current = false; }, 100); return; }
    if (justCommitted.current) return;

    const pos = toImg(e.clientX, e.clientY);
    if (tool === 'crop') { cropStart.current = pos; setPendingCrop({ x: pos.x, y: pos.y, w: 0, h: 0 }); }
    else if (tool === 'draw') {
      saveSnap(); isDrawing.current = true;
      currentPathRef.current = { points: [pos], color: drawColor, width: drawWidth };
      setPaths(prev => [...prev, currentPathRef.current!]);
    }
    else if (tool === 'text') {
      saveSnap();
      const pos = toImg(e.clientX, e.clientY);
      const id = `t${Date.now()}`;
      const L = getLayout();
      const fontSizeImg = L ? textSize / L.sx : textSize;
      setTexts(prev => [...prev, { id, x: pos.x, y: pos.y, html: '', fontSize: fontSizeImg, color: textColor }]);
      setEditingId(id);
    }
  };

  const onCanvasMove = (e: React.MouseEvent) => {
    const pos = toImg(e.clientX, e.clientY);
    if (tool === 'crop' && cropStart.current) {
      const s = cropStart.current;
      setPendingCrop({ x: Math.min(s.x, pos.x), y: Math.min(s.y, pos.y), w: Math.abs(pos.x - s.x), h: Math.abs(pos.y - s.y) });
    } else if (tool === 'draw' && isDrawing.current && currentPathRef.current) {
      const np: DrawPath = { ...currentPathRef.current, points: [...currentPathRef.current.points, pos] };
      currentPathRef.current = np;
      setPaths(prev => [...prev.slice(0, -1), np]);
    }
  };
  const onCanvasUp = () => { if (tool === 'crop') cropStart.current = null; if (tool === 'draw') { isDrawing.current = false; currentPathRef.current = null; } };

  const applyCrop = () => { if (!pendingCrop || pendingCrop.w < 10 || pendingCrop.h < 10) return; saveSnap(); setConfirmedCrop(pendingCrop); setPendingCrop(null); setTool('select'); };
  const resetCrop = () => { saveSnap(); setConfirmedCrop(null); setPendingCrop(null); setTool('select'); };

  const pasteImage = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) for (const type of item.types) if (type.startsWith('image/')) {
        const blob = await item.getType(type); const url = URL.createObjectURL(blob);
        const p = new Image(); p.onload = () => { if (!img) return; saveSnap();
          const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
          const cx = cv.getContext('2d')!; cx.drawImage(img, 0, 0);
          cx.drawImage(p, img.width / 2 - p.width / 2, img.height / 2 - p.height / 2);
          const m = new Image(); m.onload = () => setImg(m); m.src = cv.toDataURL('image/png'); URL.revokeObjectURL(url);
        }; p.src = url; return;
      }
      alert('클립보드에 이미지가 없습니다.');
    } catch { alert('클립보드 접근에 실패했습니다.'); }
  };

  // 선택된 텍스트에 스타일 적용
  const applyStyleToSelection = (style: 'color' | 'fontSize', value: string) => {
    if (!editingId) return;
    const range = lastSelection.current;
    const L = getLayout();
    const actualValue = style === 'fontSize' ? (parseInt(value) / (L ? L.sx : 1)) : value;

    if (!range || range.collapsed) {
      // 선택 영역 없으면 현재 텍스트 전체에 적용
      setTexts(prev => prev.map(t => t.id === editingId ? { ...t, [style]: actualValue } : t));
      return;
    }
    // 선택된 부분만 span으로 감싸기
    const span = document.createElement('span');
    if (style === 'color') span.style.color = value;
    else span.style.fontSize = actualValue + 'px';
    try {
      range.surroundContents(span);
      // 스타일 적용 후 선택 영역 복구 (슬라이더 조작 지속 가능하게)
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.addRange(newRange);
        lastSelection.current = newRange.cloneRange();
      }

      // 스타일 적용 후 HTML 상태 업데이트
      const activeBox = document.querySelector(`[data-text-id="${editingId}"] .${styles.textAreaInput}`) as HTMLDivElement;
      if (activeBox) {
        setTexts(prev => prev.map(t => t.id === editingId ? { ...t, html: activeBox.innerHTML } : t));
      }
    } catch (e) {
      // range가 여러 노드에 걸쳐있어 surroundContents가 실패할 경우 전체 텍스트에 적용
      setTexts(prev => prev.map(t => t.id === editingId ? { ...t, [style]: actualValue } : t));
    }
  };

  const handleSave = () => {
    if (!img) return;
    const area = areaRef.current; if (!area) return;
    const src = (confirmedCrop && confirmedCrop.w > 10 && confirmedCrop.h > 10) ? confirmedCrop : { x: 0, y: 0, w: img.width, h: img.height };
    const cv = document.createElement('canvas'); cv.width = src.w; cv.height = src.h;
    const ctx = cv.getContext('2d')!;
    ctx.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, src.w, src.h);
    for (const p of paths) {
      if (!p || p.points.length < 2) continue;
      ctx.beginPath(); ctx.strokeStyle = p.color; ctx.lineWidth = p.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.moveTo(p.points[0].x - src.x, p.points[0].y - src.y);
      for (let i = 1; i < p.points.length; i++) ctx.lineTo(p.points[i].x - src.x, p.points[i].y - src.y);
      ctx.stroke();
    }
    // 텍스트를 이미지에 굽기: DOM → foreignObject SVG → Canvas
    const r = area.getBoundingClientRect();
    const a2 = src.w / src.h, ca = r.width / r.height;
    let dw: number, dh: number;
    if (a2 > ca) { dw = r.width; dh = dw / a2; }
    else { dh = r.height; dw = dh * a2; }
    for (const t of texts) {
      if (!t.html.trim()) continue;
      const ix = t.x - src.x, iy = t.y - src.y;
      ctx.font = `bold ${t.fontSize}px Inter, sans-serif`;
      ctx.fillStyle = t.color; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
      // strip HTML tags for canvas rendering
      const plain = t.html.replace(/<[^>]*>/g, '');
      ctx.strokeText(plain, ix, iy); ctx.fillText(plain, ix, iy);
    }
    onSave(cv.toDataURL('image/png'));
  };

  return (
    <div className={styles.editorRoot}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarTitle}>✏️ 이미지 편집</span>
        <div className={styles.toolGroup}>
          {(['select', 'crop', 'draw', 'text'] as Tool[]).map(t => (
            <button key={t} className={`${styles.toolBtn} ${tool === t ? styles.active : ''}`}
              onClick={() => { setPendingCrop(null); setTool(t); }}>
              {t === 'select' ? '↖' : t === 'crop' ? '✂️' : t === 'draw' ? '🖊' : 'T'}
            </button>
          ))}
        </div>
        {tool === 'draw' && (
          <div className={styles.toolOptions}>
            <input type="color" value={drawColor} onChange={e => setDrawColor(e.target.value)} />
            <label>굵기 <input type="range" min={1} max={20} value={drawWidth} onChange={e => setDrawWidth(+e.target.value)} />
              <input type="number" min={1} max={20} value={drawWidth} onChange={e => setDrawWidth(+e.target.value)} className={styles.numInput} />
            </label>
          </div>
        )}
        {(tool === 'text' || editingId) && (
          <div className={styles.toolOptions}>
            {PRESET_COLORS.map(c => (
              <button key={c} className={styles.colorPreset} style={{ backgroundColor: c, borderColor: c === textColor ? '#3b82f6' : '#4b5563' }} onClick={() => { setTextColor(c); applyStyleToSelection('color', c); }} />
            ))}
            <input type="color" value={textColor} onChange={e => { setTextColor(e.target.value); applyStyleToSelection('color', e.target.value); }} title="자유롭게 색 선택" />
            <label>크기
              <input type="range" min={8} max={120} value={textSize} onChange={e => { setTextSize(+e.target.value); applyStyleToSelection('fontSize', e.target.value); }} />
              <input type="number" min={8} max={120} value={textSize} onChange={e => { setTextSize(+e.target.value); applyStyleToSelection('fontSize', e.target.value); }} className={styles.numInput} />
            </label>
          </div>
        )}
        {tool === 'crop' && pendingCrop && pendingCrop.w > 10 && (
          <div className={styles.toolOptions}>
            <button className={styles.actionBtn} onClick={applyCrop}>✅ 적용</button>
            <button className={styles.actionBtn} onClick={() => setPendingCrop(null)}>✕ 취소</button>
          </div>
        )}
        {confirmedCrop && <button className={styles.actionBtn} onClick={resetCrop}>↺ 자르기 해제</button>}
        <div className={styles.toolGroup}>
          <button className={styles.toolBtn} onClick={pasteImage} title="클립보드 붙여넣기">📋</button>
          <button className={styles.toolBtn} onClick={undo} title="실행 취소">↩</button>
        </div>
        <div className={styles.spacer} />
        <button className={styles.saveBtn} onClick={handleSave}>💾 저장</button>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div ref={areaRef} className={styles.canvasArea}>
        <canvas ref={canvasRef} className={styles.canvas}
          onMouseDown={onCanvasDown} onMouseMove={onCanvasMove} onMouseUp={onCanvasUp} onMouseLeave={onCanvasUp} />
        {(() => {
          const L = getLayout();
          if (!L) return null;
          return (
            <div style={{ position: 'absolute', left: L.ox, top: L.oy, width: L.dw, height: L.dh, overflow: 'hidden', pointerEvents: 'none' }}>
              {texts.map(t => (
                <TextBox key={t.id} t={t} tool={tool} isEditing={editingId === t.id}
                  layout={L}
                  onStartEdit={() => setEditingId(t.id)}
                  onChange={(next) => setTexts(prev => prev.map(x => x.id === t.id ? { ...x, ...next } : x))}
                  onDelete={() => setTexts(prev => prev.filter(x => x.id !== t.id))}
                />
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── TextBox ──────────────────────────────────────────────────────────────────
function TextBox({ t, tool, isEditing, layout, onStartEdit, onChange, onDelete }: {
  t: TextObj; tool: Tool; isEditing: boolean;
  layout: any; // getLayout return type
  onStartEdit: () => void;
  onChange: (next: Partial<TextObj>) => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);

  // 편집 모드 진입 시 포커스
  useEffect(() => {
    if (isEditing && editRef.current) {
      if (editRef.current.innerHTML !== t.html) {
        editRef.current.innerHTML = t.html || '';
      }
      editRef.current.focus();
      // 빈 텍스트면 커서만, 있으면 끝으로
      if (editRef.current.textContent) {
        const sel = window.getSelection();
        sel?.selectAllChildren(editRef.current);
        sel?.collapseToEnd();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  // 드래그
  const onBoxDown = (e: ReactMouseEvent) => {
    if (isEditing) return; // 편집 중엔 드래그 안 함
    e.stopPropagation();
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: t.x, oy: t.y };
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragStart.current) return;
      const dx = (e.clientX - dragStart.current.mx) / layout.sx;
      const dy = (e.clientY - dragStart.current.my) / layout.sy;
      onChange({
        x: dragStart.current.ox + dx,
        y: dragStart.current.oy + dy,
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, layout.sx, layout.sy, onChange]);

  const border = isEditing ? '2px solid #3b82f6'
    : hovered ? '1.5px dashed rgba(255,255,255,0.6)' : '1.5px dashed transparent';

  // 화면 좌표 계산 (크롭 영역 내에서의 상대 좌표)
  const displayX = (t.x - layout.src.x) * layout.sx;
  const displayY = (t.y - layout.src.y) * layout.sy;
  const displayFontSize = t.fontSize * layout.sx;

  return (
    <div ref={boxRef}
      data-text-id={t.id}
      className={styles.textBox}
      style={{
        left: displayX + 'px',
        top: displayY + 'px',
        border,
        background: isEditing ? 'rgba(0,0,0,0.15)' : 'transparent',
        cursor: isEditing ? 'text' : (dragging ? 'grabbing' : 'grab'),
        pointerEvents: tool === 'text' ? 'auto' : 'none'
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={isEditing ? undefined : onBoxDown}
      onDoubleClick={() => { if (!isEditing) onStartEdit(); }}
      onClick={(e) => { if (!isEditing) { e.stopPropagation(); onStartEdit(); } }}
    >
      {isEditing ? (
        <div ref={editRef}
          className={styles.textAreaInput}
          contentEditable
          suppressContentEditableWarning
          style={{ fontSize: displayFontSize + 'px', color: t.color, minWidth: 80, minHeight: '1.3em', outline: 'none' }}
          onInput={e => onChange({ html: (e.target as HTMLDivElement).innerHTML })}
          onKeyDown={e => e.stopPropagation()}
        />
      ) : (
        <div className={styles.textDisplay}
          style={{ fontSize: displayFontSize + 'px', color: t.color, whiteSpace: 'pre-wrap' }}
          dangerouslySetInnerHTML={{ __html: t.html || '' }}
        />
      )}

      {/* 삭제 버튼: hover 시에만 우상단 작게 */}
      {(hovered || isEditing) && (
        <button className={styles.textDeleteBtn}
          onMouseDown={e => { e.stopPropagation(); onDelete(); }}>×</button>
      )}
    </div>
  );
}
