'use client';

/**
 * 캔버스 편집 표면 (P10 · PROD-639)
 *
 * 기존 "/" 에디터는 그대로 두고, 같은 라우트를 여러 뷰포트 폭으로 나란히 놓는
 * 팬·줌 캔버스를 신설한다. 목업으로 검증한 방향의 첫 동작 구현이다:
 *
 * - 반응형 세트: 375 / 768 / 1024 카드. lg 카드에서 한 편집이 sm 카드에
 *   미치는 영향이 같은 시야에서 보인다 — 브레이크포인트 결함(S6)을 사람이
 *   볼 수 있게 만드는 화면.
 * - 활성 카드의 폭이 viewportWidth 로 전파되어 지배 토큰 편집을 결정한다.
 * - 드래그는 좌표 입력이 아니라 결과 선택이다: 형제 사이로 끌면 삽입선이
 *   목적지를 미리 보여주고, 놓으면 /api/restructure(순서 변경). 그 외에는
 *   스타일 이동/크기로 저장된다. 힌트가 그려졌던 동작만 자동 확정된다.
 * - 색은 상태(호버/선택)에만 쓰고, 정보는 라벨·배지로 (목업 결론).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentChange, DetectedComponent } from '@/types';
import { detectComponents, type RawScanElement } from '@/lib/component-detector';

const HEADER_H = 32;
const CARD_H = 1500;

interface Card {
  id: string;
  label: string;
  bp: string;
  w: number;
  x: number;
}

const CARDS: Card[] = [
  { id: 'sm', label: '375 · base', bp: 'base', w: 375, x: 0 },
  { id: 'md', label: '768 · md', bp: 'md', w: 768, x: 435 },
  { id: 'lg', label: '1024 · lg', bp: 'lg', w: 1024, x: 1263 },
];

interface Enriched {
  comp: DetectedComponent;
  parentKey: string | null;
  order: number; // 문서 순서 (스캔 배열 인덱스) — JSX 형제 순서의 근사
}

interface DragState {
  compId: string;
  mode: 'move' | 'resize';
  startClient: { x: number; y: number };
  startBox: { x: number; y: number; width: number; height: number };
  currentBox: { x: number; y: number; width: number; height: number };
  /** 삽입 판정 결과 — 그려졌다면 놓는 순간 reorder 로 확정된다 */
  insertion: { toIndex: number; lineX: number; lineY: number; lineH: number } | null;
}

export default function CanvasPage() {
  const [target, setTarget] = useState<string | null>(null);
  const [world, setWorld] = useState({ x: 60, y: 40, zoom: 0.55 });
  const [activeId, setActiveId] = useState<string>('lg');
  const [enriched, setEnriched] = useState<Enriched[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [toast, setToast] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const iframesRef = useRef(new Map<string, HTMLIFrameElement>());
  const worldRef = useRef(world);
  worldRef.current = world;
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const enrichedRef = useRef<Enriched[]>([]);
  enrichedRef.current = enriched;
  const activeRef = useRef(activeId);
  activeRef.current = activeId;
  const rescanOnLoad = useRef(false);

  const activeCard = CARDS.find((c) => c.id === activeId)!;

  /* ── 타깃 URL: ?target= → /api/settings(TARGET_PORT) → :3001 ── */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('target');
    if (q) {
      setTarget(q);
      return;
    }
    fetch('/api/settings')
      .then((r) => r.json())
      .then(({ data }) => setTarget(`http://localhost:${data?.targetPort || '3001'}`))
      .catch(() => setTarget('http://localhost:3001'));
  }, []);

  /* ── 스캔 결과 수신: e.source 로 어느 카드인지 식별 ── */
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== 'wigss-scan-result' || !Array.isArray(e.data.elements)) return;
      const activeFrame = iframesRef.current.get(activeRef.current);
      if (!activeFrame || e.source !== activeFrame.contentWindow) return;
      const raw: RawScanElement[] = e.data.elements;
      const comps = detectComponents(raw);
      const byId = new Map(raw.map((r, i) => [r.id, { r, i }]));
      setEnriched(
        comps.map((comp) => {
          const primary = byId.get(comp.elementIds[0]);
          return {
            comp,
            parentKey: primary?.r.parentId ?? null,
            order: primary?.i ?? 0,
          };
        }),
      );
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const requestScan = useCallback((cardId: string) => {
    const frame = iframesRef.current.get(cardId);
    frame?.contentWindow?.postMessage({ type: 'wigss-scan-request' }, '*');
  }, []);

  const activate = useCallback(
    (cardId: string) => {
      setActiveId(cardId);
      setEnriched([]);
      setSelected(null);
      setTimeout(() => requestScan(cardId), 60);
    },
    [requestScan],
  );

  /* ── 팬/줌 ── */
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) {
        setWorld((w) => ({ ...w, zoom: Math.min(2, Math.max(0.15, w.zoom * Math.exp(-e.deltaY * 0.002))) }));
      } else {
        setWorld((w) => ({ ...w, x: w.x - e.deltaX, y: w.y - e.deltaY }));
      }
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, []);

  /* ── 드래그: 이동/크기 + 삽입 판정 ── */
  const beginDrag = useCallback((e: React.PointerEvent, compId: string, mode: DragState['mode']) => {
    e.preventDefault();
    e.stopPropagation();
    const item = enrichedRef.current.find((x) => x.comp.id === compId);
    if (!item) return;
    setSelected(compId);
    const b = item.comp.boundingBox;
    setDrag({
      compId,
      mode,
      startClient: { x: e.clientX, y: e.clientY },
      startBox: { ...b },
      currentBox: { ...b },
      insertion: null,
    });
  }, []);

  useEffect(() => {
    if (!drag) return;

    const computeInsertion = (box: DragState['currentBox']): DragState['insertion'] => {
      const d = dragRef.current;
      if (!d || d.mode !== 'move') return null;
      const me = enrichedRef.current.find((x) => x.comp.id === d.compId);
      if (!me?.comp.sourceAddress || !me.parentKey) return null;
      const siblings = enrichedRef.current
        .filter((x) => x.parentKey === me.parentKey && x.comp.id !== me.comp.id)
        .sort((a, b) => a.order - b.order);
      if (siblings.length === 0) return null;
      // 가로 행 판정: 형제들이 시작 y 를 공유해야 삽입 모드
      const sameRow = siblings.every(
        (s) => Math.abs(s.comp.boundingBox.y - d.startBox.y) < d.startBox.height * 0.8,
      );
      if (!sameRow) return null;
      // 세로로 크게 벗어나면 스타일 이동으로 본다
      if (Math.abs(box.y - d.startBox.y) > d.startBox.height * 0.6) return null;

      const centerX = box.x + box.width / 2;
      const full = [...siblings, me].sort((a, b) => a.order - b.order);
      const fromIndex = full.indexOf(me);
      // 삽입 슬롯: 나를 제외한 형제 중심들 사이
      let slot = 0;
      for (const s of siblings) {
        if (centerX > s.comp.boundingBox.x + s.comp.boundingBox.width / 2) slot++;
      }
      const toIndex = slot; // 자기 제외 목록 기준 = 최종 배열 인덱스
      if (toIndex === fromIndex) return null;
      // 삽입선 위치: 슬롯 경계
      const ordered = siblings.map((s) => s.comp.boundingBox);
      let lineX: number;
      if (slot === 0) lineX = ordered[0].x - 6;
      else if (slot >= ordered.length) lineX = ordered[ordered.length - 1].x + ordered[ordered.length - 1].width + 6;
      else lineX = (ordered[slot - 1].x + ordered[slot - 1].width + ordered[slot].x) / 2;
      const lineY = Math.min(...ordered.map((o) => o.y)) - 8;
      const lineH = Math.max(...ordered.map((o) => o.height)) + 16;
      return { toIndex, lineX, lineY, lineH };
    };

    const onMove = (e: PointerEvent) => {
      setDrag((d) => {
        if (!d) return d;
        const zoom = worldRef.current.zoom;
        const dx = (e.clientX - d.startClient.x) / zoom;
        const dy = (e.clientY - d.startClient.y) / zoom;
        let box = d.currentBox;
        if (d.mode === 'move') {
          box = { ...d.startBox, x: d.startBox.x + dx, y: d.startBox.y + dy };
        } else {
          box = {
            ...d.startBox,
            width: Math.max(24, d.startBox.width + dx),
            height: Math.max(24, d.startBox.height + dy),
          };
        }
        return { ...d, currentBox: box, insertion: computeInsertion(box) };
      });
    };

    const onUp = () => {
      const d = dragRef.current;
      setDrag(null);
      if (!d) return;
      const moved =
        Math.abs(d.currentBox.x - d.startBox.x) > 2 ||
        Math.abs(d.currentBox.y - d.startBox.y) > 2 ||
        Math.abs(d.currentBox.width - d.startBox.width) > 2 ||
        Math.abs(d.currentBox.height - d.startBox.height) > 2;
      if (!moved) return;
      if (d.insertion) void commitReorder(d);
      else void commitStyle(d);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null]);

  /* ── 확정: 순서 변경 (삽입선이 그려졌던 동작만) ── */
  const commitReorder = async (d: DragState) => {
    const me = enrichedRef.current.find((x) => x.comp.id === d.compId);
    if (!me?.comp.sourceAddress || !d.insertion) return;
    setBusy(true);
    setToast(`순서 변경 적용 중…`);
    try {
      const res = await fetch('/api/restructure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: me.comp.sourceAddress,
          toIndex: d.insertion.toIndex,
          projectPath: 'auto',
        }),
      });
      const json = await res.json();
      setToast(json.success ? `✓ ${json.data.explanation}` : `순서 변경 불가: ${json.error?.message}`);
    } catch (err) {
      setToast(`순서 변경 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
      reloadActive();
    }
  };

  /* ── 확정: 스타일 (이동→마진 스냅 / 크기) — 활성 카드 폭이 지배 토큰을 정한다 ── */
  const commitStyle = async (d: DragState) => {
    const me = enrichedRef.current.find((x) => x.comp.id === d.compId);
    if (!me) return;
    const change: ComponentChange = {
      componentId: d.compId,
      type: d.mode === 'resize' ? 'resize' : 'move',
      from: { ...d.startBox },
      to: { ...d.currentBox },
    };
    setBusy(true);
    setToast('저장 중…');
    try {
      const ref = await fetch('/api/refactor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: [change],
          components: enrichedRef.current.map((x) => x.comp),
          projectPath: 'auto',
          viewportWidth: CARDS.find((c) => c.id === activeRef.current)!.w,
        }),
      });
      const refJson = await ref.json();
      if (!refJson.success || refJson.data.diffs.length === 0) {
        setToast(`적용 불가: ${refJson.data?.skipped?.[0]?.reason ?? '알 수 없음'}`);
        return;
      }
      const ap = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diffs: refJson.data.diffs, projectPath: 'auto' }),
      });
      const apJson = await ap.json();
      setToast(apJson.success ? `✓ ${refJson.data.diffs[0].explanation}` : `적용 실패`);
    } catch (err) {
      setToast(`저장 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
      reloadActive();
    }
  };

  const reloadActive = () => {
    rescanOnLoad.current = true;
    const frame = iframesRef.current.get(activeRef.current);
    try {
      frame?.contentWindow?.location.reload();
    } catch {
      if (frame) frame.src = frame.src; // eslint-disable-line no-self-assign
    }
  };

  const visible = useMemo(
    () => enriched.filter((e) => e.comp.boundingBox.width > 40 && e.comp.boundingBox.height > 24),
    [enriched],
  );

  const inv = 1 / world.zoom;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1c1c1c', color: '#ededed', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
      {/* ── 상단 바: 상시 표시. 활성 브레이크포인트가 항상 보인다 ── */}
      <div style={{ position: 'fixed', insetInline: 0, top: 0, height: 44, background: '#181818', borderBottom: '1px solid #2e2e2e', display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', zIndex: 100, fontSize: 13 }}>
        <span style={{ width: 22, height: 22, borderRadius: 5, background: '#3ecf8e', color: '#0f2a1e', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 }}>W</span>
        <b>Canvas</b>
        <span style={{ fontFamily: 'monospace', fontSize: 11.5, color: '#7e7e7e', border: '1px solid #2e2e2e', borderRadius: 5, padding: '3px 8px' }}>
          {target ?? '…'}
        </span>
        <span data-testid="active-bp" style={{ fontFamily: 'monospace', fontSize: 12, color: '#3ecf8e', border: '1px solid rgba(62,207,142,.4)', background: 'rgba(62,207,142,.1)', borderRadius: 5, padding: '3px 10px' }}>
          editing at {activeCard.bp} · {activeCard.w}px
        </span>
        <span style={{ flex: 1 }} />
        {toast && (
          <span data-testid="toast" style={{ fontSize: 12, color: busy ? '#b4b4b4' : '#3ecf8e' }}>{toast}</span>
        )}
        <a href="/" style={{ fontSize: 12, color: '#7e7e7e', textDecoration: 'none', border: '1px solid #2e2e2e', borderRadius: 5, padding: '4px 10px' }}>
          기존 에디터
        </a>
      </div>

      {/* ── 캔버스 ── */}
      <div ref={viewportRef} style={{ position: 'absolute', inset: '44px 0 0 0', overflow: 'hidden', cursor: drag ? 'grabbing' : 'default', background: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.04) 1px, transparent 0) 0 0/22px 22px' }}>
        <div style={{ position: 'absolute', transformOrigin: '0 0', transform: `translate(${world.x}px, ${world.y}px) scale(${world.zoom})` }}>
          {target &&
            CARDS.map((card) => {
              const active = card.id === activeId;
              return (
                <div key={card.id} data-testid={`card-${card.id}`} style={{ position: 'absolute', left: card.x, top: 0, width: card.w, background: '#0e0e0e', border: `1px solid ${active ? 'rgba(62,207,142,.5)' : '#2e2e2e'}`, borderRadius: 8, boxShadow: active ? '0 0 0 1px rgba(62,207,142,.5), 0 10px 40px rgba(0,0,0,.5)' : '0 8px 30px rgba(0,0,0,.45)' }}>
                  <div
                    onClick={() => activate(card.id)}
                    style={{ height: HEADER_H, display: 'flex', alignItems: 'center', gap: 8, padding: `0 ${10 * inv}px`, background: '#181818', borderBottom: '1px solid #2e2e2e', cursor: 'pointer', fontFamily: 'monospace', fontSize: 11.5 * inv, color: '#b4b4b4' }}
                  >
                    <span style={{ width: 6 * inv, height: 6 * inv, borderRadius: '50%', background: active ? '#3ecf8e' : '#5c5c5c' }} />
                    <span>/ · {card.label}</span>
                    {active && <span style={{ color: '#3ecf8e' }}>active</span>}
                  </div>
                  <div style={{ position: 'relative', height: CARD_H }}>
                    <iframe
                      ref={(el) => {
                        if (el) iframesRef.current.set(card.id, el);
                      }}
                      src={target}
                      width={card.w}
                      height={CARD_H}
                      style={{ border: 0, display: 'block', background: '#0e0e0e', pointerEvents: 'none' }}
                      title={`viewport-${card.id}`}
                      onLoad={() => {
                        if (card.id === activeRef.current && (rescanOnLoad.current || enrichedRef.current.length === 0)) {
                          rescanOnLoad.current = false;
                          setTimeout(() => requestScan(card.id), 150);
                        }
                      }}
                    />
                    {/* ── 오버레이 (활성 카드만) — 색은 상태에만, 정보는 라벨로 ── */}
                    {active && (
                      <div style={{ position: 'absolute', inset: 0 }}>
                        {visible.map((item) => {
                          const isSel = item.comp.id === selected;
                          const isDragged = drag?.compId === item.comp.id;
                          const b = isDragged && drag ? drag.currentBox : item.comp.boundingBox;
                          return (
                            <div
                              key={item.comp.id}
                              className="canvas-overlay-box"
                              data-comp-name={item.comp.name}
                              data-comp-type={item.comp.type}
                              onPointerDown={(e) => beginDrag(e, item.comp.id, 'move')}
                              style={{ position: 'absolute', left: b.x, top: b.y, width: b.width, height: b.height, outline: `${(isSel ? 2 : 1.2) * inv}px solid ${isSel ? '#3ecf8e' : isDragged ? 'rgba(62,207,142,.7)' : 'rgba(62,207,142,.25)'}`, background: isDragged ? 'rgba(62,207,142,.08)' : 'transparent', cursor: 'grab', borderRadius: 2 }}
                            >
                              {(isSel || isDragged) && (
                                <span style={{ position: 'absolute', top: -18 * inv, left: 0, fontFamily: 'monospace', fontSize: 10.5 * inv, background: '#3ecf8e', color: '#0d2a1e', padding: `${1 * inv}px ${6 * inv}px`, borderRadius: 3, whiteSpace: 'nowrap', fontWeight: 600 }}>
                                  {item.comp.name}
                                  {item.comp.sourceAddress ? '' : ' · 주소 없음'}
                                </span>
                              )}
                              {isSel && !drag && (
                                <span
                                  onPointerDown={(e) => beginDrag(e, item.comp.id, 'resize')}
                                  style={{ position: 'absolute', right: -5 * inv, bottom: -5 * inv, width: 10 * inv, height: 10 * inv, background: '#1c1c1c', border: `${1.5 * inv}px solid #3ecf8e`, borderRadius: 2, cursor: 'nwse-resize' }}
                                />
                              )}
                            </div>
                          );
                        })}
                        {/* 삽입선 — 그려졌다면 놓는 순간 그 자리로 확정된다 */}
                        {drag?.insertion && (
                          <div
                            data-testid="insertion-line"
                            style={{ position: 'absolute', left: drag.insertion.lineX, top: drag.insertion.lineY, width: 2.5 * inv, height: drag.insertion.lineH, background: '#3ecf8e', borderRadius: 2, boxShadow: '0 0 10px rgba(62,207,142,.6)' }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* ── 하단 바 ── */}
      <div style={{ position: 'fixed', insetInline: 0, bottom: 0, height: 28, background: '#181818', borderTop: '1px solid #2e2e2e', display: 'flex', alignItems: 'center', gap: 16, padding: '0 14px', zIndex: 100, fontFamily: 'monospace', fontSize: 11, color: '#7e7e7e' }}>
        <span>{Math.round(world.zoom * 100)}%</span>
        <span>⌘+스크롤 줌 · 스크롤 팬 · 카드 헤더 클릭 = 활성화</span>
        <span style={{ flex: 1 }} />
        <span data-testid="component-count">components {visible.length}</span>
        <span>address join {visible.filter((v) => v.comp.sourceAddress).length}/{visible.length}</span>
      </div>
    </div>
  );
}
