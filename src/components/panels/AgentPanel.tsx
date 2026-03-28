'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useAgentStore } from '@/stores/agent-store';
import type { AgentFeedback, Suggestion, AgentLog } from '@/types';

// ---------------------------------------------------------------------------
// AgentPanel (main export)
// ---------------------------------------------------------------------------

export default function AgentPanel() {
  const { status, connected } = useAgentStore();

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800/60">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-emerald-400' : 'bg-red-500'}`} />
        <span className="text-xs text-gray-300 font-medium">
          {connected ? 'Connected' : 'Disconnected'}
        </span>
        <span className="text-xs text-gray-500 mx-1">|</span>
        <span className="text-xs text-gray-400 capitalize">{status}</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <FeedbackSection />
        <SuggestionsSection />
        <ChatSection />
        <LogsSection />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FeedbackSection
// ---------------------------------------------------------------------------

function FeedbackSection() {
  const feedbacks = useAgentStore((s) => s.feedbacks);
  const removeFeedback = useAgentStore((s) => s.removeFeedback);
  const applyChange = useEditorStore((s) => s.applyChange);
  const sendMessage = useAgentStore((s) => s.sendMessage);

  if (feedbacks.length === 0) return null;

  const handleApply = (feedback: AgentFeedback) => {
    if (feedback.suggestedChanges.length > 0) {
      for (const change of feedback.suggestedChanges) {
        applyChange(change);
      }
      sendMessage('accept_feedback', {
        feedbackId: feedback.id,
        changes: feedback.suggestedChanges,
      });
    }
    removeFeedback(feedback.id);
  };

  const handleAskFix = (feedback: AgentFeedback) => {
    // Direct auto-fix: skip chat confirmation, apply immediately
    sendMessage('auto_fix', {
      feedbackId: feedback.id,
      message: feedback.message,
      affectedComponents: feedback.affectedComponents,
      type: feedback.type,
    });
    removeFeedback(feedback.id);
  };

  const handleDismiss = (id: string) => {
    removeFeedback(id);
  };

  return (
    <PanelSection title="Feedback" count={feedbacks.length}>
      <div className="space-y-2">
        {feedbacks.map((fb) => (
          <div
            key={fb.id}
            className={`
              p-3 rounded-lg border text-xs
              ${fb.severity === 'error'
                ? 'bg-red-950/40 border-red-800/50'
                : 'bg-amber-950/40 border-amber-800/50'
              }
            `}
          >
            <div className="flex items-center gap-1.5 mb-1">
              {fb.severity === 'error' ? <ErrorIcon /> : <WarningIcon />}
              <span className={`
                px-1.5 py-0.5 rounded text-[10px] font-medium
                ${fb.severity === 'error'
                  ? 'bg-red-900/60 text-red-300'
                  : 'bg-amber-900/60 text-amber-300'
                }
              `}>
                {fb.type}
              </span>
            </div>
            <p className="text-[11px] text-gray-300 leading-relaxed mb-2.5">{fb.message}</p>
            <div className="flex items-center gap-2">
              {fb.suggestedChanges.length > 0 ? (
                <ActionButton
                  variant="primary"
                  onClick={() => handleApply(fb)}
                >
                  바로 적용
                </ActionButton>
              ) : (
                <ActionButton
                  variant="primary"
                  onClick={() => handleAskFix(fb)}
                >
                  AI 수정 요청
                </ActionButton>
              )}
              <ActionButton
                variant="ghost"
                onClick={() => handleDismiss(fb.id)}
              >
                무시
              </ActionButton>
            </div>
          </div>
        ))}
      </div>
    </PanelSection>
  );
}

// ---------------------------------------------------------------------------
// SuggestionsSection
// ---------------------------------------------------------------------------

function SuggestionsSection() {
  const suggestions = useAgentStore((s) => s.suggestions);
  const removeSuggestion = useAgentStore((s) => s.removeSuggestion);
  const applyChange = useEditorStore((s) => s.applyChange);
  const sendMessage = useAgentStore((s) => s.sendMessage);
  const hoverComponent = useEditorStore((s) => s.hoverComponent);
  const [hoveredSugId, setHoveredSugId] = useState<string | null>(null);

  if (suggestions.length === 0) return null;

  const handleApply = (suggestion: Suggestion) => {
    for (const change of suggestion.changes) {
      applyChange(change);
    }
    sendMessage('accept_suggestion', {
      suggestionId: suggestion.id,
      changes: suggestion.changes,
    });
    removeSuggestion(suggestion.id);
  };

  const handleIgnore = (id: string) => {
    removeSuggestion(id);
  };

  const handleHoverEnter = (sug: Suggestion) => {
    setHoveredSugId(sug.id);
    const firstChange = sug.changes[0];
    if (firstChange) {
      hoverComponent(firstChange.componentId);
    }
  };

  const handleHoverLeave = () => {
    setHoveredSugId(null);
    hoverComponent(null);
  };

  return (
    <PanelSection title="제안" count={suggestions.length}>
      <div className="space-y-2">
        {suggestions.map((sug) => (
          <div
            key={sug.id}
            className={`p-3 rounded-lg border transition-colors ${
              hoveredSugId === sug.id
                ? 'bg-blue-900/30 border-blue-700/60'
                : 'bg-gray-800/40 border-gray-700/50'
            }`}
            onMouseEnter={() => handleHoverEnter(sug)}
            onMouseLeave={handleHoverLeave}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <h4 className="text-xs font-medium text-gray-200">{sug.title}</h4>
              </div>
              <ConfidenceBadge value={sug.confidence} />
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed mb-2.5">
              {sug.description}
            </p>
            {sug.changes.length > 0 && (
              <p className="text-[10px] text-gray-500 mb-2">
                영향 컴포넌트: {sug.changes.map(c => c.componentId.replace('comp-', '').slice(0, 15)).join(', ')}
              </p>
            )}
            <div className="flex items-center gap-2">
              <ActionButton
                variant="primary"
                onClick={() => handleApply(sug)}
              >
                적용
              </ActionButton>
              <ActionButton
                variant="ghost"
                onClick={() => handleIgnore(sug.id)}
              >
                무시
              </ActionButton>
            </div>
          </div>
        ))}
      </div>
    </PanelSection>
  );
}

// ---------------------------------------------------------------------------
// ChatSection
// ---------------------------------------------------------------------------

function ChatSection() {
  const chatMessages = useAgentStore((s) => s.chatMessages);
  const addChatMessage = useAgentStore((s) => s.addChatMessage);
  const sendMessage = useAgentStore((s) => s.sendMessage);
  const status = useAgentStore((s) => s.status);
  const connected = useAgentStore((s) => s.connected);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !connected) return;

    addChatMessage({
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    });

    sendMessage('chat', { message: trimmed });
    setInput('');
  }, [input, connected, addChatMessage, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <PanelSection title="Chat" defaultOpen>
      <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
        {chatMessages.length === 0 && (
          <p className="text-[11px] text-gray-600 text-center py-4">
            Ask the AI agent about your layout
          </p>
        )}
        {chatMessages.map((msg, i) => (
          <div
            key={`${msg.timestamp}-${i}`}
            className={`
              flex
              ${msg.role === 'user' ? 'justify-end' : 'justify-start'}
            `}
          >
            <div
              className={`
                max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-blue-600/30 text-blue-100 rounded-br-sm'
                  : 'bg-gray-800/60 text-gray-300 rounded-bl-sm'
                }
              `}
            >
              {msg.content}
              {msg.plan && msg.plan.awaiting_confirm && (
                <PlanConfirm
                  planId={msg.plan.planId}
                  steps={msg.plan.steps}
                />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat input */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={connected ? 'Ask about layout...' : 'Not connected'}
          disabled={!connected || status === 'chatting'}
          className="
            flex-1 px-3 py-2 bg-gray-800/60 border border-gray-700/50
            rounded-lg text-xs text-gray-200 placeholder-gray-600
            focus:outline-none focus:border-blue-600/50 focus:ring-1 focus:ring-blue-600/20
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors duration-150
          "
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || !connected || status === 'chatting'}
          className="
            px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs
            font-medium text-white transition-colors duration-150
            disabled:opacity-40 disabled:cursor-not-allowed
            flex-shrink-0
          "
        >
          <SendIcon />
        </button>
      </div>
    </PanelSection>
  );
}

// ---------------------------------------------------------------------------
// PlanConfirm
// ---------------------------------------------------------------------------

function PlanConfirm({ planId, steps }: { planId: string; steps: string[] }) {
  const sendMessage = useAgentStore((s) => s.sendMessage);

  return (
    <div className="mt-2 pt-2 border-t border-gray-700/40">
      <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-gray-400 mb-2">
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      <button
        onClick={() => sendMessage('plan_confirmed', { planId })}
        className="
          px-3 py-1 bg-emerald-600/80 hover:bg-emerald-600
          rounded text-[11px] font-medium text-white
          transition-colors duration-150
        "
      >
        Confirm Plan
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LogsSection
// ---------------------------------------------------------------------------

function LogsSection() {
  const logs = useAgentStore((s) => s.logs);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <PanelSection title="Logs" count={logs.length} defaultOpen={false}>
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {logs.length === 0 && (
          <p className="text-[11px] text-gray-600 text-center py-2">
            No agent activity yet
          </p>
        )}
        {logs.map((log: AgentLog, i: number) => (
          <LogEntry key={`${log.timestamp}-${i}`} log={log} />
        ))}
        <div ref={logsEndRef} />
      </div>
    </PanelSection>
  );
}

function LogEntry({ log }: { log: AgentLog }) {
  const time = new Date(log.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="flex items-start gap-2 py-1 text-[10px] font-mono">
      <span className="text-gray-600 flex-shrink-0">{time}</span>
      <span className="text-gray-500 flex-shrink-0 w-24 truncate">{log.step}</span>
      <span className="text-gray-400 truncate">{log.detail}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PanelSection (collapsible)
// ---------------------------------------------------------------------------

function PanelSection({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-800/40">
      <button
        onClick={() => setOpen(!open)}
        className="
          flex items-center justify-between w-full px-4 py-2.5
          text-xs font-medium text-gray-400 hover:text-gray-200
          transition-colors duration-150
        "
      >
        <div className="flex items-center gap-2">
          <ChevronIcon open={open} />
          <span>{title}</span>
          {count !== undefined && count > 0 && (
            <span className="px-1.5 py-0.5 bg-gray-800 rounded-full text-[10px] text-gray-500">
              {count}
            </span>
          )}
        </div>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function ActionButton({
  children,
  variant,
  onClick,
}: {
  children: React.ReactNode;
  variant: 'primary' | 'ghost';
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-2.5 py-1 rounded text-[11px] font-medium
        transition-colors duration-150
        ${variant === 'primary'
          ? 'bg-blue-600/80 hover:bg-blue-600 text-white'
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
        }
      `}
    >
      {children}
    </button>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const color =
    value >= 80
      ? 'text-emerald-400 bg-emerald-900/40'
      : value >= 50
        ? 'text-amber-400 bg-amber-900/40'
        : 'text-red-400 bg-red-900/40';

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>
      {value}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// SVG Icons (inline)
// ---------------------------------------------------------------------------

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
