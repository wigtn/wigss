'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useShallow } from 'zustand/react/shallow';
import { TYPE_COLORS } from './VisualEditor';
import type { ComponentType } from '@/types';

interface ComponentTagBarProps {
  viewportRef: React.RefObject<HTMLDivElement | null>;
}

export default function ComponentTagBar({ viewportRef }: ComponentTagBarProps) {
  const [open, setOpen] = useState(false);

  const { components, selectedComponentId, hoveredComponentId } = useEditorStore(
    useShallow((s) => ({
      components: s.components,
      selectedComponentId: s.selectedComponentId,
      hoveredComponentId: s.hoveredComponentId,
    })),
  );

  const selectComponent = useEditorStore((s) => s.selectComponent);
  const hoverComponent = useEditorStore((s) => s.hoverComponent);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedTagRef = useRef<HTMLButtonElement>(null);

  // Sort: depth asc, then y asc
  const sortedComponents = useMemo(
    () =>
      [...components].sort((a, b) => {
        const da = a.depth ?? 0;
        const db = b.depth ?? 0;
        if (da !== db) return da - db;
        return a.boundingBox.y - b.boundingBox.y;
      }),
    [components],
  );

  // Number duplicate names
  const displayNames = useMemo(() => {
    const nameCounts = new Map<string, number>();
    const nameIndices = new Map<string, number>();
    for (const comp of sortedComponents) {
      nameCounts.set(comp.name, (nameCounts.get(comp.name) ?? 0) + 1);
    }
    const result = new Map<string, string>();
    for (const comp of sortedComponents) {
      const count = nameCounts.get(comp.name) ?? 1;
      if (count > 1) {
        const idx = (nameIndices.get(comp.name) ?? 0) + 1;
        nameIndices.set(comp.name, idx);
        result.set(comp.id, `${comp.name} ${idx}`);
      } else {
        result.set(comp.id, comp.name);
      }
    }
    return result;
  }, [sortedComponents]);

  // Auto-scroll tag bar to show selected tag
  useEffect(() => {
    if (open && selectedTagRef.current && scrollContainerRef.current) {
      selectedTagRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedComponentId, open]);

  const handleClick = (compId: string) => {
    selectComponent(compId);
    const comp = components.find((c) => c.id === compId);
    if (comp && viewportRef.current) {
      viewportRef.current.scrollTop = Math.max(0, comp.boundingBox.y - 100);
    }
  };

  if (components.length === 0) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute left-3 z-50"
      style={{ top: 48 }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
          transition-all duration-200 cursor-pointer backdrop-blur-md
          ${open
            ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
            : 'bg-gray-900/90 text-gray-400 border border-gray-700/50 hover:text-white hover:bg-gray-800/90'
          }
        `}
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span>{components.length} Components</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={scrollContainerRef}
          className="mt-1.5 flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-gray-900/95 backdrop-blur-md border border-gray-700/50 shadow-2xl"
          style={{ maxWidth: 480, maxHeight: 280, overflowY: 'auto', scrollbarWidth: 'thin' }}
        >
          {sortedComponents.map((comp) => {
            const isSelected = comp.id === selectedComponentId;
            const isHovered = comp.id === hoveredComponentId;
            const colors = TYPE_COLORS[comp.type as ComponentType] || TYPE_COLORS.section;
            const depth = comp.depth ?? 0;

            return (
              <button
                key={comp.id}
                ref={isSelected ? selectedTagRef : undefined}
                onClick={() => handleClick(comp.id)}
                onMouseEnter={() => hoverComponent(comp.id)}
                onMouseLeave={() => hoverComponent(null)}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium
                  whitespace-nowrap transition-colors duration-150 cursor-pointer
                  ${isSelected
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                    : isHovered
                      ? 'bg-gray-700/80 text-white border border-gray-600/50'
                      : 'bg-gray-800/60 text-gray-300 border border-gray-700/50 hover:bg-gray-700/80 hover:text-white'
                  }
                `}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: colors.stroke }}
                />
                {depth > 0 && (
                  <span className="text-gray-500 text-[9px]">L{depth}</span>
                )}
                {displayNames.get(comp.id) ?? comp.name}
                {comp.textHint && (
                  <span className="text-gray-500 text-[9px] max-w-[120px] truncate">
                    — {comp.textHint}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
