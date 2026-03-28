'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, Rect, Text as FabricText } from 'fabric';
import { useEditorStore } from '@/stores/editor-store';
import { useAgentStore } from '@/stores/agent-store';
import type { BoundingBox, ComponentType, ComponentChange } from '@/types';

const TYPE_STROKE: Record<ComponentType, string> = {
  navbar: '#22d3ee',
  header: '#a78bfa',
  hero: '#f59e0b',
  grid: '#34d399',
  card: '#2dd4bf',
  sidebar: '#ec4899',
  footer: '#6b7280',
  section: '#60a5fa',
  form: '#fb923c',
  modal: '#ef4444',
};

const TYPE_FILL: Record<ComponentType, string> = {
  navbar: 'rgba(34, 211, 238, 0.10)',
  header: 'rgba(167, 139, 250, 0.10)',
  hero: 'rgba(245, 158, 11, 0.10)',
  grid: 'rgba(52, 211, 153, 0.10)',
  card: 'rgba(45, 212, 191, 0.10)',
  sidebar: 'rgba(236, 72, 153, 0.10)',
  footer: 'rgba(107, 114, 128, 0.10)',
  section: 'rgba(96, 165, 250, 0.10)',
  form: 'rgba(251, 146, 60, 0.10)',
  modal: 'rgba(239, 68, 68, 0.10)',
};

const TYPE_LABEL_BG: Record<ComponentType, string> = {
  navbar: '#0891b2',
  header: '#7c3aed',
  hero: '#d97706',
  grid: '#059669',
  card: '#0d9488',
  sidebar: '#db2777',
  footer: '#4b5563',
  section: '#2563eb',
  form: '#ea580c',
  modal: '#dc2626',
};

type RectMeta = {
  componentId: string;
  componentType: ComponentType;
  label: string;
  box: BoundingBox;
};

type EditableRect = Rect & { data?: RectMeta };
type LabelText = FabricText & { data?: { componentId: string } };

function getRectStyle(type: ComponentType, selected: boolean) {
  if (selected) {
    return {
      stroke: '#60a5fa',
      fill: 'rgba(59, 130, 246, 0.14)',
      strokeWidth: 2,
      labelBg: '#3b82f6',
    };
  }

  return {
    stroke: TYPE_STROKE[type],
    fill: TYPE_FILL[type],
    strokeWidth: 1,
    labelBg: TYPE_LABEL_BG[type],
  };
}

function readRectBox(rect: EditableRect): BoundingBox {
  return {
    x: Math.round(rect.left ?? 0),
    y: Math.round(rect.top ?? 0),
    width: Math.max(1, Math.round((rect.width ?? 0) * (rect.scaleX ?? 1))),
    height: Math.max(1, Math.round((rect.height ?? 0) * (rect.scaleY ?? 1))),
  };
}

function getCanvasDimensions(
  viewport: HTMLDivElement | null,
  components: { boundingBox: BoundingBox }[],
) {
  const width = viewport?.clientWidth ?? 0;
  const viewportHeight = viewport?.clientHeight ?? 0;
  let maxBottom = 0;

  for (const component of components) {
    const bottom = component.boundingBox.y + component.boundingBox.height;
    if (bottom > maxBottom) {
      maxBottom = bottom;
    }
  }

  const height = Math.max(viewportHeight, maxBottom + 80);
  return { width, height };
}

export default function VisualEditor() {
  const targetUrl = useEditorStore((s) => s.targetUrl);
  const components = useEditorStore((s) => s.components);
  const selectedComponentId = useEditorStore((s) => s.selectedComponentId);
  const selectComponent = useEditorStore((s) => s.selectComponent);
  const viewportMode = useEditorStore((s) => s.viewportMode);
  const applyChange = useEditorStore((s) => s.applyChange);
  const pushCanvasSnapshot = useEditorStore((s) => s.pushCanvasSnapshot);
  const sendMessage = useAgentStore((s) => s.sendMessage);

  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const rectMapRef = useRef<Map<string, EditableRect>>(new Map());
  const labelMapRef = useRef<Map<string, LabelText>>(new Map());
  const componentsRef = useRef(components);
  const resizeCanvasRef = useRef<(() => void) | null>(null);
  const [canvasHeight, setCanvasHeight] = useState(0);

  useEffect(() => {
    componentsRef.current = components;
    resizeCanvasRef.current?.();
  }, [components]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      selection: false,
      preserveObjectStacking: true,
    });
    fabricCanvasRef.current = canvas;

    const resize = () => {
      const { width, height } = getCanvasDimensions(
        viewportRef.current,
        componentsRef.current,
      );
      if (width <= 0 || height <= 0) return;
      setCanvasHeight(height);
      canvas.setDimensions({ width, height });
      canvas.requestRenderAll();
    };
    resizeCanvasRef.current = resize;

    const updateLabelPosition = (rect: EditableRect) => {
      const label = labelMapRef.current.get(rect.data?.componentId ?? '');
      if (!label) return;
      label.set({
        left: (rect.left ?? 0) + 4,
        top: Math.max(0, (rect.top ?? 0) - 16),
      });
    };

    const normalizeRect = (rect: EditableRect, box: BoundingBox) => {
      rect.set({
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        scaleX: 1,
        scaleY: 1,
      });
    };

    const onObjectMoving = (event: any) => {
      const rect = event?.target as EditableRect | undefined;
      if (!rect?.data) return;
      updateLabelPosition(rect);
      canvas.requestRenderAll();
    };

    const onObjectScaling = (event: any) => {
      const rect = event?.target as EditableRect | undefined;
      if (!rect?.data) return;
      updateLabelPosition(rect);
      canvas.requestRenderAll();
    };

    const onObjectModified = (event: any) => {
      const rect = event?.target as EditableRect | undefined;
      if (!rect?.data) return;

      const previous = rect.data.box;
      const next = readRectBox(rect);
      normalizeRect(rect, next);
      updateLabelPosition(rect);

      const moved = previous.x !== next.x || previous.y !== next.y;
      const resized = previous.width !== next.width || previous.height !== next.height;
      if (!moved && !resized) {
        canvas.requestRenderAll();
        return;
      }

      const change: ComponentChange = {
        componentId: rect.data.componentId,
        type: resized ? 'resize' : 'move',
        from: {
          x: previous.x,
          y: previous.y,
          width: previous.width,
          height: previous.height,
        },
        to: {
          x: next.x,
          y: next.y,
          width: next.width,
          height: next.height,
        },
      };

      applyChange(change);

      if (moved) {
        sendMessage('drag_end', {
          componentId: rect.data.componentId,
          from: previous,
          to: next,
        });
      }

      if (resized) {
        sendMessage('resize_end', {
          componentId: rect.data.componentId,
          from: previous,
          to: next,
        });
      }

      rect.data = { ...rect.data, box: next };
      pushCanvasSnapshot(canvas.toJSON());
      canvas.requestRenderAll();
    };

    const onSelectionCreated = (event: any) => {
      const selected = (event?.selected?.[0] ?? null) as EditableRect | null;
      selectComponent(selected?.data?.componentId ?? null);
    };

    const onSelectionUpdated = (event: any) => {
      const selected = (event?.selected?.[0] ?? null) as EditableRect | null;
      selectComponent(selected?.data?.componentId ?? null);
    };

    const onSelectionCleared = () => {
      selectComponent(null);
    };

    canvas.on('object:moving', onObjectMoving);
    canvas.on('object:scaling', onObjectScaling);
    canvas.on('object:modified', onObjectModified);
    canvas.on('selection:created', onSelectionCreated);
    canvas.on('selection:updated', onSelectionUpdated);
    canvas.on('selection:cleared', onSelectionCleared);

    const observer = new ResizeObserver(resize);
    if (viewportRef.current) {
      observer.observe(viewportRef.current);
    }
    resize();

    return () => {
      observer.disconnect();
      canvas.off('object:moving', onObjectMoving);
      canvas.off('object:scaling', onObjectScaling);
      canvas.off('object:modified', onObjectModified);
      canvas.off('selection:created', onSelectionCreated);
      canvas.off('selection:updated', onSelectionUpdated);
      canvas.off('selection:cleared', onSelectionCleared);
      canvas.dispose();
      fabricCanvasRef.current = null;
      resizeCanvasRef.current = null;
      rectMapRef.current.clear();
      labelMapRef.current.clear();
    };
  }, [applyChange, pushCanvasSnapshot, selectComponent, sendMessage]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    let needsInitialRender = false;

    for (const component of components) {
      if (rectMapRef.current.has(component.id)) continue;

      needsInitialRender = true;
      const style = getRectStyle(component.type, component.id === selectedComponentId);
      const rect = new Rect({
        left: component.boundingBox.x,
        top: component.boundingBox.y,
        width: component.boundingBox.width,
        height: component.boundingBox.height,
        fill: style.fill,
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
        strokeDashArray: [6, 4],
        lockRotation: true,
        hasRotatingPoint: false,
        cornerColor: '#60a5fa',
        cornerStrokeColor: '#ffffff',
        borderColor: '#60a5fa',
        transparentCorners: false,
      }) as EditableRect;

      rect.data = {
        componentId: component.id,
        componentType: component.type,
        label: component.name,
        box: { ...component.boundingBox },
      };

      const label = new FabricText(component.name, {
        left: component.boundingBox.x + 4,
        top: Math.max(0, component.boundingBox.y - 16),
        fontSize: 10,
        fill: '#ffffff',
        backgroundColor: style.labelBg,
        selectable: false,
        evented: false,
      }) as LabelText;
      label.data = { componentId: component.id };

      rectMapRef.current.set(component.id, rect);
      labelMapRef.current.set(component.id, label);
      canvas.add(rect);
      canvas.add(label);
    }

    for (const [id, rect] of Array.from(rectMapRef.current.entries())) {
      if (!components.find((c) => c.id === id)) {
        needsInitialRender = true;
        canvas.remove(rect);
        rectMapRef.current.delete(id);
        
        const label = labelMapRef.current.get(id);
        if (label) {
          canvas.remove(label);
          labelMapRef.current.delete(id);
        }
      }
    }

    if (needsInitialRender) {
      pushCanvasSnapshot(canvas.toJSON());
      canvas.requestRenderAll();
    }
    resizeCanvasRef.current?.();
  }, [components, pushCanvasSnapshot]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    let needsRender = false;

    for (const component of components) {
      const rect = rectMapRef.current.get(component.id);
      const label = labelMapRef.current.get(component.id);
      if (!rect || !label) continue;

      const style = getRectStyle(component.type, component.id === selectedComponentId);
      if (rect.fill !== style.fill || rect.stroke !== style.stroke) {
        rect.set({
          stroke: style.stroke,
          fill: style.fill,
          strokeWidth: style.strokeWidth,
        });
        label.set({ backgroundColor: style.labelBg });
        needsRender = true;
      }

      const box = component.boundingBox;
      const currentBox = rect.data?.box;
      
      if (currentBox && (
        box.x !== currentBox.x || 
        box.y !== currentBox.y || 
        box.width !== currentBox.width || 
        box.height !== currentBox.height
      )) {
        rect.set({
          left: box.x,
          top: box.y,
          width: box.width,
          height: box.height,
          scaleX: 1,
          scaleY: 1,
        });
        
        label.set({
          left: box.x + 4,
          top: Math.max(0, box.y - 16),
        });

        rect.data = { ...rect.data!, box: { ...box } };
        needsRender = true;
      }
    }

    if (!selectedComponentId) {
      if (canvas.getActiveObject()) {
        canvas.discardActiveObject();
        needsRender = true;
      }
    } else {
      const activeRect = rectMapRef.current.get(selectedComponentId);
      if (activeRect && canvas.getActiveObject() !== activeRect) {
        canvas.setActiveObject(activeRect);
        needsRender = true;
      }
    }

    if (needsRender) {
      canvas.requestRenderAll();
    }
    resizeCanvasRef.current?.();
  }, [components, selectedComponentId]);

  const iframeWidth = viewportMode === 'mobile' ? 375 : '100%';

  return (
    <div className="relative flex-1 bg-gray-950 overflow-hidden flex items-start justify-center">
      <div
        ref={viewportRef}
        className="relative h-full overflow-y-auto overflow-x-hidden transition-all duration-300 ease-out"
        style={{
          width: typeof iframeWidth === 'number' ? iframeWidth : undefined,
          maxWidth: typeof iframeWidth === 'string' ? iframeWidth : undefined,
          flex: typeof iframeWidth === 'string' ? 1 : undefined,
        }}
      >
        {targetUrl ? (
          <div
            className="relative w-full min-h-full"
            style={{ height: canvasHeight > 0 ? canvasHeight : undefined }}
          >
            <iframe
              src={targetUrl}
              className="w-full border-0 bg-white"
              style={{ height: canvasHeight > 0 ? canvasHeight : '100%', pointerEvents: 'none' }}
              title="Target page preview"
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full"
              style={{ pointerEvents: 'auto' }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600">
            <div className="text-center">
              <div className="text-4xl mb-3 opacity-40">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-gray-600">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">No target URL configured</p>
              <p className="text-xs text-gray-600 mt-1">
                Click Scan to analyze a page
              </p>
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
