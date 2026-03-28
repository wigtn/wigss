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

  const handleScan = () => {
    sendMessage('scan', { url: targetUrl, projectPath });
  };

  const [saveState, setSaveState] = useState<'idle' | 'generating' | 'preview' | 'applying' | 'done' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  const handleSave = async () => {
    const effectivePath = projectPath || 'auto';

    // Step 1: Generate diffs from changes
    if (diffs.length === 0 && changes.length > 0) {
      setSaveState('generating');
      setSaveMessage(`${changes.length}개 변경사항으로 코드 수정 생성 중...`);
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
          setSaveMessage('No code changes generated. Try making bigger edits.');
          setTimeout(() => { setSaveState('idle'); setSaveMessage(''); }, 3000);
          return;
        }

        setDiffs(result.data.diffs);
        setSaveState('preview');
        setSaveMessage(`${result.data.diffs.length} file change(s) ready. Click "Apply" to save.`);
        addLog('diff_preview', `Generated ${result.data.diffs.length} diff(s)`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setSaveState('error');
        setSaveMessage(`Error: ${msg}`);
        addLog('refactor_error', msg);
        setDiffs([]);
        setTimeout(() => { setSaveState('idle'); setSaveMessage(''); }, 4000);
      }
      return;
    }

    // Step 2: Apply diffs to source files
    if (diffs.length > 0) {
      setSaveState('applying');
      setSaveMessage(`Applying ${diffs.length} change(s) to source code...`);
      addLog('apply_start', `Applying ${diffs.length} diff(s)`);

      try {
        const response = await fetch('/api/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ diffs, projectPath: effectivePath }),
        });
        const result = await response.json() as {
          success: boolean;
          data?: { applied: number; filesChanged: string[]; failed: { file: string; reason: string }[] };
          error?: { message?: string };
        };

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error?.message || 'Failed to apply changes');
        }

        const { applied, filesChanged, failed } = result.data;
        setSaveState('done');
        setSaveMessage(`Saved! ${applied} change(s) applied to ${filesChanged.join(', ')}`);
        addLog('apply_done', `Applied ${applied} diff(s) across ${filesChanged.length} file(s)`);

        if (failed.length > 0) {
          addLog('apply_partial', `${failed.length} diff(s) failed`);
        }

        clearChanges();
        setDiffs([]);
        setTimeout(() => { setSaveState('idle'); setSaveMessage(''); }, 5000);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setSaveState('error');
        setSaveMessage(`Error: ${msg}`);
        addLog('apply_error', msg);
        setDiffs([]);
        setTimeout(() => { setSaveState('idle'); setSaveMessage(''); }, 4000);
      }
    }
  };

  const handleCancelDiffs = () => {
    setDiffs([]);
    setSaveState('idle');
    setSaveMessage('');
  };

  const handleToggleViewport = () => {
    const next = viewportMode === 'desktop' ? 'mobile' : 'desktop';
    setViewportMode(next);
    sendMessage('mobile_view', { targetWidth: next === 'mobile' ? 375 : 1280 });
  };

  return (
    <>
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-gray-900/90 backdrop-blur-md border-b border-gray-800/60">
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

        {/* Save: multi-step with visual feedback */}
        {saveState === 'preview' ? (
          <>
            <ToolbarButton onClick={handleSave} title="Apply changes to source code">
              <SaveIcon />
              <span className="text-green-400">Apply ({diffs.length})</span>
            </ToolbarButton>
            <ToolbarButton onClick={handleCancelDiffs} title="Cancel">
              <span className="text-red-400 text-xs">Cancel</span>
            </ToolbarButton>
          </>
        ) : (
          <ToolbarButton
            onClick={handleSave}
            disabled={(changes.length === 0 && diffs.length === 0) || saveState === 'generating' || saveState === 'applying'}
            title={saveState === 'generating' ? 'Generating...' : saveState === 'applying' ? 'Applying...' : 'Save changes'}
          >
            <SaveIcon />
            <span>
              {saveState === 'generating' ? 'Generating...' :
               saveState === 'applying' ? 'Applying...' :
               saveState === 'done' ? 'Saved!' :
               saveState === 'error' ? 'Error' :
               `Save${changes.length > 0 ? ` (${changes.length})` : ''}`}
            </span>
          </ToolbarButton>
        )}

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

      {/* Right: Agent status */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? STATUS_COLORS[status] || 'bg-gray-400' : 'bg-red-500'}`} />
        <span className="text-xs text-gray-400">
          {connected ? STATUS_LABELS[status] || status : 'Disconnected'}
        </span>
      </div>
    </div>

    {/* Save status banner — pointer-events none so it doesn't block clicks */}
    {saveMessage && (
      <div className={`fixed top-10 left-0 right-0 z-40 px-4 py-2 text-xs text-center transition-all pointer-events-none ${
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
    </>
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
