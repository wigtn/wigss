'use client';

import { useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useAgentStore } from '@/stores/agent-store';
import {
  buildExpectationsFromChanges,
  capturePriorBoxes,
  extractActualBoxes,
} from '@/lib/fidelity-client';
import type { CodeDiff, FidelityReport } from '@/types';

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

/**
 * Posts the fidelity expectations captured before /api/apply to /api/verify
 * along with the currently-measured bounding boxes. On success stores the
 * reports in the agent store; on failure records a verificationWarning so the
 * UI can surface the issue without throwing.
 */
interface VerifyContext {
  projectPath: string;
  viewportWidth: number;
  /** P7(PROD-636): 자동 재시도 잔여 횟수. 0이면 사람에게 넘긴다 */
  retriesLeft: number;
}

async function runVerification(
  expectations: ReturnType<typeof buildExpectationsFromChanges>,
  priorBoxes: Record<string, import('@/types').BoundingBox>,
  ctx: VerifyContext,
): Promise<void> {
  try {
    const agent = useAgentStore.getState();
    const editor = useEditorStore.getState();
    const componentIds = expectations.map((e) => e.componentId);
    const actualBoxes = extractActualBoxes(componentIds, editor.components);

    // If the re-scan never produced matching components we cannot verify.
    const missing = componentIds.filter((id) => !actualBoxes[id]);
    if (missing.length === componentIds.length) {
      agent.setVerificationWarning(
        `재스캔 후 컴포넌트를 다시 찾지 못해 검증을 건너뜁니다 (${missing.length}개).`,
      );
      agent.addLog('verify_skip', `No re-scanned components matched expectations`);
      return;
    }

    const response = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectations, priorBoxes, actualBoxes }),
    });
    const result = (await response.json()) as {
      success: boolean;
      data?: { passed: boolean; reports: FidelityReport[] };
      error?: { message?: string };
    };

    if (!response.ok || !result.success || !result.data) {
      const msg = result.error?.message || `verify failed (HTTP ${response.status})`;
      agent.setVerificationWarning(msg);
      agent.addLog('verify_error', msg);
      return;
    }

    agent.setVerificationReports(result.data.reports);
    agent.addLog(
      'verify_done',
      result.data.passed
        ? `All ${result.data.reports.length} expectation(s) passed`
        : `${result.data.reports.filter((r) => !r.passed).length} expectation(s) failed`,
    );
    if (!result.data.passed) {
      /* ── P7(PROD-636): 자동 재시도 — 사람을 기다리지 않는다 ──
       * 실패 → 자동 롤백(역치환) → T1 모델 수선 → 재적용 → 재검증(1회).
       * T1 이 불가하면(NO_AUTH·거절) 기존처럼 경고 + 수동 롤백으로. */
      if (ctx.retriesLeft > 0) {
        const retried = await attemptAutoRepair(result.data.reports, expectations, priorBoxes, ctx);
        if (retried) return;
      }
      agent.setVerificationWarning(
        `적용 결과가 의도와 다릅니다. 롤백할 수 있습니다.`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[FloatingToolbar] verify failed:', err);
    useAgentStore.getState().setVerificationWarning(`검증 호출 실패: ${msg}`);
    useAgentStore.getState().addLog('verify_error', msg);
  }
}

/**
 * P7: 실패한 검증에 대한 자동 복구 시도.
 * 롤백 → T1 수선 → 리로드·재스캔 → 재검증(retriesLeft-1).
 * 어느 단계든 불가하면 false 를 돌려 기존 수동 경로로 넘긴다.
 */
async function attemptAutoRepair(
  reports: FidelityReport[],
  expectations: ReturnType<typeof buildExpectationsFromChanges>,
  priorBoxes: Record<string, import('@/types').BoundingBox>,
  ctx: VerifyContext,
): Promise<boolean> {
  const agent = useAgentStore.getState();
  const editor = useEditorStore.getState();
  const failed = reports.find((r) => !r.passed && r.mismatches.some((m) => m.property !== '__measurement__'));
  if (!failed) return false;

  const component = editor.components.find((c) => c.id === failed.componentId);
  const expectation = expectations.find((e) => e.componentId === failed.componentId);
  if (!component?.sourceAddress || !expectation) {
    agent.addLog('auto_repair_skip', '주소 또는 기대치 없음 — 수동 경로로');
    return false;
  }

  agent.addLog('auto_repair', `검증 실패 → 자동 롤백 후 T1 수선 시도 (${failed.componentId})`);
  agent.setStatus('refactoring');

  // 1) 자동 롤백 (역치환 — 사용자 동시 수정은 보존된다)
  const backupId = agent.lastBackupId;
  if (backupId) {
    const rb = await fetch('/api/rollback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupId }),
    });
    if (!rb.ok) {
      agent.addLog('auto_repair_skip', '자동 롤백 거부됨 — 수동 경로로');
      agent.setStatus('idle');
      return false;
    }
  }

  // 2) T1 수선 (서버가 적용까지 수행하고 새 backupId 를 준다)
  const rp = await fetch('/api/repair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: component.sourceAddress,
      targetStyles: expectation.expectedStyles,
      viewportWidth: ctx.viewportWidth,
      projectPath: ctx.projectPath,
      mismatches: failed.mismatches,
    }),
  });
  const rpJson = (await rp.json()) as {
    success: boolean;
    data?: { backupId: string; explanation: string };
    error?: { code?: string; message?: string };
  };
  if (!rp.ok || !rpJson.success || !rpJson.data) {
    const code = rpJson.error?.code;
    agent.addLog(
      'auto_repair_skip',
      code === 'NO_AUTH' ? 'Claude 인증 없음 — T1 건너뜀' : `T1 거절: ${rpJson.error?.message ?? rp.status}`,
    );
    agent.setStatus('idle');
    return false;
  }

  agent.addLog('auto_repair_applied', rpJson.data.explanation);
  agent.setApplyResult(rpJson.data.backupId, expectations, priorBoxes);

  // 3) 리로드 → (iframe load) 재스캔 → 재검증 (남은 횟수 차감)
  agent.setAwaitingRescan(true);
  setTimeout(() => {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of Array.from(iframes)) {
      try { iframe.contentWindow?.location.reload(); } catch {}
    }
  }, 300);
  agent.setStatus('verifying');
  const prevComponents = editor.components;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    unsubscribe();
    clearTimeout(fallback);
    void runVerification(expectations, priorBoxes, { ...ctx, retriesLeft: ctx.retriesLeft - 1 }).finally(() => {
      useAgentStore.getState().setStatus('idle');
    });
  };
  const unsubscribe = useEditorStore.subscribe((state) => {
    if (state.components !== prevComponents && state.components.length > 0) finish();
  });
  const fallback = setTimeout(finish, 8000);
  return true;
}

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

      // v2.2 fidelity pipeline: capture prior bbox snapshots + expectations BEFORE
      // touching the filesystem so /api/verify can validate against re-measured
      // components after the re-scan.
      const priorBoxes = capturePriorBoxes(changes, components);
      const expectations = buildExpectationsFromChanges(changes, components);

      try {
        // P3(PROD-633): 지배 토큰 선택을 위해 편집 시점 뷰포트 폭을 전달한다
        const viewportWidth = viewportMode === 'mobile' ? 375 : 1280;
        const response = await fetch('/api/refactor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ changes, components, projectPath: effectivePath, viewportWidth }),
        });
        const result = await response.json() as {
          success: boolean;
          data?: { diffs: typeof diffs; skipped?: { componentId: string; reason: string }[]; message?: string };
          error?: { message?: string };
        };

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error?.message || 'Failed to generate diffs');
        }

        if (result.data.diffs.length === 0) {
          // D5: 실패에는 사유가 있다 — 원인과 무관한 "더 큰 변경" 안내를 하지 않는다
          const firstReason = result.data.skipped?.[0]?.reason;
          setSaveState('error');
          setSaveMessage(firstReason
            ? `적용 불가: ${firstReason}`
            : '코드 변경을 생성하지 못했습니다.');
          setTimeout(() => { setSaveState('idle'); setSaveMessage(''); }, 5000);
          return;
        }
        const skippedCount = result.data.skipped?.length ?? 0;

        // Auto-apply immediately (no 2-step confirmation)
        const generatedDiffs = result.data.diffs;
        const diffFiles = (generatedDiffs as CodeDiff[]).map((d) => d.file?.split('/').pop()).filter(Boolean).join(', ');
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
          data?: {
            applied: number;
            filesChanged: string[];
            failed: { file: string; reason: string }[];
            backupId?: string | null;
          };
          error?: { message?: string };
        };

        if (!applyResponse.ok || !applyResult.success || !applyResult.data) {
          throw new Error(applyResult.error?.message || 'Failed to apply changes');
        }

        const { applied, filesChanged, failed, backupId } = applyResult.data;
        const fileList = filesChanged.map((f: string) => f.split('/').pop()).join(', ');
        setSaveState('done');
        setSaveMessage(`✓ 저장 완료! ${applied}개 수정 적용: ${fileList}` +
          (skippedCount > 0 ? ` · ${skippedCount}개 건너뜀(사유는 로그)` : ''));
        addLog('apply_done', `Applied ${applied} diff(s) across ${filesChanged.length} file(s)`);

        if (failed.length > 0) {
          addLog('apply_partial', `${failed.length} diff(s) failed`);
        }

        // Record apply result for the fidelity verification loop.
        useAgentStore.getState().setApplyResult(
          backupId ?? null,
          expectations,
          priorBoxes,
        );

        clearChanges();
        setDiffs([]);

        // Clear old suggestions/feedbacks (will regenerate after re-scan)
        useAgentStore.getState().clearSuggestions();
        useAgentStore.getState().clearFeedbacks();

        useAgentStore.getState().setStatus('idle');

        /* P5(PROD-635): 고정 대기(1s/3s/4.5s) 체인을 이벤트 기반으로.
         * - 리로드: 짧은 지연 후 트리거 (fs 반영 여유)
         * - 재스캔: iframe 의 load 이벤트가 트리거 (VisualEditor onLoad + awaitingRescan)
         * - 검증: 재스캔 결과가 스토어에 반영되는 순간 트리거, 8초 폴백
         * 느린 프로젝트에서 '재발견 실패'로 빠지던 원인이 고정 대기였다. */
        useAgentStore.getState().setAwaitingRescan(true);
        setTimeout(() => {
          const iframes = document.querySelectorAll('iframe');
          for (const iframe of Array.from(iframes)) {
            try { iframe.contentWindow?.location.reload(); } catch {}
          }
        }, 300);

        if (expectations.length > 0 && backupId) {
          useAgentStore.getState().setStatus('verifying');
          const verifyStartedAt = performance.now();
          let done = false;
          const finish = (label: string) => {
            if (done) return;
            done = true;
            unsubscribe();
            clearTimeout(fallback);
            addLog('verify_timing', `${label} +${Math.round(performance.now() - verifyStartedAt)}ms`);
            void runVerification(expectations, priorBoxes, {
              projectPath: effectivePath,
              viewportWidth,
              retriesLeft: 1, // P7: 자동 복구는 1회 — 루프 폭주 방지
            }).finally(() => {
              useAgentStore.getState().setStatus('idle');
            });
          };
          const prevComponents = useEditorStore.getState().components;
          const unsubscribe = useEditorStore.subscribe((state) => {
            if (state.components !== prevComponents && state.components.length > 0) {
              finish('rescan-event');
            }
          });
          const fallback = setTimeout(() => finish('fallback-8s'), 8000);
        }

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
