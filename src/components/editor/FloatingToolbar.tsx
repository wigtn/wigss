'use client';

import { useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useAgentStore } from '@/stores/agent-store';

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-emerald-400',
  scanning: 'bg-amber-400 animate-pulse',
  detecting: 'bg-amber-400 animate-pulse',
  suggesting: 'bg-blue-400 animate-pulse',
  feedback: 'bg-violet-400 animate-pulse',
  chatting: 'bg-blue-400 animate-pulse',
  refactoring: 'bg-orange-400 animate-pulse',
  applying: 'bg-orange-400 animate-pulse',
  verifying: 'bg-cyan-400 animate-pulse',
};

const STATUS_LABELS: Record<string, string> = {
  idle: 'Ready',
  scanning: 'Scanning...',
  detecting: 'Detecting...',
  suggesting: 'Suggesting...',
  feedback: 'Analyzing...',
  chatting: 'Thinking...',
  refactoring: 'Refactoring...',
  applying: 'Applying...',
  verifying: 'Verifying...',
};

export default function FloatingToolbar() {
  const {
    targetUrl,
    projectPath,
    viewportMode,
    setViewportMode,
    changes,
    components,
    diffs,
    canUndo,
    canRedo,
    undo,
    redo,
    clearChanges,
    setDiffs,
  } = useEditorStore();

  const { status, connected, sendMessage, addLog } = useAgentStore();

  const [open, setOpen] = useState(false);

  const handleScan = () => {
    sendMessage('scan', { url: targetUrl, projectPath });
  };

  const [saveState, setSaveState] = useState<'idle' | 'generating' | 'preview' | 'applying' | 'done' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  const handleSave = async () => {
    const effectivePath = projectPath || 'auto';

    console.log('[Save] State:', { changesCount: changes.length, diffsCount: diffs.length, saveState, componentsCount: components.length });

    // Clear stale diffs from previous save
    if (diffs.length > 0) {
      setDiffs([]);
    }

    // Generate diffs from changes
    if (changes.length > 0) {
      setSaveState('generating');
      setSaveMessage(`${changes.length}개 변경사항으로 코드 수정 생성 중...`);
      useAgentStore.getState().setStatus('refactoring');
      addLog('refactor_start', `Generating diffs from ${changes.length} change(s)`);
      console.log('[Save] changes:', JSON.stringify(changes, null, 2));
      console.log('[Save] components count:', components.length);
      console.log('[Save] projectPath:', effectivePath);

      try {
        const response = await fetch('/api/refactor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ changes, components, projectPath: effectivePath }),
        });
        const result = await response.json() as {
          success: boolean;
          data?: { diffs: typeof diffs; message?: string };
          error?: { message?: string };
        };

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error?.message || 'Failed to generate diffs');
        }

        if (result.data.diffs.length === 0) {
          setSaveState('error');
          setSaveMessage('코드 변경을 생성하지 못했습니다. 더 큰 변경을 해보세요.');
          setTimeout(() => { setSaveState('idle'); setSaveMessage(''); }, 3000);
          return;
        }

        // Auto-apply immediately (no 2-step confirmation)
        const generatedDiffs = result.data.diffs;
        const diffFiles = generatedDiffs.map((d: any) => d.file?.split('/').pop()).filter(Boolean).join(', ');
        setSaveState('applying');
        setSaveMessage(`${generatedDiffs.length}개 변경 적용 중 (${diffFiles})...`);
        addLog('diff_preview', `Generated ${generatedDiffs.length} diff(s), auto-applying...`);

        // Apply immediately
        const applyResponse = await fetch('/api/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ diffs: generatedDiffs, projectPath: effectivePath }),
        });
        const applyResult = await applyResponse.json() as {
          success: boolean;
          data?: { applied: number; filesChanged: string[]; failed: { file: string; reason: string }[] };
          error?: { message?: string };
        };

        if (!applyResponse.ok || !applyResult.success || !applyResult.data) {
          throw new Error(applyResult.error?.message || 'Failed to apply changes');
        }

        const { applied, filesChanged, failed } = applyResult.data;
        const fileList = filesChanged.map((f: string) => f.split('/').pop()).join(', ');
        setSaveState('done');
        setSaveMessage(`✓ 저장 완료! ${applied}개 수정 적용: ${fileList}`);
        addLog('apply_done', `Applied ${applied} diff(s) across ${filesChanged.length} file(s)`);

        if (failed.length > 0) {
          addLog('apply_partial', `${failed.length} diff(s) failed`);
        }

        clearChanges();
        setDiffs([]);

        // Clear old suggestions/feedbacks (will regenerate after re-scan)
        useAgentStore.getState().clearSuggestions();
        useAgentStore.getState().clearFeedbacks();

        useAgentStore.getState().setStatus('idle');

        // Reload iframe + re-scan
        setTimeout(() => {
          const iframes = document.querySelectorAll('iframe');
          for (const iframe of Array.from(iframes)) {
            try { iframe.contentWindow?.location.reload(); } catch {}
          }
        }, 1000);
        setTimeout(() => {
          sendMessage('scan', { url: targetUrl, projectPath: effectivePath });
        }, 3000);

        setTimeout(() => { setSaveState('idle'); setSaveMessage(''); }, 5000);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setSaveState('error');
        setSaveMessage(`Error: ${msg}`);
        addLog('refactor_error', msg);
        setDiffs([]);
        useAgentStore.getState().setStatus('idle');
        setTimeout(() => { setSaveState('idle'); setSaveMessage(''); }, 4000);
      }
      return;
    }

  };


  const handleToggleViewport = () => {
    const next = viewportMode === 'desktop' ? 'mobile' : 'desktop';
    setViewportMode(next);
    sendMessage('mobile_view', { targetWidth: next === 'mobile' ? 375 : 1280 });
  };

  return (
    <div
      className="fixed left-0 right-0 z-50 transition-transform duration-300 ease-out"
      style={{ top: open ? 0 : -44 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Toolbar bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/95 backdrop-blur-md border-b border-gray-800/60">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-wider text-white/90">
            WIGSS
          </span>
          <div className="w-px h-4 bg-gray-700" />
        </div>

        {/* Center: Action buttons */}
        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={handleScan}
            disabled={!connected || status !== 'idle'}
            title="Scan target page"
          >
            <ScanIcon />
            <span>Scan</span>
          </ToolbarButton>

          <ToolbarButton
            onClick={handleToggleViewport}
            active={viewportMode === 'mobile'}
            title={viewportMode === 'desktop' ? 'Switch to mobile view' : 'Switch to desktop view'}
          >
            <MobileIcon />
            <span>{viewportMode === 'desktop' ? 'Mobile' : 'Desktop'}</span>
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-700 mx-1" />

          <ToolbarButton
            onClick={handleSave}
            disabled={changes.length === 0 || saveState === 'generating' || saveState === 'applying'}
            title="Save changes to source code"
          >
            <SaveIcon />
            <span>
              {saveState === 'generating' ? '생성 중...' :
               saveState === 'applying' ? '적용 중...' :
               saveState === 'done' ? '저장 완료!' :
               saveState === 'error' ? '오류' :
               `Save${changes.length > 0 ? ` (${changes.length})` : ''}`}
            </span>
          </ToolbarButton>

          <ToolbarButton
            onClick={undo}
            disabled={!canUndo()}
            title="Undo"
          >
            <UndoIcon />
          </ToolbarButton>

          <ToolbarButton
            onClick={redo}
            disabled={!canRedo()}
            title="Redo"
          >
            <RedoIcon />
          </ToolbarButton>
        </div>

        {/* Right: Agent status & Trae Badge */}
        <div className="flex items-center gap-4">
          <a
            href="https://trae.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors group"
          >
            <span className="text-[10px] font-medium text-blue-400/80 group-hover:text-blue-300">Built with</span>
            <span className="text-[10px] font-bold text-blue-400 group-hover:text-blue-300">Trae.ai</span>
          </a>

          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? STATUS_COLORS[status] || 'bg-gray-400' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-400">
              {connected ? STATUS_LABELS[status] || status : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Arrow tab — always visible, sticks to bottom of toolbar */}
      <div className="flex justify-center">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-10 h-5 flex items-center justify-center rounded-b-lg bg-purple-800/90 cursor-pointer hover:bg-purple-700 transition-colors"
          aria-label="Toggle toolbar"
        >
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Save status banner */}
      {saveMessage && (
        <div className={`px-4 py-2 text-xs text-center pointer-events-none ${
          saveState === 'done' ? 'bg-green-900/90 text-green-200' :
          saveState === 'error' ? 'bg-red-900/90 text-red-200' :
          saveState === 'preview' ? 'bg-blue-900/90 text-blue-200' :
          'bg-gray-800/90 text-gray-300'
        }`}>
          {saveState === 'generating' && <span className="animate-pulse mr-2">●</span>}
          {saveState === 'applying' && <span className="animate-pulse mr-2">●</span>}
          {saveState === 'done' && <span className="mr-2">✓</span>}
          {saveState === 'error' && <span className="mr-2">✗</span>}
          {saveMessage}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolbarButton
// ---------------------------------------------------------------------------

function ToolbarButton({
  children,
  onClick,
  disabled,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
        transition-colors duration-150
        ${active
          ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
          : 'text-gray-300 hover:text-white hover:bg-gray-800/80'
        }
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// SVG Icons (inline, no external deps)
// ---------------------------------------------------------------------------

function ScanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

function MobileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12" y2="18" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}
