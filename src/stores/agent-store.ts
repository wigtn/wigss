import { create } from 'zustand';
import type {
  AgentStatus,
  AgentLog,
  AgentFeedback,
  BoundingBox,
  ChatMessage,
  FidelityExpectation,
  FidelityReport,
  VerificationResult,
  Suggestion,
} from '@/types';
import { useEditorStore } from './editor-store';

interface AgentState {
  // Connection
  connected: boolean;
  ws: WebSocket | null;

  // Agent state
  status: AgentStatus;
  logs: AgentLog[];

  // Feedback & suggestions
  feedbacks: AgentFeedback[];
  suggestions: Suggestion[];

  // Chat
  chatMessages: ChatMessage[];

  // Verification (legacy v2.1 shape, retained for compatibility)
  verification: VerificationResult | null;

  // v2.2 Fidelity verification state
  lastBackupId: string | null;
  lastExpectations: FidelityExpectation[];
  lastPriorBoxes: Record<string, BoundingBox>;
  verificationReports: FidelityReport[] | null;
  verificationWarning: string | null;

  // Demo mode
  isDemoMode: boolean;

  // Reconnect
  _reconnectTimer: ReturnType<typeof setTimeout> | null;
  _reconnectAttempts: number;

  // Actions
  setConnected: (connected: boolean) => void;
  setWs: (ws: WebSocket | null) => void;
  setStatus: (status: AgentStatus) => void;
  addLog: (step: string, detail: string) => void;

  addFeedback: (feedback: AgentFeedback) => void;
  removeFeedback: (id: string) => void;
  clearFeedbacks: () => void;

  addSuggestion: (suggestion: Suggestion) => void;
  removeSuggestion: (id: string) => void;
  clearSuggestions: () => void;

  addChatMessage: (message: ChatMessage) => void;
  clearChat: () => void;

  setVerification: (result: VerificationResult | null) => void;
  setDemoMode: (isDemoMode: boolean) => void;

  // v2.2 Fidelity verification actions
  setApplyResult: (
    backupId: string | null,
    expectations: FidelityExpectation[],
    priorBoxes: Record<string, BoundingBox>,
  ) => void;
  setVerificationReports: (reports: FidelityReport[] | null) => void;
  clearVerification: () => void;
  setVerificationWarning: (msg: string | null) => void;

  // WebSocket send helper
  sendMessage: (type: string, payload: unknown) => void;

  // Connect to WebSocket
  connect: (url: string) => void;
  disconnect: () => void;

  reset: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // ms

// Memory limits for unbounded arrays
const MAX_LOGS = 500;
const MAX_FEEDBACKS = 50;
const MAX_SUGGESTIONS = 50;
const MAX_CHAT_MESSAGES = 200;

const initialState = {
  connected: false,
  ws: null,
  status: 'idle' as AgentStatus,
  logs: [],
  feedbacks: [],
  suggestions: [],
  chatMessages: [],
  verification: null,
  lastBackupId: null,
  lastExpectations: [],
  lastPriorBoxes: {},
  verificationReports: null,
  verificationWarning: null,
  isDemoMode: false,
  _reconnectTimer: null,
  _reconnectAttempts: 0,
};

export const useAgentStore = create<AgentState>((set, get) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),

  setWs: (ws) => set({ ws }),

  setStatus: (status) =>
    set((state) => {
      const log: AgentLog = {
        timestamp: Date.now(),
        step: 'status_change',
        detail: `${state.status} -> ${status}`,
      };
      const logs = [...state.logs, log];
      return { status, logs: logs.length > MAX_LOGS ? logs.slice(-MAX_LOGS) : logs };
    }),

  addLog: (step, detail) =>
    set((state) => {
      const logs = [...state.logs, { timestamp: Date.now(), step, detail }];
      return { logs: logs.length > MAX_LOGS ? logs.slice(-MAX_LOGS) : logs };
    }),

  addFeedback: (feedback) =>
    set((state) => {
      const feedbacks = [...state.feedbacks, feedback];
      return { feedbacks: feedbacks.length > MAX_FEEDBACKS ? feedbacks.slice(-MAX_FEEDBACKS) : feedbacks };
    }),

  removeFeedback: (id) =>
    set((state) => ({
      feedbacks: state.feedbacks.filter((f) => f.id !== id),
    })),

  clearFeedbacks: () => set({ feedbacks: [] }),

  addSuggestion: (suggestion) =>
    set((state) => {
      const suggestions = [...state.suggestions, suggestion];
      return { suggestions: suggestions.length > MAX_SUGGESTIONS ? suggestions.slice(-MAX_SUGGESTIONS) : suggestions };
    }),

  removeSuggestion: (id) =>
    set((state) => ({
      suggestions: state.suggestions.filter((s) => s.id !== id),
    })),

  clearSuggestions: () => set({ suggestions: [] }),

  addChatMessage: (message) =>
    set((state) => {
      const chatMessages = [...state.chatMessages, message];
      return { chatMessages: chatMessages.length > MAX_CHAT_MESSAGES ? chatMessages.slice(-MAX_CHAT_MESSAGES) : chatMessages };
    }),

  clearChat: () => set({ chatMessages: [] }),

  setVerification: (result) => set({ verification: result }),

  setDemoMode: (isDemoMode) => set({ isDemoMode }),

  setApplyResult: (backupId, expectations, priorBoxes) =>
    set({
      lastBackupId: backupId,
      lastExpectations: expectations,
      lastPriorBoxes: priorBoxes,
      verificationReports: null,
      verificationWarning: null,
    }),

  setVerificationReports: (reports) => set({ verificationReports: reports }),

  clearVerification: () =>
    set({
      lastBackupId: null,
      lastExpectations: [],
      lastPriorBoxes: {},
      verificationReports: null,
      verificationWarning: null,
    }),

  setVerificationWarning: (msg) => set({ verificationWarning: msg }),

  sendMessage: (type, payload) => {
    const { ws, connected } = get();
    if (!ws || !connected) {
      console.warn('[AgentStore] Cannot send message: not connected');
      return;
    }
    try {
      ws.send(JSON.stringify({ type, payload }));
    } catch (err) {
      console.error('[AgentStore] Failed to send message:', err);
    }
  },

  connect: (url) => {
    const state = get();

    // Clean up existing connection
    if (state.ws) {
      state.ws.close();
    }
    if (state._reconnectTimer) {
      clearTimeout(state._reconnectTimer);
    }

    const ws = new WebSocket(url);

    set({ ws, _reconnectAttempts: 0, _reconnectTimer: null });

    ws.onopen = () => {
      console.log('[AgentStore] WebSocket connected');
      set({ connected: true, _reconnectAttempts: 0 });
      get().addLog('connection', `Connected to ${url}`);
    };

    ws.onclose = (event) => {
      console.log(`[AgentStore] WebSocket closed: code=${event.code} reason=${event.reason}`);
      set({ connected: false, ws: null });
      get().addLog('connection', `Disconnected (code: ${event.code})`);

      // Auto-reconnect with exponential backoff (unless intentional close)
      if (event.code !== 1000) {
        const attempts = get()._reconnectAttempts;
        if (attempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = BASE_RECONNECT_DELAY * Math.pow(2, Math.min(attempts, 6));
          console.log(
            `[AgentStore] Reconnecting in ${delay}ms (attempt ${attempts + 1}/${MAX_RECONNECT_ATTEMPTS})`,
          );
          const timer = setTimeout(() => {
            set({ _reconnectAttempts: attempts + 1 });
            get().connect(url);
          }, delay);
          set({ _reconnectTimer: timer });
        } else {
          console.error(
            `[AgentStore] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached`,
          );
          get().addLog('connection', 'Max reconnect attempts reached');
        }
      }
    };

    ws.onerror = (event) => {
      console.error('[AgentStore] WebSocket error:', event);
      get().addLog('connection', 'WebSocket error');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(typeof event.data === 'string' ? event.data : '');
        const { type, payload } = data;

        switch (type) {
          case 'status':
            get().setStatus(payload.status);
            if (payload.detail) {
              get().addLog('status', payload.detail);
            }
            break;

          case 'components_detected': {
            const comps = payload.components ?? [];
            get().addLog('detect', `Detected ${comps.length} components`);
            // Try to get pixel-accurate coords from iframe first
            let postMessageSent = false;
            try {
              const iframes = document.querySelectorAll('iframe');
              for (const iframe of Array.from(iframes)) {
                iframe.contentWindow?.postMessage({ type: 'wigss-scan-request' }, '*');
                postMessageSent = true;
              }
            } catch { /* ignore */ }
            // Fallback: use Playwright coords if postMessage fails (after 4s timeout)
            if (postMessageSent) {
              setTimeout(() => {
                // If components are still empty after 4s, use Playwright coords as fallback
                if (useEditorStore.getState().components.length === 0) {
                  console.log('[AgentStore] postMessage timeout, using Playwright coords as fallback');
                  useEditorStore.getState().setComponents(comps);
                }
              }, 4000);
            } else {
              useEditorStore.getState().setComponents(comps);
            }
            break;
          }

          case 'suggestion':
            get().addSuggestion({
              id: payload.id,
              title: payload.title,
              description: payload.description,
              changes: payload.changes,
              confidence: payload.confidence,
            });
            break;

          case 'feedback':
            get().addFeedback(payload);
            break;

          case 'chat_response':
            get().addChatMessage({
              role: 'agent',
              content: payload.message,
              suggestions: payload.suggestions,
              plan: payload.plan,
              timestamp: Date.now(),
            });
            break;

          case 'verification_result':
            get().setVerification(payload);
            break;

          case 'file_changed':
            get().addLog('file_changed', `File changed: ${payload.file}`);
            break;

          case 'diff_preview':
            useEditorStore.getState().setDiffs(payload.diffs ?? []);
            get().addLog('diff_preview', `Received ${payload.diffs?.length ?? 0} diffs`);
            break;

          case 'refactoring_progress':
            get().addLog(payload.step, payload.detail);
            break;

          case 'plan_confirm':
            get().addChatMessage({
              role: 'agent',
              content: payload.message,
              plan: {
                planId: payload.planId,
                steps: payload.steps,
                awaiting_confirm: true,
              },
              timestamp: Date.now(),
            });
            break;

          case 'auto_modify':
            useEditorStore.getState().applyChange(payload.change);
            get().addLog('auto_modify', `Auto-modified component: ${payload.componentId}`);
            break;

          default:
            console.log(`[AgentStore] Unhandled message type: ${type}`);
            break;
        }
      } catch (err) {
        console.error('[AgentStore] Failed to parse WebSocket message:', err);
      }
    };
  },

  disconnect: () => {
    const { ws, _reconnectTimer } = get();

    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer);
    }

    if (ws) {
      ws.close(1000, 'Client disconnect');
    }

    set({
      ws: null,
      connected: false,
      _reconnectTimer: null,
      _reconnectAttempts: 0,
    });
  },

  reset: () => {
    const { ws, _reconnectTimer } = get();

    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer);
    }
    if (ws) {
      ws.close(1000, 'Store reset');
    }

    set(initialState);
  },
}));
