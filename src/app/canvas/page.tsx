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
 * - 좌측 레일(시안의 "rail displaces the canvas"): 라우트는 /api/routes 의
 *   정적 스캔에서, 트리는 활성 카드의 스캔 결과에서 온다. 레일 행 클릭은
 *   해당 컴포넌트로 팬·선택, 라우트 클릭은 카드 전체를 그 라우트로 이동.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BoundingBox,
  ComponentChange,
  DetectedComponent,
  FidelityExpectation,
  FidelityMismatch,
  FidelityReport,
} from '@/types';
import { detectComponents, type RawScanElement } from '@/lib/component-detector';
import {
  buildExpectationsFromChanges,
  capturePriorBoxes,
  extractActualBoxes,
} from '@/lib/fidelity-client';

const HEADER_H = 32;
const CARD_H = 1500;
const RAIL_W = 232;

interface RouteEntry {
  path: string;
  needsValue: boolean;
}

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

/** 저장 후 재스캔이 도착하면 소비되는 검증 대기 상태 (에디터의 verify 루프와 동등) */
interface PendingVerify {
  expectations: FidelityExpectation[];
  priorBoxes: Record<string, BoundingBox>;
  backupId: string;
  retriesLeft: number;
  /** 불일치가 실제인지 확인하기 위한 재측정 여유 — Next 재컴파일 경합 흡수 */
  staleRetries: number;
  /** 새로 쓴 클래스 토큰 — 스캔된 DOM 에 이 토큰이 보여야 새 렌더다 */
  probeTokens: string[];
  address?: string;
  explanation: string;
  startedAt: number;
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
  const [routes, setRoutes] = useState<RouteEntry[]>([]);
  const [route, setRoute] = useState('/');
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
  const pendingVerify = useRef<PendingVerify | null>(null);

  /* 프리뷰 원복: iframe DOM 에만 걸었던 낙관적 스타일을 걷는다 */
  const clearPreview = useCallback(() => {
    const frame = iframesRef.current.get(activeRef.current);
    frame?.contentWindow?.postMessage({ type: 'wigss-preview-clear' }, '*');
  }, []);

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

  /* ── 라우트 목록: 타깃 app/ 디렉터리 정적 스캔 ── */
  useEffect(() => {
    fetch('/api/routes')
      .then((r) => r.json())
      .then(({ data }) => setRoutes(Array.isArray(data?.routes) ? data.routes : []))
      .catch(() => setRoutes([]));
  }, []);

  const switchRoute = useCallback((next: string) => {
    if (next === route) return;
    setRoute(next);
    setEnriched([]);
    setSelected(null);
    rescanOnLoad.current = true; // src 교체로 전 카드 리로드 → 활성 카드 load 시 재스캔
  }, [route]);

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

    /* 낙관적 DOM 프리뷰 — 프레임당 1회, iframe 의 실제 요소에 인라인으로.
     * 소스에는 절대 쓰지 않는다. 크기는 width/height 라 이웃의 리플로우까지
     * 실시간으로 보이고(정직한 프리뷰), 이동은 transform 고스트다. */
    let rafId = 0;
    const sendPreview = () => {
      rafId = 0;
      const d = dragRef.current;
      if (!d) return;
      const me = enrichedRef.current.find((x) => x.comp.id === d.compId);
      const frame = iframesRef.current.get(activeRef.current);
      if (!me || !frame?.contentWindow) return;
      const styles =
        d.mode === 'move'
          ? {
              transform: `translate(${Math.round(d.currentBox.x - d.startBox.x)}px, ${Math.round(d.currentBox.y - d.startBox.y)}px)`,
              willChange: 'transform',
            }
          : {
              width: `${Math.round(d.currentBox.width)}px`,
              height: `${Math.round(d.currentBox.height)}px`,
            };
      frame.contentWindow.postMessage({ type: 'wigss-preview', index: me.order, styles }, '*');
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
      if (!rafId) rafId = requestAnimationFrame(sendPreview);
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
      if (!moved) {
        clearPreview();
        return;
      }
      if (d.insertion) {
        clearPreview(); // 이동 고스트는 걷고, 순서 변경은 코드로 확정한다
        void commitReorder(d);
      } else {
        // 프리뷰는 리로드가 실제 결과로 교체할 때까지 유지 — 스냅백 없는 체감
        void commitStyle(d);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
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
    setToast('Reordering…');
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
      setToast(json.success ? `✓ ${json.data.explanation}` : `Reorder refused: ${json.error?.message}`);
    } catch (err) {
      setToast(`Reorder failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
      reloadActive();
    }
  };

  /* ── 확정: 스타일 (이동→마진 스냅 / 크기) — 활성 카드 폭이 지배 토큰을 정한다.
   * 에디터와 동일한 검증 루프: apply 후 재스캔 → /api/verify → 불일치면
   * 자동 롤백 → T1 수선 1회 → 재검증. 최종 불일치도 롤백 — 코드가 맞아도
   * 화면이 다르면(그리드가 폭을 무시하는 경우 등) 남기지 않는다. ── */
  const commitStyle = async (d: DragState) => {
    const me = enrichedRef.current.find((x) => x.comp.id === d.compId);
    if (!me) return;
    const change: ComponentChange = {
      componentId: d.compId,
      type: d.mode === 'resize' ? 'resize' : 'move',
      from: { ...d.startBox },
      to: { ...d.currentBox },
    };
    const comps = enrichedRef.current.map((x) => x.comp);
    const priorBoxes = capturePriorBoxes([change], comps);
    const expectations = buildExpectationsFromChanges([change], comps);
    setBusy(true);
    setToast('Saving…');
    try {
      const ref = await fetch('/api/refactor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: [change],
          components: comps,
          projectPath: 'auto',
          viewportWidth: CARDS.find((c) => c.id === activeRef.current)!.w,
        }),
      });
      const refJson = await ref.json();
      if (!refJson.success || refJson.data.diffs.length === 0) {
        clearPreview();
        setToast(`Skipped: ${refJson.data?.skipped?.[0]?.reason ?? 'unknown'}`);
        return;
      }
      const ap = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diffs: refJson.data.diffs, projectPath: 'auto' }),
      });
      const apJson = await ap.json();
      if (!apJson.success) {
        clearPreview();
        setToast('Apply failed');
        return;
      }
      const explanation = refJson.data.diffs[0].explanation as string;
      const backupId = apJson.data?.backupId as string | undefined;
      // 새 렌더 판별용: modified 에만 있는 클래스 토큰 (예: lg:h-[428px])
      const d0 = refJson.data.diffs[0] as { original: string; modified: string };
      const probeTokens = (d0.modified.match(/[^\s"']+/g) ?? []).filter(
        (t) => !d0.original.includes(t) && t.length > 2,
      );
      if (expectations.length > 0 && backupId) {
        pendingVerify.current = {
          expectations,
          priorBoxes,
          backupId,
          retriesLeft: 1,
          staleRetries: 4,
          probeTokens,
          address: me.comp.sourceAddress,
          explanation,
          startedAt: performance.now(),
        };
        setToast(`✓ ${explanation} — verifying…`);
      } else {
        setToast(`✓ ${explanation}`);
      }
    } catch (err) {
      clearPreview();
      setToast(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
      // 파일워처(chokidar)가 변경을 무효화하기 전에 리로드하면 낡은 빌드를
      // 통째로 받는다 (실측: 편집 전 384px 가 그대로 측정됨). 한 박자 늦춘다.
      setTimeout(reloadActive, 350);
    }
  };

  /* ── 재스캔 도착 후 검증 소비 — 실패 시 롤백 → T1 1회 → 재검증 ── */
  const runCanvasVerify = useCallback(async () => {
    const pv = pendingVerify.current;
    if (!pv) return;
    pendingVerify.current = null;
    const comps = enrichedRef.current.map((x) => x.comp);
    const ids = pv.expectations.map((e) => e.componentId);
    const actualBoxes = extractActualBoxes(ids, comps);
    if (ids.some((id) => !actualBoxes[id])) {
      setToast(`✓ ${pv.explanation} (target lost in rescan — verify skipped)`);
      return;
    }
    /* 새 렌더 확인: 우리가 쓴 토큰이 스캔된 className 에 아직 없다면 이 측정은
     * 편집 전 페이지다 (Next 재컴파일/HMR 경합 — 실측 384px vs 기대 428px).
     * 낡은 측정으로 판정하지 않고 기다렸다 다시 잰다. */
    const editedComp = comps.find((c) => c.id === ids[0]);
    const cls = editedComp?.fullClassName ?? '';
    if (cls && pv.probeTokens.length > 0 && !pv.probeTokens.every((t) => cls.includes(t))) {
      if (pv.staleRetries > 0) {
        pendingVerify.current = { ...pv, staleRetries: pv.staleRetries - 1 };
        setToast(`Verify wait — fresh render pending (${pv.staleRetries})`);
        // 재스캔으로도 낡은 렌더가 반복되면 중간에 한 번은 완전 리로드로 끊는다
        if (pv.staleRetries === 2) reloadActive();
        else setTimeout(() => requestScan(activeRef.current), 800);
        return;
      }
      setToast(`✓ ${pv.explanation} (fresh render unconfirmed — verify skipped)`);
      return;
    }
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectations: pv.expectations, priorBoxes: pv.priorBoxes, actualBoxes }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setToast(`Verify error: ${json.error?.message ?? res.status}`);
        return;
      }
      if (json.data.passed) {
        setToast(`✓ ${pv.explanation} · verified +${Math.round(performance.now() - pv.startedAt)}ms`);
        return;
      }
      /* 불일치 ≠ 즉시 실패: 편집 직후의 재스캔은 Next 가 아직 새 코드를
       * 컴파일하기 전의 낡은 렌더를 측정했을 수 있다 (실측: 428px 기대에
       * 구버전 384px 측정 → 가짜 롤백). 판정을 내리기 전에 짧게 기다렸다
       * 다시 재고, 같은 불일치가 반복될 때만 진짜로 취급한다. */
      if (pv.staleRetries > 0) {
        pendingVerify.current = { ...pv, staleRetries: pv.staleRetries - 1 };
        setToast(`Verify wait — confirming stable render (${pv.staleRetries})`);
        if (pv.staleRetries === 2) reloadActive();
        else setTimeout(() => requestScan(activeRef.current), 600);
        return;
      }
      const reports = json.data.reports as FidelityReport[];
      const failed = reports.find(
        (r) => !r.passed && r.mismatches.some((m: FidelityMismatch) => m.property !== '__measurement__'),
      );
      const mm = (failed?.mismatches ?? []).filter((m: FidelityMismatch) => m.property !== '__measurement__');
      const summary = mm.map((m) => `${m.property} ${m.expected}→${m.actual}`).join(', ');

      // 1) 자동 롤백 (역치환 — 사용자 동시 수정은 보존)
      const rb = await fetch('/api/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId: pv.backupId }),
      });
      if (!rb.ok) {
        setToast(`Mismatch (${summary}) · rollback refused — file changed since, manual check needed`);
        return;
      }
      // 2) T1 수선 (남은 횟수 있고 주소가 있을 때만)
      if (pv.retriesLeft > 0 && pv.address && failed) {
        setToast(`Mismatch (${summary}) → rolled back, trying T1 repair…`);
        const exp = pv.expectations.find((e) => e.componentId === failed.componentId);
        const rp = await fetch('/api/repair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: pv.address,
            targetStyles: exp?.expectedStyles ?? {},
            viewportWidth: CARDS.find((c) => c.id === activeRef.current)!.w,
            projectPath: 'auto',
            mismatches: mm,
          }),
        });
        const rpJson = await rp.json();
        if (rp.ok && rpJson.success) {
          pendingVerify.current = {
            ...pv,
            backupId: rpJson.data.backupId,
            retriesLeft: pv.retriesLeft - 1,
            staleRetries: 4,
            probeTokens: [],
            explanation: rpJson.data.explanation,
          };
          reloadActive();
          return;
        }
        setToast(
          rpJson.error?.code === 'NO_AUTH'
            ? `Mismatch (${summary}) — rolled back · T1 skipped (no auth)`
            : `Mismatch (${summary}) — rolled back · T1 refused: ${rpJson.error?.message ?? rp.status}`,
        );
      } else {
        setToast(`Mismatch (${summary}) — not expressible in this layout, rolled back`);
      }
      reloadActive();
    } catch (err) {
      setToast(`Verify failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [requestScan]);

  /* 재스캔(enriched 갱신)이 곧 검증 트리거 — 타이머 없이 이벤트로 */
  useEffect(() => {
    if (enriched.length > 0 && pendingVerify.current) void runCanvasVerify();
  }, [enriched, runCanvasVerify]);

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

  /* ── 레일 트리: 문서 순서 + 포함 관계로 들여쓰기, 이름 중복은 ×N 배지 ── */
  const tree = useMemo(() => {
    const contains = (o: Enriched, i: Enriched) => {
      const a = o.comp.boundingBox;
      const b = i.comp.boundingBox;
      return (
        a.x <= b.x + 1 && a.y <= b.y + 1 &&
        a.x + a.width >= b.x + b.width - 1 && a.y + a.height >= b.y + b.height - 1 &&
        a.width * a.height > b.width * b.height + 4
      );
    };
    const nameCount = new Map<string, number>();
    for (const v of visible) nameCount.set(v.comp.name, (nameCount.get(v.comp.name) ?? 0) + 1);
    const seen = new Set<string>();
    return [...visible]
      .sort((a, b) => a.order - b.order)
      .map((item) => ({
        item,
        depth: visible.filter((o) => o !== item && contains(o, item)).length,
        uses: nameCount.get(item.comp.name) ?? 1,
      }))
      .filter((row) => {
        // 같은 이름의 반복 렌더는 첫 행만 남기고 ×N 으로 접는다 (시안의 Card ×3)
        if (row.uses <= 1) return true;
        if (seen.has(row.item.comp.name)) return false;
        seen.add(row.item.comp.name);
        return true;
      });
  }, [visible]);

  /* 레일 행 클릭 → 선택 + 활성 카드의 해당 컴포넌트가 화면 중앙에 오게 팬 */
  const focusComponent = useCallback((item: Enriched) => {
    setSelected(item.comp.id);
    const vp = viewportRef.current;
    if (!vp) return;
    const r = vp.getBoundingClientRect();
    const card = CARDS.find((c) => c.id === activeRef.current)!;
    const b = item.comp.boundingBox;
    const z = worldRef.current.zoom;
    const visibleH = Math.min(b.height, r.height / z);
    setWorld((w) => ({
      ...w,
      x: r.width / 2 - (card.x + b.x + b.width / 2) * z,
      y: r.height / 2 - (HEADER_H + b.y + visibleH / 2) * z,
    }));
  }, []);

  const inv = 1 / world.zoom;
  const routeSuffix = route === '/' ? '' : route;

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
          Classic editor
        </a>
      </div>

      {/* ── 좌측 레일: 라우트(정적 스캔) + 이 라우트의 컴포넌트 트리 ── */}
      <div data-testid="rail" style={{ position: 'fixed', top: 44, bottom: 28, left: 0, width: RAIL_W, background: '#181818', borderRight: '1px solid #2e2e2e', zIndex: 90, overflowY: 'auto', padding: '10px 0 16px', fontSize: 12.5 }}>
        <div style={{ padding: '6px 14px 4px', fontSize: 10.5, letterSpacing: '.08em', color: '#7e7e7e', fontWeight: 600 }}>ROUTES</div>
        {routes.length === 0 && <div style={{ padding: '4px 14px', color: '#5c5c5c' }}>scanning…</div>}
        {routes.map((r) => {
          const isActive = r.path === route;
          return (
            <div
              key={r.path}
              data-testid={`rail-route-${r.path}`}
              onClick={() => !r.needsValue && switchRoute(r.path)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px 5px 12px', borderLeft: `2px solid ${isActive ? '#3ecf8e' : 'transparent'}`, background: isActive ? 'rgba(62,207,142,.08)' : 'transparent', color: r.needsValue ? '#5c5c5c' : isActive ? '#ededed' : '#b4b4b4', cursor: r.needsValue ? 'not-allowed' : 'pointer', fontFamily: 'monospace' }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.path}</span>
              {r.needsValue && (
                <span style={{ marginLeft: 'auto', fontSize: 9.5, border: '1px solid #3a3a3a', borderRadius: 4, padding: '1px 5px', color: '#8a8a8a' }}>needs value</span>
              )}
            </div>
          );
        })}

        <div style={{ padding: '16px 14px 4px', fontSize: 10.5, letterSpacing: '.08em', color: '#7e7e7e', fontWeight: 600 }}>TREE · THIS ROUTE</div>
        {tree.length === 0 && <div style={{ padding: '4px 14px', color: '#5c5c5c' }}>waiting for active card scan…</div>}
        {tree.map(({ item, depth, uses }) => {
          const isSel = item.comp.id === selected;
          const noAddr = !item.comp.sourceAddress;
          return (
            <div
              key={item.comp.id}
              data-testid={`rail-comp-${item.comp.name}`}
              onClick={() => focusComponent(item)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: `4px 14px 4px ${12 + depth * 14}px`, borderLeft: `2px solid ${isSel ? '#3ecf8e' : 'transparent'}`, background: isSel ? 'rgba(62,207,142,.08)' : 'transparent', color: isSel ? '#ededed' : '#b4b4b4', cursor: 'pointer' }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 2, border: `1px solid ${isSel ? '#3ecf8e' : '#5c5c5c'}`, background: isSel ? 'rgba(62,207,142,.5)' : 'transparent', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.comp.name}</span>
              {uses > 1 && (
                <span style={{ marginLeft: 'auto', fontSize: 9.5, fontFamily: 'monospace', border: '1px solid rgba(62,207,142,.35)', background: 'rgba(62,207,142,.1)', color: '#3ecf8e', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>×{uses}</span>
              )}
              {noAddr && (
                <span style={{ marginLeft: uses > 1 ? 4 : 'auto', fontSize: 9.5, fontFamily: 'monospace', border: '1px solid rgba(230,164,62,.4)', background: 'rgba(230,164,62,.1)', color: '#e6a43e', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>no addr</span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 캔버스 (레일이 캔버스를 밀어낸다 — 패널이 편집 대상을 가리지 않게) ── */}
      <div ref={viewportRef} style={{ position: 'absolute', inset: `44px 0 0 ${RAIL_W}px`, overflow: 'hidden', cursor: drag ? 'grabbing' : 'default', background: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.04) 1px, transparent 0) 0 0/22px 22px' }}>
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
                    <span>{route} · {card.label}</span>
                    {active && <span style={{ color: '#3ecf8e' }}>active</span>}
                  </div>
                  <div style={{ position: 'relative', height: CARD_H }}>
                    <iframe
                      ref={(el) => {
                        if (el) iframesRef.current.set(card.id, el);
                      }}
                      src={target + routeSuffix}
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
                                  {item.comp.sourceAddress ? '' : ' · no addr'}
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
        <span>⌘+scroll zoom · scroll pan · click a card header to activate</span>
        <span style={{ flex: 1 }} />
        <span data-testid="component-count">components {visible.length}</span>
        <span>address join {visible.filter((v) => v.comp.sourceAddress).length}/{visible.length}</span>
      </div>
    </div>
  );
}
