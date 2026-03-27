'use client';

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
    canUndo,
    canRedo,
    undo,
    redo,
  } = useEditorStore();

  const { status, connected, sendMessage } = useAgentStore();

  const handleScan = () => {
    sendMessage('scan', { url: targetUrl, projectPath });
  };

  const handleSave = () => {
    sendMessage('save', { changes });
  };

  const handleToggleViewport = () => {
    const next = viewportMode === 'desktop' ? 'mobile' : 'desktop';
    setViewportMode(next);
    sendMessage('mobile_view', { targetWidth: next === 'mobile' ? 375 : 1280 });
  };

  return (
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
          onClick={() => {}}
          disabled={status !== 'idle'}
          title="Edit mode"
        >
          <EditIcon />
          <span>Edit</span>
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
          disabled={changes.length === 0}
          title="Save changes"
        >
          <SaveIcon />
          <span>Save</span>
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

      {/* Right: Agent status */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? STATUS_COLORS[status] || 'bg-gray-400' : 'bg-red-500'}`} />
        <span className="text-xs text-gray-400">
          {connected ? STATUS_LABELS[status] || status : 'Disconnected'}
        </span>
      </div>
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

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
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
