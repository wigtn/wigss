'use client';

import { useRef, useCallback } from 'react';
import { useEditorStore } from '@/stores/editor-store';

const COMPONENT_TYPE_COLORS: Record<string, string> = {
  navbar: 'border-cyan-500/60',
  header: 'border-violet-500/60',
  hero: 'border-amber-500/60',
  grid: 'border-emerald-500/60',
  card: 'border-teal-500/60',
  sidebar: 'border-pink-500/60',
  footer: 'border-gray-500/60',
  section: 'border-blue-500/60',
  form: 'border-orange-500/60',
  modal: 'border-red-500/60',
};

const COMPONENT_TYPE_BG: Record<string, string> = {
  navbar: 'bg-cyan-500/8',
  header: 'bg-violet-500/8',
  hero: 'bg-amber-500/8',
  grid: 'bg-emerald-500/8',
  card: 'bg-teal-500/8',
  sidebar: 'bg-pink-500/8',
  footer: 'bg-gray-500/8',
  section: 'bg-blue-500/8',
  form: 'bg-orange-500/8',
  modal: 'bg-red-500/8',
};

const LABEL_COLORS: Record<string, string> = {
  navbar: 'bg-cyan-600',
  header: 'bg-violet-600',
  hero: 'bg-amber-600',
  grid: 'bg-emerald-600',
  card: 'bg-teal-600',
  sidebar: 'bg-pink-600',
  footer: 'bg-gray-600',
  section: 'bg-blue-600',
  form: 'bg-orange-600',
  modal: 'bg-red-600',
};

export default function VisualEditor() {
  const {
    targetUrl,
    components,
    selectedComponentId,
    selectComponent,
    viewportMode,
  } = useEditorStore();

  const containerRef = useRef<HTMLDivElement>(null);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent, componentId: string) => {
      e.stopPropagation();
      selectComponent(componentId);
    },
    [selectComponent],
  );

  const handleBackgroundClick = useCallback(() => {
    selectComponent(null);
  }, [selectComponent]);

  const iframeWidth = viewportMode === 'mobile' ? 375 : '100%';

  return (
    <div
      ref={containerRef}
      className="relative flex-1 bg-gray-950 overflow-hidden flex items-start justify-center"
      onClick={handleBackgroundClick}
    >
      {/* Viewport container */}
      <div
        className="relative h-full transition-all duration-300 ease-out"
        style={{
          width: typeof iframeWidth === 'number' ? iframeWidth : undefined,
          maxWidth: typeof iframeWidth === 'string' ? iframeWidth : undefined,
          flex: typeof iframeWidth === 'string' ? 1 : undefined,
        }}
      >
        {/* iframe showing target page */}
        {targetUrl ? (
          <iframe
            src={targetUrl}
            className="w-full h-full border-0 bg-white"
            style={{ pointerEvents: 'none' }}
            title="Target page preview"
          />
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

        {/* Component overlays */}
        <div className="absolute inset-0">
          {components.map((comp) => {
            const isSelected = comp.id === selectedComponentId;
            const borderColor = isSelected
              ? 'border-blue-400'
              : COMPONENT_TYPE_COLORS[comp.type] || 'border-gray-500/60';
            const bgColor = isSelected
              ? 'bg-blue-500/10'
              : COMPONENT_TYPE_BG[comp.type] || 'bg-gray-500/8';
            const labelBg = isSelected
              ? 'bg-blue-500'
              : LABEL_COLORS[comp.type] || 'bg-gray-600';

            return (
              <div
                key={comp.id}
                className={`
                  absolute border pointer-events-auto cursor-pointer
                  transition-all duration-150
                  ${borderColor}
                  ${bgColor}
                  ${isSelected ? 'border-2 shadow-lg shadow-blue-500/20' : 'border border-dashed'}
                  hover:border-solid hover:border-blue-400/80
                `}
                style={{
                  left: comp.boundingBox.x,
                  top: comp.boundingBox.y,
                  width: comp.boundingBox.width,
                  height: comp.boundingBox.height,
                }}
                onClick={(e) => handleOverlayClick(e, comp.id)}
              >
                {/* Component label */}
                <span
                  className={`
                    absolute -top-5 left-0 px-1.5 py-0.5 text-[10px]
                    font-medium text-white rounded-t-sm whitespace-nowrap
                    ${labelBg}
                  `}
                >
                  {comp.name}
                </span>

                {/* Selected indicator: resize handles (visual only for Phase 1) */}
                {isSelected && (
                  <>
                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-400 rounded-full" />
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full" />
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-400 rounded-full" />
                    <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-400 rounded-full" />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile viewport indicator */}
      {viewportMode === 'mobile' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-gray-800/80 rounded-full text-[10px] text-gray-400 backdrop-blur-sm">
          375px - Mobile
        </div>
      )}
    </div>
  );
}
