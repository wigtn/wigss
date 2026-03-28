'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useAgentStore } from '@/stores/agent-store';
import type { BoundingBox, ComponentType, ComponentChange, DetectedComponent } from '@/types';

// ── Colors by component type ──
const TYPE_COLORS: Record<ComponentType, { stroke: string; fill: string; label: string }> = {
  navbar:  { stroke: '#22d3ee', fill: 'rgba(34,211,238,0.10)',  label: '#0891b2' },
  header:  { stroke: '#a78bfa', fill: 'rgba(167,139,250,0.10)', label: '#7c3aed' },
  hero:    { stroke: '#f59e0b', fill: 'rgba(245,158,11,0.10)',  label: '#d97706' },
  grid:    { stroke: '#34d399', fill: 'rgba(52,211,153,0.10)',  label: '#059669' },
  card:    { stroke: '#2dd4bf', fill: 'rgba(45,212,191,0.10)',  label: '#0d9488' },
  sidebar: { stroke: '#ec4899', fill: 'rgba(236,72,153,0.10)',  label: '#db2777' },
  footer:  { stroke: '#6b7280', fill: 'rgba(107,114,128,0.10)', label: '#4b5563' },
  section: { stroke: '#60a5fa', fill: 'rgba(96,165,250,0.10)',  label: '#2563eb' },
  form:    { stroke: '#fb923c', fill: 'rgba(251,146,60,0.10)',  label: '#ea580c' },
  modal:   { stroke: '#ef4444', fill: 'rgba(239,68,68,0.10)',   label: '#dc2626' },
};

const SELECTED = { stroke: '#60a5fa', fill: 'rgba(59,130,246,0.18)', label: '#3b82f6' };
const MIN_IFRAME_HEIGHT = 2400;
const DESKTOP_WIDTH = 1280;
const MOBILE_WIDTH = 375;

function truncateLabel(tag: string, className: string, text: string): string {
  const cls = typeof className === 'string' ? className.split(/\s+/).slice(0, 2).join('.') : '';
  const base = cls ? `${tag}.${cls}` : tag;
  return text ? `${base}: ${text.slice(0, 20)}` : base;
}

function guessComponentType(tag: string, className: string, attrs: Record<string, string>): ComponentType {
  const t = tag.toLowerCase();
  const c = (className || '').toLowerCase();
  const role = (attrs?.role || '').toLowerCase();
  if (t === 'nav' || role === 'navigation' || c.includes('nav')) return 'navbar';
  if (t === 'header' || c.includes('header')) return 'header';
  if (t === 'footer' || c.includes('footer')) return 'footer';
  if (t === 'aside' || c.includes('sidebar')) return 'sidebar';
  if (t === 'form') return 'form';
  if (c.includes('hero')) return 'hero';
  if (c.includes('card')) return 'card';
  if (c.includes('grid') || c.includes('grid-cols')) return 'grid';
  if (c.includes('modal') || c.includes('dialog')) return 'modal';
  return 'section';
}

// ── Depth opacity (deeper = more transparent) ──
function depthOpacity(depth: number): number {
  // depth 0 = top level = full opacity, each level reduces
  return Math.max(0.3, 1 - depth * 0.15);
}

// ── Resize handle positions ──
const HANDLES = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'] as const;
type HandleDir = typeof HANDLES[number];

function handleCursor(dir: HandleDir): string {
  const map: Record<HandleDir, string> = {
    nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize',
    n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize',
  };
  return map[dir];
}

function handleStyle(dir: HandleDir): React.CSSProperties {
  const size = 8;
  const base: React.CSSProperties = {
    position: 'absolute', width: size, height: size,
    backgroundColor: '#60a5fa', border: '1px solid #fff',
    borderRadius: 1, zIndex: 2,
  };
  switch (dir) {
    case 'nw': return { ...base, top: -4, left: -4, cursor: 'nw-resize' };
    case 'ne': return { ...base, top: -4, right: -4, cursor: 'ne-resize' };
    case 'sw': return { ...base, bottom: -4, left: -4, cursor: 'sw-resize' };
    case 'se': return { ...base, bottom: -4, right: -4, cursor: 'se-resize' };
    case 'n':  return { ...base, top: -4, left: '50%', marginLeft: -4, cursor: 'n-resize' };
    case 's':  return { ...base, bottom: -4, left: '50%', marginLeft: -4, cursor: 's-resize' };
    case 'e':  return { ...base, top: '50%', right: -4, marginTop: -4, cursor: 'e-resize' };
    case 'w':  return { ...base, top: '50%', left: -4, marginTop: -4, cursor: 'w-resize' };
  }
}

export default function VisualEditor() {
  const targetUrl = useEditorStore((s) => s.targetUrl);
  const components = useEditorStore((s) => s.components);
  const selectedComponentId = useEditorStore((s) => s.selectedComponentId);
  const hoveredComponentId = useEditorStore((s) => s.hoveredComponentId);
  const viewportMode = useEditorStore((s) => s.viewportMode);
  const agentStatus = useAgentStore((s) => s.status);

  const [canvasHeight, setCanvasHeight] = useState(MIN_IFRAME_HEIGHT);
  const pageHeightRef = useRef(MIN_IFRAME_HEIGHT);
  const viewportRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Stable store refs
  const applyChangeRef = useRef(useEditorStore.getState().applyChange);
  const selectRef = useRef(useEditorStore.getState().selectComponent);
  const sendRef = useRef(useAgentStore.getState().sendMessage);

  useEffect(() => useEditorStore.subscribe((s) => {
    applyChangeRef.current = s.applyChange;
    selectRef.current = s.selectComponent;
  }), []);
  useEffect(() => useAgentStore.subscribe((s) => {
    sendRef.current = s.sendMessage;
  }), []);

  // ── Drag / Resize state ──
  const [interaction, setInteraction] = useState<{
    compId: string;
    mode: 'drag' | HandleDir;
    startMouse: { x: number; y: number };
    startBox: BoundingBox;
  } | null>(null);

  // PostMessage: receive iframe scan results + page height
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'wigss-page-height' && typeof e.data.height === 'number') {
        pageHeightRef.current = Math.max(e.data.height, MIN_IFRAME_HEIGHT);
        setCanvasHeight((prev) => Math.max(prev, pageHeightRef.current));
      }
      if (e.data?.type === 'wigss-scan-result' && Array.isArray(e.data.elements)) {
        console.log('[VisualEditor] Received iframe scan:', e.data.elements.length, 'elements');
        const comps = e.data.elements.map((el: any, i: number) => {
          const attrs = el.attributes || {};
          // Use own data-component, or inherit from parent
          const dataComp = attrs['data-component'] || attrs['data-parent-component'] || '';
          const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
          const sourceFile = dataComp
            ? `src/components/${capitalize(dataComp)}.tsx`
            : '';
          return {
            id: `comp-${i}-${el.id || el.tagName}`,
            name: truncateLabel(el.tagName, el.className, el.textContent),
            type: guessComponentType(el.tagName, el.className, attrs),
            elementIds: [el.id],
            boundingBox: el.boundingBox,
            sourceFile,
            reasoning: sourceFile ? `→ ${sourceFile}` : 'no source mapping',
            depth: el.depth ?? 0,
            fullClassName: typeof el.className === 'string' ? el.className : '',
          };
        });
        useEditorStore.getState().setComponents(comps);
        // Sync to server so suggestions use correct component IDs
        sendRef.current('components_synced', { components: comps });
        if (e.data.viewport?.height) {
          pageHeightRef.current = Math.max(e.data.viewport.height, MIN_IFRAME_HEIGHT);
          setCanvasHeight((prev) => Math.max(prev, pageHeightRef.current));
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // ── Mouse handlers for drag/resize ──
  const handleMouseDown = useCallback((
    e: React.MouseEvent, compId: string, mode: 'drag' | HandleDir
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const comp = components.find((c) => c.id === compId);
    if (!comp) return;
    selectRef.current(compId);
    setInteraction({
      compId,
      mode,
      startMouse: { x: e.clientX, y: e.clientY },
      startBox: { ...comp.boundingBox },
    });
  }, [components]);

  useEffect(() => {
    if (!interaction) return;

    const calcNewBox = (e: MouseEvent): BoundingBox => {
      const dx = e.clientX - interaction.startMouse.x;
      const dy = e.clientY - interaction.startMouse.y;
      const sb = interaction.startBox;

      if (interaction.mode === 'drag') {
        return { x: sb.x + dx, y: sb.y + dy, width: sb.width, height: sb.height };
      }
      let { x, y, width: w, height: h } = sb;
      const dir = interaction.mode;
      if (dir.includes('e')) w = Math.max(20, sb.width + dx);
      if (dir.includes('w')) { w = Math.max(20, sb.width - dx); x = sb.x + dx; }
      if (dir.includes('s')) h = Math.max(20, sb.height + dy);
      if (dir.includes('n')) { h = Math.max(20, sb.height - dy); y = sb.y + dy; }
      return { x, y, width: w, height: h };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const newBox = calcNewBox(e);
      const store = useEditorStore.getState();
      const updated = store.components.map((c) =>
        c.id === interaction.compId ? { ...c, boundingBox: newBox } : c
      );
      useEditorStore.setState({ components: updated });

      // Live preview: send style update to iframe
      const comp = store.components.find(c => c.id === interaction.compId);
      if (comp?.fullClassName && iframeRef.current?.contentWindow) {
        const styles: Record<string, string> = {};
        if (interaction.mode !== 'drag') {
          // Resize: update width/height
          if (newBox.width !== interaction.startBox.width) styles.width = `${newBox.width}px`;
          if (newBox.height !== interaction.startBox.height) styles.height = `${newBox.height}px`;
        } else {
          // Move: update margin
          const dy = newBox.y - interaction.startBox.y;
          const dx = newBox.x - interaction.startBox.x;
          if (Math.abs(dy) > 2) styles.marginTop = `${Math.max(0, dy)}px`;
          if (Math.abs(dx) > 2) styles.marginLeft = `${Math.max(0, dx)}px`;
        }
        if (Object.keys(styles).length > 0) {
          // Use first 20 chars of className as unique identifier
          const classKey = comp.fullClassName.split(' ').slice(0, 3).join(' ');
          iframeRef.current.contentWindow.postMessage({
            type: 'wigss-live-style',
            className: classKey,
            styles,
          }, '*');
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const newBox = calcNewBox(e);
      const sb = interaction.startBox;
      const moved = sb.x !== newBox.x || sb.y !== newBox.y;
      const resized = sb.width !== newBox.width || sb.height !== newBox.height;

      if (moved || resized) {
        // Record ONE change (not per-frame)
        const change: ComponentChange = {
          componentId: interaction.compId,
          type: resized ? 'resize' : 'move',
          from: sb,
          to: newBox,
        };
        applyChangeRef.current(change);

        // Notify AI agent
        const msgType = resized ? 'resize_end' : 'drag_end';
        sendRef.current(msgType, {
          componentId: interaction.compId,
          from: sb,
          to: newBox,
        });
      }
      setInteraction(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [interaction]);

  // ── Sort: biggest area first (background, low z), smallest last (foreground, high z) ──
  const sortedComponents = [...components].sort((a, b) => {
    const areaA = a.boundingBox.width * a.boundingBox.height;
    const areaB = b.boundingBox.width * b.boundingBox.height;
    return areaB - areaA;
  });

  // Background threshold: elements covering >60% of viewport get subtle styling but remain clickable
  const viewportArea = DESKTOP_WIDTH * Math.max(canvasHeight, 800);
  const areaThreshold = viewportArea * 0.6;

  const fixedWidth = viewportMode === 'mobile' ? MOBILE_WIDTH : DESKTOP_WIDTH;

  return (
    <div
      className="relative flex-1 bg-gray-950 overflow-hidden flex items-start justify-center"
      onClick={() => selectRef.current(null)}
    >
      <div
        ref={viewportRef}
        className="relative h-full overflow-auto"
      >
        {targetUrl ? (
          <div
            className="relative min-h-full"
            style={{ width: fixedWidth, height: canvasHeight > 0 ? canvasHeight : undefined }}
          >
            {/* Background: actual page */}
            <iframe
              ref={iframeRef}
              src={targetUrl}
              className="border-0 bg-white"
              style={{ width: fixedWidth, height: canvasHeight > 0 ? canvasHeight : '100%', pointerEvents: 'none' }}
              title="Target page preview"
            />

            {/* Center spinner for agent status */}
            {agentStatus !== 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 9998 }}>
                <div className="flex flex-col items-center gap-3 bg-gray-900/80 backdrop-blur-md rounded-2xl px-8 py-6 border border-gray-700/50 shadow-2xl">
                  <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid #4b5563', borderTopColor: '#a78bfa' }} />
                  <span className="text-sm font-medium text-gray-200">
                    {agentStatus === 'scanning' && 'Scanning...'}
                    {agentStatus === 'detecting' && 'Detecting Components...'}
                    {agentStatus === 'suggesting' && 'AI Suggestions...'}
                    {agentStatus === 'feedback' && 'Analyzing...'}
                    {agentStatus === 'chatting' && 'AI Thinking...'}
                    {agentStatus === 'refactoring' && 'Saving...'}
                    {agentStatus === 'applying' && 'Applying...'}
                    {agentStatus === 'verifying' && 'Verifying...'}
                  </span>
                </div>
              </div>
            )}

            {/* Overlay: draggable/resizable component boxes */}
            <div
              ref={overlayRef}
              className="absolute inset-0"
              style={{ zIndex: 10 }}
            >
              {sortedComponents.map((comp, idx) => {
                const isSelected = comp.id === selectedComponentId;
                const isHovered = comp.id === hoveredComponentId;
                const depth = comp.depth ?? 0;
                const colors = isSelected ? SELECTED : (TYPE_COLORS[comp.type] || TYPE_COLORS.section);
                const opacity = depthOpacity(depth);
                const area = comp.boundingBox.width * comp.boundingBox.height;
                const isBackground = area >= areaThreshold && !isSelected && !isHovered;

                return (
                  <div
                    key={comp.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectRef.current(comp.id);
                    }}
                    onMouseDown={(e) => {
                      if (isBackground && !isSelected) {
                        e.stopPropagation();
                        selectRef.current(comp.id);
                      }
                      if (isSelected) handleMouseDown(e, comp.id, 'drag');
                    }}
                    className="wigss-overlay-box"
                    style={{
                      position: 'absolute',
                      left: comp.boundingBox.x,
                      top: comp.boundingBox.y,
                      width: comp.boundingBox.width,
                      height: comp.boundingBox.height,
                      border: isSelected
                        ? `2.5px solid ${colors.stroke}`
                        : isHovered
                          ? '2.5px solid #facc15'
                          : isBackground
                            ? `1px dashed ${colors.stroke}40`
                            : `1px dashed ${colors.stroke}80`,
                      backgroundColor: isHovered ? 'rgba(250, 204, 21, 0.08)' : 'transparent',
                      boxShadow: isHovered ? '0 0 16px rgba(250, 204, 21, 0.5), 0 0 32px rgba(250, 204, 21, 0.2)' : 'none',
                      opacity: isBackground ? 0.3 : isHovered ? 1 : opacity,
                      cursor: isSelected ? (interaction?.compId === comp.id ? 'grabbing' : 'grab') : 'pointer',
                      boxSizing: 'border-box',
                      pointerEvents: 'auto',
                      zIndex: isSelected ? 9999 : idx + 1,
                      transition: interaction ? 'none' : 'all 0.15s ease',
                    }}
                  >
                    {/* Label */}
                    <span style={{
                      position: 'absolute', top: -18, left: 0,
                      fontSize: 9, color: '#fff', backgroundColor: colors.label,
                      padding: '1px 4px', whiteSpace: 'nowrap',
                      borderRadius: '2px 2px 0 0', opacity: 0.9,
                      maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {depth > 0 && <span style={{ opacity: 0.6 }}>{'·'.repeat(depth)} </span>}
                      {comp.name}
                    </span>

                    {/* Depth badge */}
                    {depth > 0 && (
                      <span style={{
                        position: 'absolute', top: 2, right: 2,
                        fontSize: 8, color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)',
                        padding: '0 3px', borderRadius: 2, lineHeight: '14px',
                      }}>
                        L{depth}
                      </span>
                    )}

                    {/* Resize handles (only for selected) */}
                    {isSelected && HANDLES.map((dir) => (
                      <div
                        key={dir}
                        onMouseDown={(e) => handleMouseDown(e, comp.id, dir)}
                        style={handleStyle(dir)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600">
            <div className="text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-gray-600 mb-3 opacity-40">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <p className="text-sm text-gray-500">No target URL configured</p>
              <p className="text-xs text-gray-600 mt-1">Click Scan to analyze a page</p>
            </div>
          </div>
        )}
      </div>

      {viewportMode === 'mobile' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-gray-800/80 rounded-full text-[10px] text-gray-400 backdrop-blur-sm">
          375px - Mobile
        </div>
      )}
    </div>
  );
}
